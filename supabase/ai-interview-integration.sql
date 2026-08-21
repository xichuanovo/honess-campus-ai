-- ============================================================
-- 泓济环保校招站 × AI 数字人初试 一体化迁移
-- 功能：候选人投递简历后自助预约 AI 初试时段；系统记录是否准时
--       参加线上 AI 初试，并纳入量化评估（准时 10 / 迟到≤15min 6 /
--       迟到>15min 3 / 缺席 0）
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件 → Run
-- 幂等：可重复执行，不影响已有数据
-- ============================================================

-- ============================================================
-- 1. 面试时段表（系统按工作日自动生成）
-- ============================================================
create table if not exists public.campus_interview_slots (
  id          bigint generated always as identity primary key,
  slot_date   date   not null,
  start_time  time   not null,
  end_time    time   not null,
  capacity    int    not null default 3,
  booked      int    not null default 0,
  status      text   not null default 'open',   -- open / full / closed
  created_at  timestamptz not null default now(),
  unique (slot_date, start_time)
);

-- ============================================================
-- 2. 面试会话表（预约 → 参加 → 结果，含准时量化）
-- ============================================================
create table if not exists public.campus_interview_sessions (
  id                uuid primary key default gen_random_uuid(),
  booking_code      text not null unique,        -- 6位预约码，凭码+手机号进入面试
  candidate_id      bigint,                      -- 关联校招候选人（线下导入可为空）
  candidate_name    text not null,
  candidate_phone   text not null,
  applied_job       text default '',
  job_category      text default '',
  slot_id           bigint,
  scheduled_at      timestamptz not null,        -- 预约时间（北京时间）
  status            text not null default 'scheduled', -- scheduled/in_progress/completed/absent/cancelled
  joined_at         timestamptz,                 -- 实际点击「开始面试」时间
  started_at        timestamptz,
  finished_at       timestamptz,
  late_minutes      int not null default 0,      -- 迟到分钟数（负=提前）
  punctuality_score int,                         -- 10 / 6 / 3 / 0
  punctuality_label text,                        -- on_time/late_short/late_long/absent/pending
  overall_score     numeric(5,2),                -- AI 初试量化总分 0-100
  interview_summary jsonb not null default '{}'::jsonb, -- 题目+回答+六维评分
  created_at        timestamptz not null default now()
);
create index if not exists idx_ivs_candidate on public.campus_interview_sessions(candidate_id);
create index if not exists idx_ivs_slot     on public.campus_interview_sessions(slot_id);
create index if not exists idx_ivs_status   on public.campus_interview_sessions(status);
create index if not exists idx_ivs_sched    on public.campus_interview_sessions(scheduled_at);

-- ============================================================
-- 3. RLS：表默认拒绝一切，全部访问走 security definer RPC
-- ============================================================
alter table public.campus_interview_slots    enable row level security;
alter table public.campus_interview_sessions enable row level security;

-- ============================================================
-- 4. 候选人生成预约码
-- ============================================================
create or replace function public.gen_booking_code()
returns text
language plpgsql stable as $$
declare v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists (select 1 from public.campus_interview_sessions where booking_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ============================================================
-- 5. 北京时间工具（服务器 UTC，需转 Asia/Shanghai）
-- ============================================================
-- 当前北京时间日期
create or replace function public.cn_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Shanghai')::date;
$$;

-- ============================================================
-- 6. 查询可预约时段（公开）
-- 返回未来 open 且未满的时段
-- ============================================================
create or replace function public.campus_get_slots(p_from date, p_to date)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id, 'date', s.slot_date, 'start', s.start_time, 'end', s.end_time,
      'capacity', s.capacity, 'booked', s.booked, 'remaining', s.capacity - s.booked
    ) order by s.slot_date, s.start_time
  ), '[]'::jsonb)
  into v_result
  from public.campus_interview_slots s
  where s.status = 'open'
    and s.booked < s.capacity
    and s.slot_date between p_from and p_to
    and (s.slot_date > public.cn_today()
         or (s.slot_date = public.cn_today() and s.start_time > (now() at time zone 'Asia/Shanghai')::time));
  return v_result;
end;
$$;

-- ============================================================
-- 7. 预约时段（公开：候选人自助）
-- candidate_id 来自校招投递返回的 id；姓名/手机号用于面试身份校验
-- 同一候选人已有有效预约时直接返回原预约（幂等）
-- ============================================================
create or replace function public.campus_book_slot(
  p_candidate_id bigint,
  p_slot_id bigint,
  p_name text,
  p_phone text,
  p_applied_job text default '',
  p_job_category text default ''
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot record;
  v_sess record;
  v_code text;
  v_scheduled timestamptz;
begin
  if p_candidate_id is null or p_slot_id is null or nullif(p_name,'') is null or nullif(p_phone,'') is null then
    return jsonb_build_object('ok', false, 'error', '参数不完整');
  end if;

  -- 已有未取消的有效预约 → 直接返回（防重复预约）
  select * into v_sess from public.campus_interview_sessions
   where candidate_id = p_candidate_id and status in ('scheduled','in_progress') limit 1;
  if v_sess.id is not null then
    return jsonb_build_object('ok', true, 'existing', true,
      'session_id', v_sess.id, 'booking_code', v_sess.booking_code,
      'scheduled_at', v_sess.scheduled_at, 'status', v_sess.status);
  end if;

  select * into v_slot from public.campus_interview_slots where id = p_slot_id;
  if v_slot.id is null then
    return jsonb_build_object('ok', false, 'error', '时段不存在');
  end if;
  if v_slot.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', '该时段已关闭');
  end if;
  if v_slot.booked >= v_slot.capacity then
    return jsonb_build_object('ok', false, 'error', '该时段已约满');
  end if;
  -- 过去时段不可约
  if v_slot.slot_date < public.cn_today()
     or (v_slot.slot_date = public.cn_today() and v_slot.start_time <= (now() at time zone 'Asia/Shanghai')::time) then
    return jsonb_build_object('ok', false, 'error', '该时段已过，请选择其他时间');
  end if;

  v_code := public.gen_booking_code();
  v_scheduled := (v_slot.slot_date + v_slot.start_time) at time zone 'Asia/Shanghai';

  insert into public.campus_interview_sessions
    (booking_code, candidate_id, candidate_name, candidate_phone,
     applied_job, job_category, slot_id, scheduled_at)
  values
    (v_code, p_candidate_id, p_name, p_phone, p_applied_job, p_job_category, p_slot_id, v_scheduled);

  update public.campus_interview_slots set booked = booked + 1,
    status = case when booked + 1 >= capacity then 'full' else status end
   where id = p_slot_id;

  return jsonb_build_object('ok', true, 'existing', false,
    'session_id', (select id from public.campus_interview_sessions where booking_code = v_code),
    'booking_code', v_code, 'scheduled_at', v_scheduled);
end;
$$;

-- ============================================================
-- 8. 查询我的预约（公开：手机号+姓名）
-- 附带「有效状态」：超过面试开始30分钟仍未进入 → 视为缺席
-- ============================================================
create or replace function public.campus_get_my_sessions(p_phone text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'session_id', s.id, 'booking_code', s.booking_code,
      'candidate_name', s.candidate_name, 'applied_job', s.applied_job,
      'scheduled_at', s.scheduled_at,
      'status', case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 'absent' else s.status end,
      'punctuality_score', case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 0 else s.punctuality_score end,
      'punctuality_label', case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 'absent' else coalesce(s.punctuality_label,'pending') end,
      'overall_score', s.overall_score, 'created_at', s.created_at
    ) order by s.scheduled_at desc
  ), '[]'::jsonb)
  into v_result
  from public.campus_interview_sessions s
  where s.candidate_phone = p_phone and s.candidate_name = p_name and s.status <> 'cancelled';
  return v_result;
end;
$$;

-- ============================================================
-- 9. 验证面试入场（公开：预约码+手机号）
-- ============================================================
create or replace function public.campus_verify_session(p_code text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s record;
begin
  select * into v_s from public.campus_interview_sessions
   where booking_code = upper(p_code) and candidate_phone = p_phone limit 1;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'error', '预约码或手机号不匹配');
  end if;
  if v_s.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', '该预约已取消');
  end if;
  return jsonb_build_object('ok', true,
    'session_id', v_s.id, 'booking_code', v_s.booking_code,
    'candidate_name', v_s.candidate_name, 'applied_job', v_s.applied_job,
    'job_category', v_s.job_category, 'candidate_id', v_s.candidate_id,
    'scheduled_at', v_s.scheduled_at,
    'status', case when v_s.status='scheduled' and v_s.scheduled_at + interval '30 minutes' < now() then 'absent' else v_s.status end,
    'punctuality_label', case when v_s.status='scheduled' and v_s.scheduled_at + interval '30 minutes' < now() then 'absent' else coalesce(v_s.punctuality_label,'pending') end,
    'joined_at', v_s.joined_at);
end;
$$;

-- ============================================================
-- 10. 开始面试（公开）：记录实际进入时间并计算准时分
--     规则：≤预约时间+15min → 10 分（on_time）
--           >+15min 且 ≤+30min → 6 分（late_short）
--           >+30min → 3 分（late_long，仍允许参加）
--           缺席由查询侧惰性判定（0 分 absent）
-- ============================================================
create or replace function public.campus_mark_interview_start(p_code text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_s record;
  v_joined timestamptz;
  v_late int;
  v_score int;
  v_label text;
begin
  select * into v_s from public.campus_interview_sessions
   where booking_code = upper(p_code) and candidate_phone = p_phone limit 1;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'error', '预约码或手机号不匹配');
  end if;
  if v_s.status in ('completed','cancelled') then
    return jsonb_build_object('ok', false, 'error', '该预约已结束或取消');
  end if;

  v_joined := now();
  v_late := round(extract(epoch from (v_joined - v_s.scheduled_at)) / 60)::int;

  if v_late <= 15 then
    v_score := 10; v_label := 'on_time';
  elsif v_late <= 30 then
    v_score := 6;  v_label := 'late_short';
  else
    v_score := 3;  v_label := 'late_long';
  end if;

  update public.campus_interview_sessions set
    status = 'in_progress',
    joined_at = v_joined,
    late_minutes = v_late,
    punctuality_score = v_score,
    punctuality_label = v_label
  where id = v_s.id;

  return jsonb_build_object('ok', true,
    'session_id', v_s.id, 'joined_at', v_joined,
    'late_minutes', v_late, 'punctuality_score', v_score, 'punctuality_label', v_label,
    'scheduled_at', v_s.scheduled_at);
end;
$$;

-- ============================================================
-- 11. 提交面试结果（公开）：写入量化评估与完整记录
-- ============================================================
create or replace function public.campus_submit_interview(
  p_code text, p_phone text, p_summary jsonb, p_overall numeric
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s record;
begin
  select * into v_s from public.campus_interview_sessions
   where booking_code = upper(p_code) and candidate_phone = p_phone limit 1;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'error', '预约码或手机号不匹配');
  end if;
  update public.campus_interview_sessions set
    status = 'completed',
    finished_at = now(),
    overall_score = p_overall,
    interview_summary = coalesce(p_summary, '{}'::jsonb)
  where id = v_s.id;
  return jsonb_build_object('ok', true, 'session_id', v_s.id);
end;
$$;

-- ============================================================
-- 12. HR：生成工作日时段（默认 9:00-18:00，30 分钟/段，每段 3 人）
-- ============================================================
create or replace function public.campus_hr_generate_slots(
  p_passcode text, p_start date, p_days int default 7,
  p_start_hour int default 9, p_end_hour int default 18,
  p_slot_minutes int default 30, p_capacity int default 3
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
  v_day date;
  v_t time;
  v_cnt int := 0;
begin
  select public.campus_check_passcode(p_passcode) into v_ok;
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'error', '口令错误');
  end if;
  if p_days < 1 or p_days > 30 then p_days := 7; end if;
  if p_start_hour < 0 or p_start_hour >= 24 then p_start_hour := 9; end if;
  if p_end_hour <= p_start_hour or p_end_hour > 24 then p_end_hour := p_start_hour + 8; end if;
  if p_slot_minutes < 15 then p_slot_minutes := 30; end if;
  if p_capacity < 1 then p_capacity := 3; end if;

  for i in 0..p_days-1 loop
    v_day := p_start + i;
    if extract(dow from v_day) between 1 and 5 then  -- 周一~周五
      v_t := make_time(p_start_hour, 0, 0);
      while v_t < make_time(p_end_hour, 0, 0) loop
        insert into public.campus_interview_slots (slot_date, start_time, end_time, capacity)
        values (v_day, v_t, v_t + make_interval(mins => p_slot_minutes), p_capacity)
        on conflict (slot_date, start_time) do nothing;
        v_cnt := v_cnt + 1;
        v_t := v_t + make_interval(mins => p_slot_minutes);
      end loop;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'generated', v_cnt,
    'range', jsonb_build_object('from', p_start, 'to', p_start + p_days - 1));
end;
$$;

-- ============================================================
-- 13. HR：开关时段 / 查询全部时段
-- ============================================================
create or replace function public.campus_hr_set_slot_status(p_passcode text, p_slot_id bigint, p_status text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  select public.campus_check_passcode(p_passcode) into v_ok;
  if not coalesce(v_ok, false) then return jsonb_build_object('ok', false, 'error', '口令错误'); end if;
  if p_status not in ('open','full','closed') then p_status := 'closed'; end if;
  update public.campus_interview_slots set status = p_status where id = p_slot_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.campus_hr_get_slots(p_passcode text, p_from date default null, p_to date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ok boolean; v_result jsonb;
begin
  select public.campus_check_passcode(p_passcode) into v_ok;
  if not coalesce(v_ok, false) then return jsonb_build_object('ok', false, 'error', '口令错误'); end if;
  select coalesce(jsonb_agg(
    jsonb_build_object('id', s.id, 'date', s.slot_date, 'start', s.start_time, 'end', s.end_time,
      'capacity', s.capacity, 'booked', s.booked, 'remaining', s.capacity - s.booked, 'status', s.status)
    order by s.slot_date, s.start_time), '[]'::jsonb)
  into v_result
  from public.campus_interview_slots s
  where (p_from is null or s.slot_date >= p_from) and (p_to is null or s.slot_date <= p_to);
  return jsonb_build_object('ok', true, 'slots', v_result);
end;
$$;

-- ============================================================
-- 14. HR：预约名单（含惰性缺席判定 + 准时量化）
-- ============================================================
create or replace function public.campus_hr_get_interview_sessions(p_passcode text, p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
  v_result jsonb;
  v_status text;
  v_kw text;
  v_sched_from timestamptz;
  v_sched_to timestamptz;
begin
  select public.campus_check_passcode(p_passcode) into v_ok;
  if not coalesce(v_ok, false) then return jsonb_build_object('ok', false, 'error', '口令错误'); end if;

  v_status := p_filters->>'status';
  v_kw := p_filters->>'keyword';
  v_sched_from := nullif(p_filters->>'scheduled_from','')::timestamptz;
  v_sched_to := nullif(p_filters->>'scheduled_to','')::timestamptz;

  select coalesce(jsonb_agg(item order by scheduled_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      jsonb_build_object(
        'session_id', s.id, 'booking_code', s.booking_code,
        'candidate_id', s.candidate_id, 'candidate_name', s.candidate_name,
        'candidate_phone', s.candidate_phone, 'applied_job', s.applied_job,
        'job_category', s.job_category, 'scheduled_at', s.scheduled_at,
        'joined_at', s.joined_at, 'finished_at', s.finished_at,
        'late_minutes', s.late_minutes,
        'status', case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 'absent' else s.status end,
        'punctuality_score', case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 0 else s.punctuality_score end,
        'punctuality_label', case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 'absent' else coalesce(s.punctuality_label,'pending') end,
        'overall_score', s.overall_score, 'interview_summary', s.interview_summary, 'created_at', s.created_at,
        'candidate', case when c.id is not null then jsonb_build_object(
            'education', c.education, 'school', c.school, 'major', c.major,
            'preferred_category', c.preferred_category, 'mbti_type', c.mbti_type,
            'source', c.source, 'status', c.status)
          else null end
      ) as item,
      s.scheduled_at
    from public.campus_interview_sessions s
    left join public.campus_candidates c on c.id = s.candidate_id
    where (v_status is null or
            case when s.status='scheduled' and s.scheduled_at + interval '30 minutes' < now() then 'absent' else s.status end = v_status)
      and (v_kw is null or s.candidate_name ilike '%'||v_kw||'%' or s.candidate_phone like '%'||v_kw||'%' or s.applied_job ilike '%'||v_kw||'%')
      and (v_sched_from is null or s.scheduled_at >= v_sched_from)
      and (v_sched_to is null or s.scheduled_at <= v_sched_to)
  ) t;

  return jsonb_build_object('ok', true, 'sessions', v_result);
end;
$$;

-- ============================================================
-- 15. HR：AI 初试统计（预约/完成/准时率/平均分）
-- ============================================================
create or replace function public.campus_hr_get_interview_stats(p_passcode text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
  v_total int;
  v_completed int;
  v_inprogress int;
  v_absent int;
  v_on_time int;
  v_avg_punct numeric;
  v_avg_overall numeric;
begin
  select public.campus_check_passcode(p_passcode) into v_ok;
  if not coalesce(v_ok, false) then return jsonb_build_object('ok', false, 'error', '口令错误'); end if;

  select count(*) into v_total from public.campus_interview_sessions where status <> 'cancelled';
  select count(*) into v_completed from public.campus_interview_sessions where status = 'completed';
  select count(*) into v_inprogress from public.campus_interview_sessions where status = 'in_progress';
  select count(*) into v_absent
  from public.campus_interview_sessions
  where status='scheduled' and scheduled_at + interval '30 minutes' < now();

  select count(*) into v_on_time
  from public.campus_interview_sessions
  where punctuality_label = 'on_time';

  select coalesce(round(avg(coalesce(punctuality_score,0)),1),0)
  into v_avg_punct
  from public.campus_interview_sessions
  where status in ('completed','in_progress')
     or (status='scheduled' and scheduled_at + interval '30 minutes' < now());

  select coalesce(round(avg(overall_score),1),0)
  into v_avg_overall
  from public.campus_interview_sessions
  where status = 'completed' and overall_score is not null;

  return jsonb_build_object('ok', true, 'stats', jsonb_build_object(
    'total', v_total, 'completed', v_completed, 'in_progress', v_inprogress,
    'absent', v_absent, 'on_time', v_on_time,
    'punctuality_rate', case when v_completed + v_inprogress + v_absent > 0
        then round((v_on_time::numeric / (v_completed + v_inprogress + v_absent)) * 100, 1) else 0 end,
    'avg_punctuality', v_avg_punct, 'avg_overall', v_avg_overall
  ));
end;
$$;

-- ============================================================
-- 16. 授权（security definer 函数，匿名可执行，靠参数鉴权）
-- ============================================================
grant execute on function public.campus_get_slots(date, date) to anon, authenticated;
grant execute on function public.campus_book_slot(bigint, bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.campus_get_my_sessions(text, text) to anon, authenticated;
grant execute on function public.campus_verify_session(text, text) to anon, authenticated;
grant execute on function public.campus_mark_interview_start(text, text) to anon, authenticated;
grant execute on function public.campus_submit_interview(text, text, jsonb, numeric) to anon, authenticated;
grant execute on function public.campus_hr_generate_slots(text, date, int, int, int, int, int) to anon, authenticated;
grant execute on function public.campus_hr_set_slot_status(text, bigint, text) to anon, authenticated;
grant execute on function public.campus_hr_get_slots(text, date, date) to anon, authenticated;
grant execute on function public.campus_hr_get_interview_sessions(text, jsonb) to anon, authenticated;
grant execute on function public.campus_hr_get_interview_stats(text) to anon, authenticated;

-- ============================================================
-- 完成
-- ============================================================
-- 验证：应返回 0
select count(*) as slots from public.campus_interview_slots;

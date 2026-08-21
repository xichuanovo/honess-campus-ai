/**
 * supabase-api.js — 前端 Supabase API 拦截层（上云版）
 * 拦截所有 /api/... 请求，转发到 Supabase REST / RPC（campus_ 系列函数）
 *
 * 工作模式：
 * - 已配置 Supabase → 走云数据库（campus_ 表 + RPC）
 * - 未配置 → 不拦截，走本地 Express 服务器
 *
 * 依赖：supabase-config.js（配置）、resume-parser-client.js（前端简历解析/推荐）
 */
(function () {
    'use strict';

    var CONFIG = window.SUPABASE_CONFIG || {};
    var SUPA_URL = CONFIG.url || '';
    var SUPA_KEY = CONFIG.anonKey || '';

    // 未配置则不拦截，使用本地服务器
    if (!SUPA_URL || SUPA_URL === 'YOUR_SUPABASE_URL' || !SUPA_KEY) {
        console.log('[supabase-api] 未配置 Supabase，使用本地服务器模式');
        return;
    }

    var REST_BASE = SUPA_URL + '/rest/v1';
    var originalFetch = window.fetch;

    console.log('[supabase-api] Supabase 云数据库模式已激活:', SUPA_URL);

    // ================================================================
    // Supabase REST / RPC 辅助
    // ================================================================

    function supaHeaders(prefer) {
        var h = {
            'apikey': SUPA_KEY,
            'Authorization': 'Bearer ' + SUPA_KEY,
            'Content-Type': 'application/json'
        };
        if (prefer) h['Prefer'] = prefer;
        return h;
    }

    async function restGet(table, query) {
        var url = REST_BASE + '/' + table + (query ? '?' + query : '');
        var resp = await originalFetch(url, { headers: supaHeaders() });
        if (!resp.ok) throw new Error('Supabase GET ' + table + ': ' + resp.status);
        return resp.json();
    }

    async function rpc(fn, body) {
        var resp = await originalFetch(REST_BASE + '/rpc/' + fn, {
            method: 'POST',
            headers: supaHeaders(),
            body: JSON.stringify(body || {})
        });
        if (!resp.ok) {
            var errText = '';
            try { errText = await resp.text(); } catch (e) {}
            throw new Error('RPC ' + fn + ' HTTP ' + resp.status + ' ' + errText.substring(0, 200));
        }
        // 204 No Content（void 函数）
        if (resp.status === 204) return null;
        return resp.json();
    }

    // 上传简历文件到 Supabase Storage，返回 public URL
    async function uploadResume(file) {
        var name = file.name || 'resume';
        var ext = (name.split('.').pop() || 'pdf').toLowerCase();
        if (['pdf', 'txt', 'png', 'jpg', 'jpeg'].indexOf(ext) === -1) ext = 'pdf';
        var path = Date.now() + '-' + Math.random().toString(36).substring(2, 10) + '.' + ext;
        var resp = await originalFetch(SUPA_URL + '/storage/v1/object/resumes/' + path, {
            method: 'POST',
            headers: {
                'apikey': SUPA_KEY,
                'Authorization': 'Bearer ' + SUPA_KEY,
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });
        if (!resp.ok) throw new Error('简历上传失败 HTTP ' + resp.status);
        return SUPA_URL + '/storage/v1/object/public/resumes/' + path;
    }

    // 读取当前 HR 会话口令（登录成功后由 campus_hr_login 下发，未登录则为空）
    function getPasscode() {
        try {
            var s = JSON.parse(localStorage.getItem('campus_admin_session') || '{}');
            return s.passcode || '';
        } catch (e) { return ''; }
    }

    // 读取当前登录用户（评论/评估等协作操作用）
    function getCurrentUser() {
        try {
            var s = JSON.parse(localStorage.getItem('campus_admin_session') || '{}');
            return s.user || null;
        } catch (e) { return null; }
    }

    // ================================================================
    // 模拟 fetch Response（让前端 .json() / .ok 正常可用）
    // ================================================================

    function makeResponse(data) {
        return {
            ok: true, status: 200,
            json: function () { return Promise.resolve(data); },
            text: function () { return Promise.resolve(JSON.stringify(data)); },
            blob: function () { return Promise.resolve(new Blob([JSON.stringify(data)])); }
        };
    }
    function makeErrorResponse(status, msg) {
        // 口令失效（如已轮换）→ 清理会话，提示重新登录
        if (status === 401 && msg === '口令错误') {
            try { localStorage.removeItem('campus_admin_session'); } catch (e) {}
            msg = '会话已过期，请退出后重新登录';
        }
        return {
            ok: false, status: status,
            json: function () { return Promise.resolve({ error: msg }); },
            text: function () { return Promise.resolve(JSON.stringify({ error: msg })); }
        };
    }

    // FormData → 普通对象
    function formDataToObj(formData) {
        var data = {};
        formData.forEach(function (v, k) { data[k] = v; });
        return data;
    }

    // ================================================================
    // API 端点处理
    // ================================================================

    async function handleApiRequest(url, opts) {
        var u = String(url).replace(/^https?:\/\/[^/]+/, '');
        // 归一化：允许相对路径 api/xxx 与绝对路径 /api/xxx 都命中
        u = u.replace(/^\/+/, '/');
        var method = (opts && opts.method) || 'GET';

        // ---------- 健康检查 ----------
        if (u === '/api/health') {
            return makeResponse({ status: 'ok', database: 'supabase', time: new Date().toISOString() });
        }

        // ---------- 岗位（公开）----------
        if (u === '/api/jobs' || u.match(/^\/api\/jobs\?/)) {
            var catMatch = u.match(/category=([^&]+)/);
            var q = 'status=eq.open&order=created_at.desc';
            if (catMatch) q = 'category=eq.' + encodeURIComponent(decodeURIComponent(catMatch[1])) + '&' + q;
            var jobs = await restGet('campus_jobs', q);
            return makeResponse(jobs);
        }

        var jobOne = u.match(/^\/api\/jobs\/(\d+)$/);
        if (jobOne && method === 'GET') {
            var j1 = await restGet('campus_jobs', 'id=eq.' + jobOne[1]);
            return makeResponse(j1[0] || null);
        }

        // ---------- 简历解析（前端已处理，此端点仅作降级提示）----------
        if (u === '/api/resume/parse' && method === 'POST') {
            return makeResponse({ success: false, message: '云端模式请使用前端解析' });
        }

        // ---------- 候选人投递 ----------
        if (u === '/api/candidates/apply' && method === 'POST') {
            var body = opts && opts.body;
            var data = {};
            var resumeFile = null;
            if (body && typeof FormData !== 'undefined' && body instanceof FormData) {
                body.forEach(function (v, k) {
                    // 简历文件单独提取，其余转普通字段
                    if (k === 'resume' && v && typeof v === 'object' && v.name) {
                        resumeFile = v;
                    } else {
                        data[k] = v;
                    }
                });
            } else if (typeof body === 'string') {
                try { data = JSON.parse(body); } catch (e) { data = {}; }
            } else if (body && typeof body === 'object') {
                data = body;
            }

            // 上传简历文件到 Storage（拿到 public URL，供 HR 预览/下载）
            var resumeUrl = null;
            if (resumeFile) {
                try { resumeUrl = await uploadResume(resumeFile); }
                catch (e) { console.warn('[supabase-api] 简历上传失败(非致命):', e.message); }
            }

            // 解析结果（前端 pdf.js 解析后随表单提交）
            var parsed = null;
            if (data.parsed_json) {
                try { parsed = JSON.parse(data.parsed_json); } catch (e) { parsed = null; }
            }

            var candidate = {
                name: data.name || (parsed && parsed.name) || '',
                phone: data.phone || (parsed && parsed.phone) || '',
                email: data.email || (parsed && parsed.email) || '',
                gender: data.gender || (parsed && parsed.gender) || '',
                education: data.education || (parsed && parsed.education) || '',
                school: data.school || (parsed && parsed.school) || '',
                major: data.major || (parsed && parsed.major) || '',
                graduation_year: data.graduation_year ? parseInt(data.graduation_year, 10) : (parsed && parsed.graduationYear) || null,
                gpa: data.gpa || (parsed && parsed.gpa) || '',
                skills: (parsed && parsed.skills) ? parsed.skills : [],
                experience: (parsed && parsed.experience) || '',
                projects: (parsed && parsed.projects) || '',
                certifications: (parsed && parsed.certifications) || '',
                self_intro: data.self_intro || '',
                preferred_category: data.preferred_category || '',
                preferred_location: data.preferred_location || '',
                native_place: data.native_place || '',
                source: data.source || 'online',
                applied_job_id: data.applied_job_id ? parseInt(data.applied_job_id, 10) : null,
                resume_original_name: data.resume_name || (resumeFile && resumeFile.name) || '',
                resume_file_path: resumeUrl,
                resume_parsed: parsed ? 1 : 0,
                parsed_data: parsed || null,
                status: 'pending'
            };

            // 生成岗位推荐
            var recommendations = [];
            try {
                var openJobs = await restGet('campus_jobs', 'status=eq.open&order=created_at.desc');
                if (window.ResumeParser && typeof ResumeParser.recommendJobs === 'function') {
                    var recData = {
                        education: candidate.education,
                        skills: candidate.skills,
                        major: candidate.major,
                        preferred_category: candidate.preferred_category
                    };
                    recommendations = ResumeParser.recommendJobs(recData, openJobs, null).slice(0, 5);
                }
            } catch (recErr) {
                console.warn('[supabase-api] 推荐生成失败(非致命):', recErr.message);
            }

            var cid = await rpc('campus_submit_candidate', {
                payload: Object.assign({}, candidate, { recommendations: recommendations })
            });

            return makeResponse({
                id: cid,
                message: '投递成功',
                parsed: parsed ? true : false,
                parsedData: parsed
            });
        }

        // ---------- MBTI 验证（公开）----------
        var verifyMatch = u.match(/^\/api\/candidates\/(\d+)\/verify$/);
        if (verifyMatch && method === 'GET') {
            var v = await rpc('campus_verify_candidate', { cid: parseInt(verifyMatch[1], 10) });
            if (!v || v.exists !== true) return makeErrorResponse(404, '候选人不存在');
            return makeResponse({ exists: true, name: v.name });
        }

        // ---------- MBTI 提交（公开）----------
        var mbtiMatch = u.match(/^\/api\/candidates\/(\d+)\/mbti$/);
        if (mbtiMatch && method === 'POST') {
            var cid2 = parseInt(mbtiMatch[1], 10);
            var mbtiData = {};
            try { mbtiData = JSON.parse(opts.body); } catch (e) { mbtiData = {}; }
            await rpc('campus_submit_mbti', {
                cid: cid2,
                mbti_type: mbtiData.mbti_type,
                mbti_scores: mbtiData.mbti_scores || {},
                preferred_category: mbtiData.preferred_category || ''
            });
            // 重新计算推荐并返回
            var recommendations2 = [];
            try {
                var openJobs2 = await restGet('campus_jobs', 'status=eq.open');
                var candRow = await restGet('campus_candidates', 'id=eq.' + cid2);
                if (candRow.length > 0 && window.ResumeParser) {
                    var c2 = candRow[0];
                    var recData2 = {
                        education: c2.education,
                        skills: c2.skills || [],
                        major: c2.major,
                        preferred_category: mbtiData.preferred_category || c2.preferred_category
                    };
                    recommendations2 = ResumeParser.recommendJobs(recData2, openJobs2, mbtiData.mbti_type).slice(0, 5);
                }
            } catch (e) { /* 推荐失败忽略 */ }
            return makeResponse({ message: 'MBTI测试结果已保存', recommendations: recommendations2 });
        }

        // ---------- HR 认证 ----------
        if (u === '/api/auth/login' && method === 'POST') {
            var cred = {};
            try { cred = JSON.parse(opts.body); } catch (e) { cred = {}; }
            var loginRes = await rpc('campus_hr_login', { username: cred.username, password: cred.password });
            if (!loginRes || loginRes.ok !== true) {
                return makeErrorResponse(401, (loginRes && loginRes.error) || '登录失败');
            }
            // 存会话到 localStorage（用户信息 + 登录后下发的口令）
            try {
                localStorage.setItem('campus_admin_session', JSON.stringify({
                    user: loginRes.user,
                    passcode: loginRes.passcode || ''
                }));
            } catch (e) {}
            return makeResponse({ user: loginRes.user });
        }

        if (u === '/api/auth/logout' && method === 'POST') {
            try { localStorage.removeItem('campus_admin_session'); } catch (e) {}
            return makeResponse({ ok: true });
        }

        if (u === '/api/auth/me' && method === 'GET') {
            try {
                var s = JSON.parse(localStorage.getItem('campus_admin_session') || '{}');
                if (s.user) return makeResponse({ user: s.user });
            } catch (e) {}
            return makeErrorResponse(401, '未登录');
        }

        // ---------- HR 岗位管理 ----------
        if (u === '/api/admin/jobs' && method === 'GET') {
            var r = await rpc('campus_hr_get_jobs', { passcode: getPasscode() });
            if (!r || r.ok !== true) return makeErrorResponse(401, r && r.error);
            return makeResponse(r.jobs);
        }
        if (u === '/api/admin/jobs' && method === 'POST') {
            var jb = {};
            try { jb = JSON.parse(opts.body); } catch (e) { jb = {}; }
            var r1 = await rpc('campus_hr_upsert_job', { passcode: getPasscode(), payload: jb });
            if (!r1 || r1.ok !== true) return makeErrorResponse(401, r1 && r1.error);
            return makeResponse({ id: r1.id, message: '岗位创建成功' });
        }
        var jobEdit = u.match(/^\/api\/admin\/jobs\/(\d+)$/);
        if (jobEdit && method === 'PUT') {
            var jb2 = {};
            try { jb2 = JSON.parse(opts.body); } catch (e) { jb2 = {}; }
            jb2.id = parseInt(jobEdit[1], 10);
            var r2 = await rpc('campus_hr_upsert_job', { passcode: getPasscode(), payload: jb2 });
            if (!r2 || r2.ok !== true) return makeErrorResponse(401, r2 && r2.error);
            return makeResponse({ message: '岗位更新成功' });
        }
        if (jobEdit && method === 'DELETE') {
            var r3 = await rpc('campus_hr_delete_job', { passcode: getPasscode(), jid: parseInt(jobEdit[1], 10) });
            if (!r3 || r3.ok !== true) return makeErrorResponse(401, r3 && r3.error);
            return makeResponse({ message: '岗位已删除' });
        }

        // ---------- HR 候选人管理 ----------
        if (u.match(/^\/api\/admin\/candidates(\?|$)/) && method === 'GET') {
            var params = {};
            try {
                var urlObj = new URL('http://x' + u);
                urlObj.searchParams.forEach(function (v, k) { params[k] = v; });
            } catch (e) {}
            var filters = {};
            if (params.education) filters.education = params.education;
            if (params.status) filters.status = params.status;
            if (params.category) filters.category = params.category;
            if (params.mbti_type) filters.mbti_type = params.mbti_type;
            if (params.native_place) filters.native_place = params.native_place;
            if (params.keyword) filters.keyword = params.keyword;
            var r4 = await rpc('campus_hr_get_candidates', { passcode: getPasscode(), filters: filters });
            if (!r4 || r4.ok !== true) return makeErrorResponse(401, r4 && r4.error);
            return makeResponse(r4.candidates);
        }

        var candDetail = u.match(/^\/api\/admin\/candidates\/(\d+)$/);
        if (candDetail && method === 'GET') {
            var r5 = await rpc('campus_hr_get_candidate', { passcode: getPasscode(), cid: parseInt(candDetail[1], 10) });
            if (!r5 || r5.ok !== true) return makeErrorResponse(404, r5 && r5.error);
            var c5 = r5.candidate;
            c5.recommendations = r5.recommendations;
            return makeResponse(c5);
        }
        if (candDetail && method === 'PUT') {
            var cu = {};
            try { cu = JSON.parse(opts.body); } catch (e) { cu = {}; }
            delete cu.recommendations;
            var r6 = await rpc('campus_hr_update_candidate', { passcode: getPasscode(), cid: parseInt(candDetail[1], 10), payload: cu });
            if (!r6 || r6.ok !== true) return makeErrorResponse(401, r6 && r6.error);
            return makeResponse({ message: '更新成功' });
        }
        if (candDetail && method === 'DELETE') {
            var r7 = await rpc('campus_hr_delete_candidate', { passcode: getPasscode(), cid: parseInt(candDetail[1], 10) });
            if (!r7 || r7.ok !== true) return makeErrorResponse(401, r7 && r7.error);
            return makeResponse({ message: '已删除' });
        }

        // ---------- HR 统计 ----------
        if (u === '/api/admin/stats' && method === 'GET') {
            var r8 = await rpc('campus_hr_get_stats', { passcode: getPasscode() });
            if (!r8 || r8.ok !== true) return makeErrorResponse(401, r8 && r8.error);
            return makeResponse(r8.stats);
        }

        // ================================================================
        // 协作功能端点
        // ================================================================

        // 用户管理
        if (u === '/api/collab/users' && method === 'GET') {
            var ru = await rpc('campus_collab_users', { passcode: getPasscode() });
            if (!ru || ru.ok !== true) return makeErrorResponse(401, ru && ru.error);
            return makeResponse(ru.users);
        }
        if (u === '/api/collab/users' && method === 'POST') {
            var nb = {}; try { nb = JSON.parse(opts.body); } catch (e) { nb = {}; }
            var ru2 = await rpc('campus_user_create', { passcode: getPasscode(), payload: nb });
            if (!ru2 || ru2.ok !== true) return makeErrorResponse(400, ru2 && ru2.error);
            return makeResponse(ru2);
        }
        var userEdit = u.match(/^\/api\/collab\/users\/(\d+)$/);
        if (userEdit && method === 'PUT') {
            var ub = {}; try { ub = JSON.parse(opts.body); } catch (e) { ub = {}; }
            var ru3 = await rpc('campus_user_update', { passcode: getPasscode(), uid: parseInt(userEdit[1], 10), payload: ub });
            if (!ru3 || ru3.ok !== true) return makeErrorResponse(400, ru3 && ru3.error);
            return makeResponse(ru3);
        }
        if (userEdit && method === 'DELETE') {
            var ru4 = await rpc('campus_user_delete', { passcode: getPasscode(), uid: parseInt(userEdit[1], 10) });
            if (!ru4 || ru4.ok !== true) return makeErrorResponse(400, ru4 && ru4.error);
            return makeResponse(ru4);
        }

        // 候选人评论
        var commentsMatch = u.match(/^\/api\/collab\/candidates\/(\d+)\/comments$/);
        if (commentsMatch && method === 'GET') {
            var rc = await rpc('campus_collab_comments', { passcode: getPasscode(), cid: parseInt(commentsMatch[1], 10) });
            if (!rc || rc.ok !== true) return makeErrorResponse(401, rc && rc.error);
            return makeResponse(rc.comments);
        }
        if (commentsMatch && method === 'POST') {
            var cb = {}; try { cb = JSON.parse(opts.body); } catch (e) { cb = {}; }
            var cu2 = getCurrentUser() || {};
            var rc2 = await rpc('campus_comment_add', { passcode: getPasscode(), cid: parseInt(commentsMatch[1], 10), user_id: cu2.id, user_name: cu2.name || '', content: cb.content });
            if (!rc2 || rc2.ok !== true) return makeErrorResponse(400, rc2 && rc2.error);
            return makeResponse(rc2);
        }
        var commentDel = u.match(/^\/api\/collab\/comments\/(\d+)$/);
        if (commentDel && method === 'DELETE') {
            var rc3 = await rpc('campus_comment_delete', { passcode: getPasscode(), comment_id: parseInt(commentDel[1], 10) });
            if (!rc3 || rc3.ok !== true) return makeErrorResponse(400, rc3 && rc3.error);
            return makeResponse(rc3);
        }

        // 评估分配
        var assignMatch = u.match(/^\/api\/collab\/candidates\/(\d+)\/assignments$/);
        if (assignMatch && method === 'GET') {
            var ra = await rpc('campus_collab_assignments', { passcode: getPasscode(), cid: parseInt(assignMatch[1], 10) });
            if (!ra || ra.ok !== true) return makeErrorResponse(401, ra && ra.error);
            return makeResponse(ra.assignments);
        }
        if (assignMatch && method === 'POST') {
            var ab = {}; try { ab = JSON.parse(opts.body); } catch (e) { ab = {}; }
            var cu3 = getCurrentUser() || {};
            var ra2 = await rpc('campus_assignment_add', { passcode: getPasscode(), cid: parseInt(assignMatch[1], 10), assigned_to: parseInt(ab.assigned_to, 10), assigned_by: cu3.id });
            if (!ra2 || ra2.ok !== true) return makeErrorResponse(400, ra2 && ra2.error);
            return makeResponse(ra2);
        }
        var assignDel = u.match(/^\/api\/collab\/assignments\/(\d+)$/);
        if (assignDel && method === 'DELETE') {
            var ra3 = await rpc('campus_assignment_delete', { passcode: getPasscode(), aid: parseInt(assignDel[1], 10) });
            if (!ra3 || ra3.ok !== true) return makeErrorResponse(400, ra3 && ra3.error);
            return makeResponse(ra3);
        }

        // 评估打分
        var evalMatch = u.match(/^\/api\/collab\/candidates\/(\d+)\/evaluations$/);
        if (evalMatch && method === 'GET') {
            var re = await rpc('campus_collab_evaluations', { passcode: getPasscode(), cid: parseInt(evalMatch[1], 10) });
            if (!re || re.ok !== true) return makeErrorResponse(401, re && re.error);
            return makeResponse({ evaluations: re.evaluations, summary: re.summary });
        }
        if (evalMatch && method === 'POST') {
            var eb = {}; try { eb = JSON.parse(opts.body); } catch (e) { eb = {}; }
            var cu4 = getCurrentUser() || {};
            var scores = eb.scores || {};
            // 计算综合分（权重同 collab.js calcOverall）
            var weights = { professional: 0.3, communication: 0.2, potential: 0.2, culture_fit: 0.3 };
            var sum = 0, wsum = 0;
            for (var k in scores) { if (weights[k] && scores[k] != null) { sum += scores[k] * weights[k]; wsum += weights[k]; } }
            var overall = wsum > 0 ? sum / wsum : 0;
            var re2 = await rpc('campus_evaluation_submit', { passcode: getPasscode(), cid: parseInt(evalMatch[1], 10), evaluator_id: cu4.id, evaluator_name: cu4.name || '', scores: scores, overall_score: overall, comment: eb.comment || '', recommendation: eb.recommendation || 'neutral' });
            if (!re2 || re2.ok !== true) return makeErrorResponse(400, re2 && re2.error);
            return makeResponse(re2);
        }

        // 建议板
        if (u === '/api/collab/suggestions' && method === 'GET') {
            var rs = await rpc('campus_collab_suggestions', { passcode: getPasscode() });
            if (!rs || rs.ok !== true) return makeErrorResponse(401, rs && rs.error);
            return makeResponse(rs.suggestions);
        }
        if (u === '/api/collab/suggestions' && method === 'POST') {
            var sb = {}; try { sb = JSON.parse(opts.body); } catch (e) { sb = {}; }
            var cu5 = getCurrentUser() || {};
            var rs2 = await rpc('campus_suggestion_add', { passcode: getPasscode(), user_id: cu5.id, user_name: cu5.name || '', title: sb.title, content: sb.content, category: sb.category });
            if (!rs2 || rs2.ok !== true) return makeErrorResponse(400, rs2 && rs2.error);
            return makeResponse(rs2);
        }
        var sugVote = u.match(/^\/api\/collab\/suggestions\/(\d+)\/vote$/);
        if (sugVote && method === 'POST') {
            var cu6 = getCurrentUser() || {};
            var rs3 = await rpc('campus_suggestion_vote', { passcode: getPasscode(), sid: parseInt(sugVote[1], 10), user_id: cu6.id });
            if (!rs3 || rs3.ok !== true) return makeErrorResponse(400, rs3 && rs3.error);
            return makeResponse(rs3);
        }
        var sugComment = u.match(/^\/api\/collab\/suggestions\/(\d+)\/comments$/);
        if (sugComment && method === 'POST') {
            var scb = {}; try { scb = JSON.parse(opts.body); } catch (e) { scb = {}; }
            var cu7 = getCurrentUser() || {};
            var rs4 = await rpc('campus_suggestion_comment', { passcode: getPasscode(), sid: parseInt(sugComment[1], 10), user_id: cu7.id, user_name: cu7.name || '', content: scb.content });
            if (!rs4 || rs4.ok !== true) return makeErrorResponse(400, rs4 && rs4.error);
            return makeResponse(rs4);
        }
        var sugStatus = u.match(/^\/api\/collab\/suggestions\/(\d+)\/status$/);
        if (sugStatus && method === 'PUT') {
            var stb = {}; try { stb = JSON.parse(opts.body); } catch (e) { stb = {}; }
            var rs5 = await rpc('campus_suggestion_status', { passcode: getPasscode(), sid: parseInt(sugStatus[1], 10), status: stb.status });
            if (!rs5 || rs5.ok !== true) return makeErrorResponse(400, rs5 && rs5.error);
            return makeResponse(rs5);
        }

        // 活动日志
        if (u.match(/^\/api\/collab\/activities(\?|$)/) && method === 'GET') {
            var lim = 50;
            var lm = u.match(/limit=(\d+)/);
            if (lm) lim = parseInt(lm[1], 10);
            var ract = await rpc('campus_collab_activities', { passcode: getPasscode(), lim: lim });
            if (!ract || ract.ok !== true) return makeErrorResponse(401, ract && ract.error);
            return makeResponse(ract.activities);
        }

        // ================================================================
        // AI 初试（预约时段 / 面试会话 / 准时记录）— 候选人公开端 + HR 端
        // 对应 supabase/ai-interview-integration.sql 中的 campus_* 函数
        // ================================================================

        // 解析查询参数
        function parseQuery(u) {
            var p = {};
            try {
                var uo = new URL('http://x' + u);
                uo.searchParams.forEach(function (v, k) { p[k] = v; });
            } catch (e) {}
            return p;
        }

        // 北京时间日期字符串 YYYY-MM-DD
        function cnDateStr(offsetDays) {
            var now = new Date();
            var d = new Date(now.getTime() + ((offsetDays || 0) * 86400000) + (now.getTimezoneOffset() * 60000) + 8 * 3600000);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }

        // 查询可预约时段（公开）
        if (u === '/api/interview/slots' && method === 'GET') {
            var sq = parseQuery(u);
            var from = sq.from || cnDateStr(0);
            var to = sq.to || cnDateStr(13);
            var sr = await rpc('campus_get_slots', { p_from: from, p_to: to });
            return makeResponse(Array.isArray(sr) ? sr : []);
        }

        // 预约时段（公开）
        if (u === '/api/interview/book' && method === 'POST') {
            var bd = {};
            try { bd = JSON.parse(opts.body); } catch (e) { bd = {}; }
            var br = await rpc('campus_book_slot', {
                p_candidate_id: bd.candidate_id ? parseInt(bd.candidate_id, 10) : null,
                p_slot_id: parseInt(bd.slot_id, 10),
                p_name: bd.name || '',
                p_phone: bd.phone || '',
                p_applied_job: bd.applied_job || '',
                p_job_category: bd.job_category || ''
            });
            if (!br || br.ok !== true) return makeErrorResponse(400, br && br.error || '预约失败');
            return makeResponse(br);
        }

        // 查询我的预约（公开：手机号+姓名）
        if (u === '/api/interview/my' && method === 'GET') {
            var mq = parseQuery(u);
            var mr = await rpc('campus_get_my_sessions', { p_phone: mq.phone || '', p_name: mq.name || '' });
            return makeResponse(Array.isArray(mr) ? mr : []);
        }

        // 验证面试入场（公开：预约码+手机号）
        if (u === '/api/interview/verify' && method === 'POST') {
            var vd = {};
            try { vd = JSON.parse(opts.body); } catch (e) { vd = {}; }
            var vr = await rpc('campus_verify_session', { p_code: vd.code || '', p_phone: vd.phone || '' });
            if (!vr || vr.ok !== true) return makeErrorResponse(404, vr && vr.error || '校验失败');
            return makeResponse(vr);
        }

        // 开始面试（公开）：记录实际进入时间 + 准时量化
        if (u === '/api/interview/start' && method === 'POST') {
            var sd = {};
            try { sd = JSON.parse(opts.body); } catch (e) { sd = {}; }
            var sr2 = await rpc('campus_mark_interview_start', { p_code: sd.code || '', p_phone: sd.phone || '' });
            if (!sr2 || sr2.ok !== true) return makeErrorResponse(400, sr2 && sr2.error || '开始失败');
            return makeResponse(sr2);
        }

        // 提交面试结果（公开）
        if (u === '/api/interview/submit' && method === 'POST') {
            var tm = {};
            try { tm = JSON.parse(opts.body); } catch (e) { tm = {}; }
            var tr = await rpc('campus_submit_interview', {
                p_code: tm.code || '',
                p_phone: tm.phone || '',
                p_summary: tm.summary || {},
                p_overall: tm.overall != null ? tm.overall : 0
            });
            if (!tr || tr.ok !== true) return makeErrorResponse(400, tr && tr.error || '提交失败');
            return makeResponse(tr);
        }

        // ---------- HR：AI 初试管理 ----------
        if (u === '/api/admin/interview/slots' && method === 'POST') {
            var gd = {};
            try { gd = JSON.parse(opts.body); } catch (e) { gd = {}; }
            var gr = await rpc('campus_hr_generate_slots', {
                p_passcode: getPasscode(), p_start: gd.start || cnDateStr(1),
                p_days: gd.days || 7, p_start_hour: gd.start_hour || 9, p_end_hour: gd.end_hour || 18,
                p_slot_minutes: gd.slot_minutes || 30, p_capacity: gd.capacity || 3
            });
            if (!gr || gr.ok !== true) return makeErrorResponse(401, gr && gr.error);
            return makeResponse(gr);
        }
        if (u === '/api/admin/interview/slots' && method === 'GET') {
            var gq = parseQuery(u);
            var gl = await rpc('campus_hr_get_slots', { p_passcode: getPasscode(), p_from: gq.from || null, p_to: gq.to || null });
            if (!gl || gl.ok !== true) return makeErrorResponse(401, gl && gl.error);
            return makeResponse(gl.slots || []);
        }
        var slotStatus = u.match(/^\/api\/admin\/interview\/slots\/(\d+)\/status$/);
        if (slotStatus && method === 'PUT') {
            var ss = {}; try { ss = JSON.parse(opts.body); } catch (e) { ss = {}; }
            var ssr = await rpc('campus_hr_set_slot_status', { p_passcode: getPasscode(), p_slot_id: parseInt(slotStatus[1], 10), p_status: ss.status || 'closed' });
            if (!ssr || ssr.ok !== true) return makeErrorResponse(401, ssr && ssr.error);
            return makeResponse(ssr);
        }
        if (u === '/api/admin/interview/sessions' && method === 'GET') {
            var isq = parseQuery(u);
            var filt = {};
            if (isq.status) filt.status = isq.status;
            if (isq.keyword) filt.keyword = isq.keyword;
            var ir = await rpc('campus_hr_get_interview_sessions', { p_passcode: getPasscode(), p_filters: filt });
            if (!ir || ir.ok !== true) return makeErrorResponse(401, ir && ir.error);
            return makeResponse(ir.sessions || []);
        }
        if (u === '/api/admin/interview/stats' && method === 'GET') {
            var st = await rpc('campus_hr_get_interview_stats', { p_passcode: getPasscode() });
            if (!st || st.ok !== true) return makeErrorResponse(401, st && st.error);
            return makeResponse(st.stats || {});
        }

        // ---------- 未支持的端点（文件上传/下载等）----------
        console.warn('[supabase-api] 未匹配/未实现的 API:', method, u);
        return makeErrorResponse(501, '该功能暂未在云端模式实现: ' + u);
    }

    // ================================================================
    // 拦截 window.fetch
    // ================================================================

    window.fetch = function (url, opts) {
        var u = String(url);
        if (u.match(/^\/?api\//) || u.match(/^https?:\/\/[^/]+\/api\//)) {
            return handleApiRequest(u, opts).catch(function (err) {
                console.error('[supabase-api] 请求失败:', err.message);
                return makeErrorResponse(500, err.message);
            });
        }
        return originalFetch.apply(this, arguments);
    };
})();

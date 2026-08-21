const fs = require('fs');
const path = require('path');
const dir = 'D:/WorkBuddy/2026-08-21-09-12-04/honess-campus-ai/website';
const files = ['index.html','jobs.html','apply.html','mbti.html','admin.html','schedule.html','ai-interview.html'];

// 1) href="/" -> href="index.html"
function fixHome(s){
  return s
    .replace(/href=(["'])\s*\/(["'])/g, (m,q,q2)=>`href=${q}index.html${q2}`)
    .replace(/href=(["'])\/\?/g,(m,q)=>`href=${q}index.html?`);
}

// 2) /apply?xxx -> apply.html?xxx
function fixApply(s){
  return s
    .replace(/href=(["'])\/apply\?/g, (m,q)=>`href=${q}apply.html?`)
    .replace(/href=(["'])\/apply(["'])/g,(m,q,q2)=>`href=${q}apply.html${q2}`);
}

// 3) 仅处理 HTML 标签属性内的绝对路径（绝不触碰内联 JS / 正则字面量）
//    attr="/xxx(.yyy)(?query)" -> attr="xxx(.yyy)(?query)"
//    排除 /api/（Supabase 拦截层保留）与协议相对 //
function fixAttrAbs(s){
  return s.replace(
    /((?:href|src|action|poster|data-src|data-href|data-bg|data-background|background)\s*=\s*)(["'])\/(?!\/)(?!api\/)([^"']*["'])/g,
    (m,pre,q,rest)=>pre+q+rest
  );
}

for(const f of files){
  const fp = path.join(dir,f);
  let s = fs.readFileSync(fp,'utf8');
  const before = s;
  s = fixHome(s);
  s = fixApply(s);
  s = fixAttrAbs(s);
  fs.writeFileSync(fp,s);
  // 逐字符对比仅在长度一致时准确；此处仅作提示
  let n = 0;
  for(let i=0;i<Math.min(before.length,s.length);i++) if(before[i]!==s[i]) n++;
  console.log(f, 'changed chars:', n);
}

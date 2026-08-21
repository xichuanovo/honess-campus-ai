/**
 * API 离线兜底 — 当后端不可用时（静态部署场景），使用内置数据 + localStorage
 * 确保 UI 完整可见，候选人投递数据存浏览器本地
 */
(function () {
    'use strict';

    // ===== 内置岗位数据（与后端 seedJobs 一致）=====
    var DEMO_JOBS = [
        { id: 1, title: '环保研发工程师', category: 'tech', education_min: 'master', location: '上海', headcount: 3, salary_range: '15-25K', status: 'open',
          description: '负责工业废水/市政污水处理新工艺研发、技术路线规划与实验验证，参与核心工艺包设计优化。',
          requirements: '环境工程、化学工程、给排水等相关专业硕士及以上；熟悉水处理工艺原理，有实验室研究经验；具备数据分析与报告撰写能力。',
          responsibilities: '1. 开展水处理新工艺实验研究与数据分析\n2. 撰写技术方案与研发报告\n3. 参与工艺包设计和技术评审\n4. 跟踪行业前沿技术动态' },
        { id: 2, title: '环保项目经理', category: 'project', education_min: 'bachelor', location: '上海/全国项目地', headcount: 5, salary_range: '12-20K', status: 'open',
          description: '负责水处理工程项目全周期管理，包括进度、质量、成本、安全管控，协调内外部资源确保项目交付。',
          requirements: '环境工程、土木工程、工程管理等相关专业本科及以上；有工程项目实习经验优先；具备较强的沟通协调和组织能力。',
          responsibilities: '1. 编制项目执行计划并跟踪落实\n2. 管理施工现场进度与质量安全\n3. 协调业主、设计、施工等各方关系\n4. 控制项目成本与变更' },
        { id: 3, title: '商务拓展专员', category: 'business', education_min: 'bachelor', location: '上海/全国', headcount: 4, salary_range: '10-18K + 提成', status: 'open',
          description: '负责水处理项目市场开拓与客户开发，建立并维护客户关系，推动项目签约落地。',
          requirements: '专业不限，环境/化工/市场营销相关专业优先；性格外向，沟通能力强；有销售实习经验者优先；能接受出差。',
          responsibilities: '1. 开发目标客户并建立客户档案\n2. 组织项目前期技术交流与方案推介\n3. 跟踪项目招投标流程\n4. 维护客户关系与回款管理' },
        { id: 4, title: '运营维护工程师', category: 'operations', education_min: 'bachelor', location: '全国项目地', headcount: 6, salary_range: '8-14K', status: 'open',
          description: '负责水处理设施的日常运营维护、设备巡检、水质监测与异常处理，确保设施稳定运行。',
          requirements: '环境工程、机电、自动化等相关专业本科及以上；有设备运维实习经验优先；能接受倒班和项目地驻扎；动手能力强。',
          responsibilities: '1. 执行设施日常巡检与维护\n2. 监测水质指标并调整工艺参数\n3. 处理设备故障与突发异常\n4. 填写运行记录与交接班报告' },
        { id: 5, title: '质量安全工程师', category: 'support', education_min: 'bachelor', location: '上海', headcount: 2, salary_range: '10-16K', status: 'open',
          description: '负责公司质量管理体系运行、安全生产监督与合规管理，确保项目与运营符合法规标准。',
          requirements: '环境/安全/质量管理相关专业本科及以上；了解ISO体系或安全生产法规；做事严谨细致，原则性强。',
          responsibilities: '1. 推进质量管理体系运行与内审\n2. 开展安全巡检与隐患排查\n3. 组织安全培训与应急演练\n4. 管理合规文件与台账' },
        { id: 6, title: '人力资源专员', category: 'support', education_min: 'bachelor', location: '上海', headcount: 2, salary_range: '9-15K', status: 'open',
          description: '参与招聘全流程执行、员工关系管理、培训组织等HR工作，支持公司人才发展与组织建设。',
          requirements: '人力资源管理、心理学、管理学等相关专业本科及以上；良好的沟通表达与组织协调能力；有HR实习经验优先。',
          responsibilities: '1. 执行招聘需求发布、简历筛选与面试安排\n2. 管理员工入离职与人事档案\n3. 组织培训与团建活动\n4. 协助薪酬绩效数据整理' }
    ];

    var STORAGE_KEY = 'honess_candidates';
    var MBTI_KEY = 'honess_mbti';

    function getCandidates() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function saveCandidate(c) {
        var list = getCandidates();
        c.id = list.length + 1;
        c.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
        c.status = 'pending';
        list.push(c);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        return c;
    }
    function getMbtiResults() {
        try { return JSON.parse(localStorage.getItem(MBTI_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function saveMbti(cid, data) {
        var all = getMbtiResults();
        all[cid] = data;
        localStorage.setItem(MBTI_KEY, JSON.stringify(all));
    }

    // 检测是否在静态部署环境（无后端）
    var hasBackend = null;
    function checkBackend() {
        return fetch('/api/jobs', { method: 'GET' })
            .then(function (r) { return r.ok; })
            .catch(function () { return false; });
    }

    // 原始 fetch
    var originalFetch = window.fetch;
    window.fetch = function (url, opts) {
        return originalFetch(url, opts).catch(function () {
            // 网络失败，走兜底
            return fallbackResponse(url, opts);
        });
    };

    function fallbackResponse(url, opts) {
        var u = String(url);
        var method = (opts && opts.method) || 'GET';

        var body = {
            json: function () {
                return Promise.resolve(parseFallback(u, method, opts));
            },
            text: function () {
                return Promise.resolve(JSON.stringify(parseFallback(u, method, opts)));
            },
            ok: true,
            status: 200
        };
        return Promise.resolve(body);
    }

    function parseFallback(url, method, opts) {
        // GET /api/jobs
        if (url.match(/^\/api\/jobs(\?|$)/) && method === 'GET') {
            return DEMO_JOBS;
        }
        // GET /api/jobs/:id
        var m = url.match(/^\/api\/jobs\/(\d+)/);
        if (m) {
            return DEMO_JOBS.find(function (j) { return j.id === parseInt(m[1]); }) || DEMO_JOBS[0];
        }
        // POST /api/candidates/apply
        if (url.match(/^\/api\/candidates\/apply/) && method === 'POST') {
            var formData = opts && opts.body;
            var data = {};
            if (formData && typeof FormData !== 'undefined' && formData instanceof FormData) {
                formData.forEach(function (v, k) { data[k] = v; });
            }
            var saved = saveCandidate(data);
            return { id: saved.id, message: '投递成功（离线模式，数据已存本地）', parsed: false, parsedData: null, offline: true };
        }
        // GET /api/admin/candidates
        if (url.match(/^\/api\/admin\/candidates/) && method === 'GET') {
            return getCandidates();
        }
        // GET /api/admin/stats
        if (url.match(/^\/api\/admin\/stats/) && method === 'GET') {
            var candidates = getCandidates();
            var byEdu = {};
            candidates.forEach(function (c) {
                var e = c.education || 'unknown';
                byEdu[e] = (byEdu[e] || 0) + 1;
            });
            var mbtiDone = Object.keys(getMbtiResults()).length;
            return {
                totalCandidates: candidates.length,
                pendingReview: candidates.filter(function (c) { return c.status === 'pending'; }).length,
                mbtiCompleted: mbtiDone,
                totalJobs: DEMO_JOBS.length,
                byEducation: byEdu,
                byCategory: {},
                byMbti: {}
            };
        }
        // POST /api/candidates/:id/mbti
        var mbtiMatch = url.match(/^\/api\/candidates\/(\d+)\/mbti/);
        if (mbtiMatch && method === 'POST') {
            var cid = mbtiMatch[1];
            var bodyData = opts && opts.body ? JSON.parse(opts.body) : {};
            saveMbti(cid, bodyData);
            return { message: 'MBTI 已保存（离线模式）', recommendations: [] };
        }
        // 默认空响应
        return {};
    }

    // 在控制台提示
    console.log('[api-fallback] 离线兜底已加载，后端不可用时自动使用本地数据');
})();

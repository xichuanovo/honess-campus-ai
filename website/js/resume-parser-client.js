/**
 * resume-parser-client.js — 前端简历解析模块（上云版）
 * 把原 Node 端 resumeParser.js 的解析逻辑完整移植到浏览器运行
 * 用 pdf.js 在前端提取 PDF 文本（替代 Node 的 pdf-parse）
 *
 * 用法：
 *   <script src="/js/pdf.min.js"></script>
 *   <script src="/js/resume-parser-client.js"></script>
 *   const result = await ResumeParser.parseFile(file);
 *   // result = { success, text, name, phone, email, gender, education, school, major, graduationYear, gpa, skills, experience, projects, certifications }
 */
(function () {
    'use strict';

    // ================================================================
    // 信息提取（从 utils/resumeParser.js 的 extractInfo 完整移植）
    // ================================================================

    function extractInfo(text) {
        var result = {
            name: '', phone: '', email: '', gender: '', education: '',
            school: '', major: '', graduationYear: null, gpa: '',
            skills: [], experience: '', projects: '', certifications: ''
        };

        if (!text) return result;

        // 手机号
        var phoneMatch = text.match(/1[3-9]\d{9}/);
        if (phoneMatch) result.phone = phoneMatch[0];

        // 邮箱
        var emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        if (emailMatch) result.email = emailMatch[0];

        // 姓名
        {
            var excludeStarts = ['福州', '同济', '清华', '北大', '华东', '个人', '简历', '教育', '环境', '专业', '福建', '上海', '北京', '江苏', '浙江', '广东', '山东', '四川', '湖南', '湖北', '硕士', '博士', '本科', '研究', '校园', '项目', '实习', '工作', '技能', '证书', '自我', '获奖', '深圳', '杭州', '南京', '武汉', '成都', '西安', '天津', '重庆', '青岛', '大连', '沈阳', '长春', '哈尔滨', '济南', '郑州', '合肥', '南昌', '昆明', '贵阳', '兰州', '太原', '石家庄', '全日制', '在职'];

            var nameLabelMatch = text.match(/姓\s*名\s*[:：]\s*([\u4e00-\u9fa5]{2,4})/);
            if (nameLabelMatch) {
                result.name = nameLabelMatch[1];
            } else {
                var nameNewlineMatch = text.match(/姓\s*名\s*[:：]?\s*\n\s*([\u4e00-\u9fa5]{2,4})\s*\n/);
                if (nameNewlineMatch) result.name = nameNewlineMatch[1];
            }
            if (!result.name) {
                var lines = text.split(/\n/);
                for (var i = 0; i < lines.length; i++) {
                    var trimmed = lines[i].trim();
                    if (/^[\u4e00-\u9fa5]{2,4}$/.test(trimmed)) {
                        var excluded = excludeStarts.some(function (w) { return trimmed.indexOf(w) === 0; });
                        if (!excluded && trimmed.length >= 2) { result.name = trimmed; break; }
                    }
                }
            }
            if (!result.name) {
                var nameMatch = text.match(/^([\u4e00-\u9fa5]{2,4})[\s\n]/m);
                if (nameMatch) {
                    var excluded2 = excludeStarts.some(function (w) { return nameMatch[1].indexOf(w) === 0; });
                    if (!excluded2) result.name = nameMatch[1];
                }
            }
        }

        // 性别
        if (/男|male/i.test(text.substring(0, 200))) result.gender = '男';
        else if (/女|female/i.test(text.substring(0, 200))) result.gender = '女';

        // 学历
        if (/博士后/.test(text)) result.education = 'postdoc';
        else if (/博士/.test(text)) result.education = 'phd';
        else if (/硕士|研究生/.test(text)) result.education = 'master';
        else if (/本科|学士/.test(text)) result.education = 'bachelor';

        // 毕业年份
        var yearMatch = text.match(/20(1[5-9]|2[0-9])\s*(年)?\s*毕业/);
        if (yearMatch) result.graduationYear = parseInt('20' + yearMatch[1], 10);
        else {
            var yearMatch2 = text.match(/20(2[3-9])\s*届/);
            if (yearMatch2) result.graduationYear = parseInt('20' + yearMatch2[1], 10);
        }

        // 学校和专业（临近配对策略）
        {
            var lines = text.split(/\n/);

            function isValidSchool(name) {
                if (!name || name.length < 3 || name.length > 20) return false;
                if (/大学生/.test(name)) return false;
                var blacklist = ['获得', '第', '届', '竞赛', '条例', '管理规定', '检查表',
                    '规定', '制度', '办法', '通知', '方案', '要求', '日常',
                    '安全文明', '荣誉', '优秀', '精神', '知识竞赛', '技能竞赛',
                    '实验室安全', '获奖', '获奖'];
                return !blacklist.some(function (w) { return name.indexOf(w) > -1; });
            }

            function isValidMajor(name) {
                if (!name || name.length < 2 || name.length > 15) return false;
                var blacklist = ['技能', '知识', '能力', '课程', '描述', '总结', '概述',
                    '获得', '竞赛', '奖项', '安全检查', '管理规定', '日常检查',
                    '获奖', '大学', '学院', '实习', '项目', '参与', '负责'];
                return !blacklist.some(function (w) { return name.indexOf(w) > -1; });
            }

            function extractSchoolFromLine(line) {
                var trimmed = line.trim();
                var m = trimmed.match(/^([\u4e00-\u9fa5A-Za-z\uFF08\uFF09()]{2,15}(?:\u5927\u5b66|\u5b66\u9662))$/);
                if (m && isValidSchool(m[1])) return m[1];
                m = trimmed.match(/(?:毕业(?:院校|学校)|就读(?:院校|学校|于)|院校|学校)\s*[:：]\s*([^\n,，。、\s]{2,30})/);
                if (m) {
                    var name = m[1].trim();
                    name = name.replace(/\s*\d{4}.*$/, '');
                    if (isValidSchool(name)) return name;
                }
                return null;
            }

            function extractMajorFromLine(line) {
                var cleaned = line.trim();
                cleaned = cleaned.replace(/^(?:全日制|在职|函授|业余|自考)?\s*(?:本科|硕士|博士|研究生|大专|专科)\s*/, '');
                cleaned = cleaned.replace(/^(?:所学专业|专业(?:方向)?|方向)\s*[:：]?\s*/, '');
                cleaned = cleaned.replace(/\s*[(（].*$/, '');
                cleaned = cleaned.replace(/\s*\d{4}.*$/, '');
                cleaned = cleaned.trim();
                if (!cleaned || cleaned.length < 2 || cleaned.length > 15) return null;
                if (/(?:工程|科学|技术|管理|化学|生物|环境|机械|自动化|土木|水利|建筑|能源|材料|食品|农学|医学|药学|法学|经济|金融|会计|教育|师范|计算机|软件|通信|电子|信息|安全|物流|电商|旅游|设计|艺术|英语|日语|中文|数学|物理)$/.test(cleaned)) {
                    if (!isValidMajor(cleaned)) return null;
                    return cleaned;
                }
                return null;
            }

            // 策略1：标签匹配
            {
                var schoolLabelMatch = text.match(/(?:毕业(?:院校|学校)|就读(?:院校|学校|于)|院校|学校)\s*[:：]\s*([^\n,，。、\s]{2,30})/);
                if (schoolLabelMatch) {
                    var sn = schoolLabelMatch[1].trim().replace(/\s*\d{4}.*$/, '');
                    if (isValidSchool(sn)) result.school = sn;
                }
                var majorLabelMatch = text.match(/(?:所学专业|专业方向)\s*[:：]\s*([^\n,，。、\s]{2,30})/);
                if (majorLabelMatch) {
                    var mn = majorLabelMatch[1].trim().replace(/^(?:全日制|在职|函授|业余|自考)?\s*(?:本科|硕士|博士|研究生|大专|专科)\s*/, '');
                    if (isValidMajor(mn)) result.major = mn;
                }
            }

            // 策略2：临近配对
            if (!result.school || !result.major) {
                var schoolCandidates = [];
                var majorCandidates = [];
                for (var i = 0; i < lines.length; i++) {
                    var sc = extractSchoolFromLine(lines[i]);
                    if (sc) schoolCandidates.push({ school: sc, lineIndex: i });
                    var mc = extractMajorFromLine(lines[i]);
                    if (mc) majorCandidates.push({ major: mc, lineIndex: i });
                }
                var bestPair = null, bestDist = Infinity;
                for (var a = 0; a < schoolCandidates.length; a++) {
                    for (var b = 0; b < majorCandidates.length; b++) {
                        var dist = Math.abs(schoolCandidates[a].lineIndex - majorCandidates[b].lineIndex);
                        if (dist <= 5 && dist < bestDist) {
                            bestDist = dist;
                            bestPair = { school: schoolCandidates[a].school, major: majorCandidates[b].major };
                        }
                    }
                }
                if (bestPair) {
                    if (!result.school) result.school = bestPair.school;
                    if (!result.major) result.major = bestPair.major;
                }
            }

            // 策略3：单独回退
            if (!result.school) {
                for (var j = 0; j < lines.length; j++) {
                    var s = extractSchoolFromLine(lines[j]);
                    if (s) { result.school = s; break; }
                }
            }
            if (!result.major) {
                for (var k = 0; k < lines.length; k++) {
                    var maj = extractMajorFromLine(lines[k]);
                    if (maj) { result.major = maj; break; }
                }
            }
        }

        // GPA
        var gpaMatch = text.match(/GPA\s*[:：]?\s*(\d+\.?\d*)\s*\/?\s*(\d+\.?\d*)?/i);
        if (gpaMatch) result.gpa = gpaMatch[2] ? gpaMatch[1] + '/' + gpaMatch[2] : gpaMatch[1];

        // 技能关键词
        var skillKeywords = [
            'CAD', 'AutoCAD', 'Python', 'MATLAB', 'Java', 'C++', 'SQL',
            'AutoCAD', 'Revit', 'BIM', 'GIS', 'Origin', 'SPSS',
            '水处理', '废水处理', '污水处理', 'MBR', '反渗透', '超滤',
            '活性污泥', '厌氧', '好氧', '沉淀', '过滤', '消毒',
            '环评', '环保', '环境监测', '水质分析', 'COD', 'BOD',
            'PLC', 'SCADA', 'DCS',
            '项目管理', 'PMP',
            'Excel', 'PPT', 'Word', 'Visio'
        ];
        var textUpper = text.toUpperCase();
        for (var si = 0; si < skillKeywords.length; si++) {
            var skill = skillKeywords[si];
            if (textUpper.indexOf(skill.toUpperCase()) > -1 && result.skills.indexOf(skill) === -1) {
                result.skills.push(skill);
            }
        }

        // 实习/工作经历
        var expMatch = text.match(/(?:实习|工作)\s*(?:经历|经验)\s*[:：]?\s*([\s\S]{20,300}?)(?:\n\s*\n|项目|证书|技能|自我|获奖|教育|校园)/);
        if (expMatch) result.experience = expMatch[1].trim().substring(0, 500);

        // 项目经历
        var projMatch = text.match(/(?:项目)\s*(?:经历|经验)\s*[:：]?\s*([\s\S]{20,500}?)(?:\n\s*\n|实习|工作|证书|技能|自我|获奖|教育|校园)/);
        if (projMatch) result.projects = projMatch[1].trim().substring(0, 500);

        // 证书
        var certMatch = text.match(/(?:证书|资质|资格)\s*[:：]?\s*([\s\S]{10,200}?)(?:\n\s*\n|实习|工作|项目|技能|自我|获奖|教育|校园)/);
        if (certMatch) result.certifications = certMatch[1].trim().substring(0, 300);

        return result;
    }

    // ================================================================
    // 岗位推荐算法（从 resumeParser.js 移植）
    // ================================================================

    var typeCategoryFit = {
        'INTJ': { tech: 'best', project: 'good', business: 'watch', operations: 'watch', support: 'general' },
        'INTP': { tech: 'best', project: 'general', business: 'watch', operations: 'general', support: 'general' },
        'ENTJ': { tech: 'good', project: 'best', business: 'best', operations: 'good', support: 'good' },
        'ENTP': { tech: 'good', project: 'good', business: 'best', operations: 'watch', support: 'general' },
        'INFJ': { tech: 'good', project: 'general', business: 'general', operations: 'general', support: 'best' },
        'INFP': { tech: 'good', project: 'watch', business: 'general', operations: 'watch', support: 'good' },
        'ENFJ': { tech: 'general', project: 'good', business: 'good', operations: 'general', support: 'best' },
        'ENFP': { tech: 'general', project: 'general', business: 'best', operations: 'watch', support: 'good' },
        'ISTJ': { tech: 'good', project: 'good', business: 'general', operations: 'best', support: 'good' },
        'ISFJ': { tech: 'general', project: 'general', business: 'general', operations: 'good', support: 'best' },
        'ESTJ': { tech: 'general', project: 'best', business: 'good', operations: 'best', support: 'good' },
        'ESFJ': { tech: 'watch', project: 'general', business: 'good', operations: 'good', support: 'best' },
        'ISTP': { tech: 'good', project: 'good', business: 'general', operations: 'best', support: 'general' },
        'ISFP': { tech: 'good', project: 'general', business: 'general', operations: 'best', support: 'good' },
        'ESTP': { tech: 'general', project: 'good', business: 'best', operations: 'good', support: 'general' },
        'ESFP': { tech: 'watch', project: 'general', business: 'best', operations: 'good', support: 'good' }
    };

    function getMbtiFit(mbtiType, category) {
        var fit = typeCategoryFit[mbtiType];
        if (!fit) return '';
        return fit[category] || 'general';
    }

    function calculateSkillMatch(candidateText, jobText) {
        if (!candidateText || !jobText) return 0;
        var keywords = [
            '水处理', '废水', '污水', '环保', '环境', '化学', '生物',
            '工程', '项目', '管理', 'CAD', 'PLC', '监测', '分析',
            'MBR', '反渗透', '活性污泥', '厌氧', '好氧',
            '研发', '工艺', '运维', '设备', '质量', '安全'
        ];
        var matchCount = 0;
        var candLower = candidateText.toLowerCase();
        var jobLower = jobText.toLowerCase();
        for (var i = 0; i < keywords.length; i++) {
            var kw = keywords[i].toLowerCase();
            if (candLower.indexOf(kw) > -1 && jobLower.indexOf(kw) > -1) matchCount++;
        }
        return Math.min(30, matchCount * 5);
    }

    function recommendJobs(parsedData, jobs, mbtiType) {
        var recommendations = [];
        var eduOrder = { 'bachelor': 1, 'master': 2, 'phd': 3, 'postdoc': 4 };
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
            if (job.status !== 'open') continue;
            var score = 0, reasons = [];

            var candidateEdu = eduOrder[parsedData.education] || 0;
            var jobMinEdu = eduOrder[job.education_min] || 0;
            if (candidateEdu >= jobMinEdu) { score += 25; reasons.push('学历满足岗位要求'); }
            else { score -= 15; reasons.push('学历未达岗位最低要求'); }

            var skillsText = (parsedData.skills || []).join(' ') + ' ' + (parsedData.major || '');
            var jobText = (job.description || '') + ' ' + (job.requirements || '');
            var skillMatchScore = calculateSkillMatch(skillsText, jobText);
            score += skillMatchScore;
            if (skillMatchScore > 15) reasons.push('专业技能与岗位匹配度高');
            else if (skillMatchScore > 5) reasons.push('部分技能与岗位相关');

            var mbtiFit = '';
            if (mbtiType) {
                mbtiFit = getMbtiFit(mbtiType, job.category);
                if (mbtiFit === 'best') { score += 20; reasons.push('MBTI性格类型与岗位高度匹配'); }
                else if (mbtiFit === 'good') { score += 12; reasons.push('MBTI性格类型与岗位良好匹配'); }
                else if (mbtiFit === 'general') { score += 5; reasons.push('MBTI性格类型基本匹配'); }
                else if (mbtiFit === 'watch') { score -= 5; reasons.push('MBTI性格类型需关注适配性'); }
            }

            if (parsedData.preferred_category && parsedData.preferred_category === job.category) {
                score += 15; reasons.push('与候选人求职意向一致');
            }

            score = Math.max(0, Math.min(100, score));
            recommendations.push({
                job_id: job.id,
                job_title: job.title,
                match_score: Math.round(score),
                match_reasons: reasons.join('；'),
                mbti_fit: mbtiFit
            });
        }
        recommendations.sort(function (a, b) { return b.match_score - a.match_score; });
        return recommendations;
    }

    // ================================================================
    // pdf.js 文本提取
    // ================================================================

    var pdfjsReady = false;

    function ensurePdfjs() {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('未加载 pdf.js，请先引入 /js/pdf.min.js');
        }
        if (!pdfjsReady) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
            pdfjsReady = true;
        }
    }

    async function extractPdfText(file) {
        ensurePdfjs();
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        var fullText = '';
        for (var p = 1; p <= pdf.numPages; p++) {
            var page = await pdf.getPage(p);
            var content = await page.getTextContent();
            var pageText = content.items.map(function (item) { return item.str; }).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    }

    function readTextFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('文件读取失败')); };
            reader.readAsText(file, 'utf-8');
        });
    }

    // ================================================================
    // 入口：解析简历文件
    // ================================================================

    async function parseResumeFile(file) {
        var ext = (file.name.split('.').pop() || '').toLowerCase();
        var text = '';

        try {
            if (ext === 'pdf') {
                text = await extractPdfText(file);
            } else if (ext === 'txt') {
                text = await readTextFile(file);
            } else {
                return { success: false, message: '暂不支持该格式自动解析，请手动录入信息', text: '' };
            }
        } catch (err) {
            return { success: false, message: '文件解析失败：' + (err && err.message ? err.message : err), text: '' };
        }

        var parsed = extractInfo(text);
        return {
            success: true,
            text: text.substring(0, 5000),
            name: parsed.name,
            phone: parsed.phone,
            email: parsed.email,
            gender: parsed.gender,
            education: parsed.education,
            school: parsed.school,
            major: parsed.major,
            graduationYear: parsed.graduationYear,
            gpa: parsed.gpa,
            skills: parsed.skills,
            experience: parsed.experience,
            projects: parsed.projects,
            certifications: parsed.certifications
        };
    }

    // ================================================================
    // 暴露接口
    // ================================================================

    window.ResumeParser = {
        parseFile: parseResumeFile,
        extractInfo: extractInfo,
        recommendJobs: recommendJobs,
        getMbtiFit: getMbtiFit,
        calculateSkillMatch: calculateSkillMatch,
        typeCategoryFit: typeCategoryFit
    };
})();

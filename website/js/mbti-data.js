// ===== 泓济环保 MBTI 职业性格测试 - 数据文件 =====

const jobCategories = {
    tech: { name: '技术研发类', icon: '🔬', desc: '研发、工艺设计、技术方案等' },
    project: { name: '项目工程类', icon: '🏗️', desc: '项目管理、工程实施、现场施工等' },
    business: { name: '商务市场类', icon: '🚀', desc: '销售、市场推广、客户开发等' },
    operations: { name: '运营服务类', icon: '⚙️', desc: '设施运营、设备维护、监测检测等' },
    support: { name: '职能支持类', icon: '👥', desc: '人事、行政、财务、IT等' },
};

const questions = [
    // E/I (0-7)
    { dim: 'EI', label: '认知方向', q: '面对一个复杂的工作难题，你的第一反应更接近：', catQ: { tech: '面对一个复杂的技术难题，你的第一反应更接近：', project: '面对一个工期紧迫、条件复杂的项目节点，你的第一反应更接近：', business: '面对一个难度较大的客户开发任务，你的第一反应更接近：', operations: '面对一次复杂的设备故障排查，你的第一反应更接近：', support: '面对一个棘手的管理问题需要解决，你的第一反应更接近：' }, a: 'E', aText: '动手试错，在实践中发现问题和迭代方案——行动本身就是思考过程', b: 'I', bText: '先在脑中构建完整的理论模型，想清楚原理再动手——思考先于行动' },
    { dim: 'EI', label: '认知方向', q: '在解决工作问题时，你更习惯：', a: 'E', aText: '通过与外部世界的互动来推进——边做边调整，从真实反馈中校准方向', b: 'I', bText: '先进行内部深度推演，在内心完成方案设计后再付诸行动' },
    { dim: 'EI', label: '认知方向', q: '你的思维在什么状态下最活跃？', a: 'E', aText: '需要外部刺激和互动来激活——在讨论、实操和动态环境中思维最敏锐', b: 'I', bText: '需要独处和安静来处理信息——在独立思考时洞察力最强，想法最清晰' },
    { dim: 'EI', label: '认知方向', q: '当面对一个全新的概念时，你更倾向于：', a: 'E', aText: '直接投入实践，在使用中理解它的含义，从外部体验中构建认知', b: 'I', bText: '先从理论上彻底搞懂原理，将信息内化后再考虑如何应用' },
    { dim: 'EI', label: '认知方向', q: '在工作中，你的认知能量主要来自：', a: 'E', aText: '与外部环境的互动——行动、交流、推进任务时精神最充沛', b: 'I', bText: '独立深度思考——分析、整合、洞察时内心最充实' },
    { dim: 'EI', label: '认知方向', q: '你处理外部信息的方式更接近：', a: 'E', aText: '快速接收并即时反应，善于在动态变化中实时调整策略', b: 'I', bText: '将信息内化后深度加工，需要时间来整合、提炼和沉淀' },
    { dim: 'EI', label: '认知方向', q: '当需要做重要判断时：', a: 'E', aText: '倾向于先行动起来，从现实反馈中逐步校准和明确方向', b: 'I', bText: '倾向于先在内心完成充分推演，想清楚所有可能性后再决策' },
    { dim: 'EI', label: '认知方向', q: '你的工作节奏更接近：', a: 'E', aText: '外部驱动力强，喜欢在多个任务和互动中保持活跃和推进感', b: 'I', bText: '内部驱动力强，需要不被打扰的深度时间来产出最佳成果' },
    // S/N (8-15)
    { dim: 'SN', label: '信息感知', q: '接手一项新工作时，你首先注意到的是：', catQ: { tech: '进入一个新研发课题时，你首先注意到的是：', project: '进入一个新项目时，你首先注意到的是：', business: '接手一个新市场区域时，你首先注意到的是：', operations: '接手一个新运营站点时，你首先注意到的是：', support: '接手一项新的管理任务时，你首先注意到的是：' }, a: 'S', aText: '具体的现实条件——现有资源、技术参数、过往类似项目的经验教训', b: 'N', bText: '项目背后的深层意义和未来可能——这件事可能演变成什么、牵连哪些更大的机会' },
    { dim: 'SN', label: '信息感知', q: '面对一堆工作数据，你更擅长：', a: 'S', aText: '准确识别其中的具体数值偏差和异常细节，像扫描仪一样捕捉关键信息', b: 'N', bText: '从数据中看出整体趋势和潜在规律，像拼图一样把碎片信息整合成完整画面' },
    { dim: 'SN', label: '信息感知', q: '你对"经验"的态度更接近：', a: 'S', aText: '过往的实操经验是可靠的导航——遇到类似情况就参考已验证的成功做法', b: 'N', bText: '经验是参考但不是束缚——每个新情况都可能需要全新思路，过去的做法不一定适用' },
    { dim: 'SN', label: '信息感知', q: '当有人给你讲一个新方案时，你首先关注：', a: 'S', aText: '方案的具体步骤是否可行、每一步是否有据可依、资源是否够用', b: 'N', bText: '方案背后的逻辑是否成立、是否指向正确的方向、有没有更大的想象空间' },
    { dim: 'SN', label: '信息感知', q: '在一线工作中，你的注意力更倾向于：', a: 'S', aText: '敏锐捕捉当下的每一个细节——设备状态、气味、声音的细微变化都逃不过你的眼睛', b: 'N', bText: '从整体格局中感知潜在的问题和未来可能的发展方向，看到表面之下的系统性联系' },
    { dim: 'SN', label: '信息感知', q: '你更相信哪种判断依据？', a: 'S', aText: '经过实际验证的、可重复的、有据可查的事实和亲手经历过的经验', b: 'N', bText: '基于模式识别和深层洞察产生的直觉判断——虽然一时说不出完整逻辑但方向感很准' },
    { dim: 'SN', label: '信息感知', q: '学习新领域知识时，你更喜欢：', a: 'S', aText: '从基础概念开始，一步一个脚印，每个知识点都搞扎实再往下走', b: 'N', bText: '先建立整体框架和核心逻辑，细节在实践中按需逐步填充' },
    { dim: 'SN', label: '信息感知', q: '描述一个工作问题时，你更可能：', a: 'S', aText: '精确描述具体的参数、现象和操作步骤，还原问题的真实全貌', b: 'N', bText: '描述问题的本质、影响范围和背后的系统性原因，提炼出核心矛盾' },
    // T/F (16-23)
    { dim: 'TF', label: '决策判断', q: '需要做出影响团队的人事决策时，你更倾向于：', a: 'T', aText: '基于能力评估、绩效数据和岗位匹配度做客观判断——结果最优是第一原则', b: 'F', bText: '综合考虑团队成员的感受、协作关系和个人发展需求——人的因素同样重要' },
    { dim: 'TF', label: '决策判断', q: '你评估一个方案好坏时，更看重：', a: 'T', aText: '逻辑是否自洽、数据是否支撑、效率是否最优——用客观标准衡量', b: 'F', bText: '是否照顾到各方利益、团队是否能接受、是否公平合理——用人的影响衡量' },
    { dim: 'TF', label: '决策判断', q: '当团队出现分歧时，你的第一反应是：', a: 'T', aText: '分析各方论点的逻辑合理性，用事实和数据来判断谁对谁错', b: 'F', bText: '先了解每个人的立场和顾虑，寻找能让各方都接受的共赢方案' },
    { dim: 'TF', label: '决策判断', q: '你认为优秀的管理者应该更优先：', a: 'T', aText: '建立清晰的规则和标准，确保公平和效率——用制度管人', b: 'F', bText: '关注每个人的状态和需求，营造有凝聚力的团队氛围——用人情带人' },
    { dim: 'TF', label: '决策判断', q: '回顾过去一个重要决策时，你更可能反思：', a: 'T', aText: '当时的逻辑推理是否严密，数据分析是否充分，方案是否最优', b: 'F', bText: '决策是否真正照顾到了所有人的利益和感受，是否做到了公平' },
    { dim: 'TF', label: '决策判断', q: '当同事工作出现失误时，你更倾向于：', a: 'T', aText: '直接分析失误原因，制定改进措施，确保同类问题不再发生', b: 'F', bText: '先了解是否有什么困难导致失误，帮助对方改进的同时维护其信心' },
    { dim: 'TF', label: '决策判断', q: '你认为工作中的"公平"更意味着：', a: 'T', aText: '同样的标准衡量所有人，用客观指标说话，对事不对人', b: 'F', bText: '根据每个人的实际情况和贡献给予合适的对待，因人而异' },
    { dim: 'TF', label: '决策判断', q: '在制定团队规则时，你更关注：', a: 'T', aText: '规则的效率性和可执行性——能否产出最优结果、能否量化考核', b: 'F', bText: '规则是否人性化——是否照顾到不同人的需求、大家是否愿意接受' },
    // J/P (24-31)
    { dim: 'JP', label: '处事方式', q: '你的工作方式更接近：', a: 'J', aText: '提前规划，按部就班推进，对进度有掌控感——喜欢把事情"确定下来"', b: 'P', bText: '保持灵活性，根据新信息随时调整方向和优先级——喜欢保持"开放选项"' },
    { dim: 'JP', label: '处事方式', q: '面对一个截止日期，你通常：', a: 'J', aText: '提前制定时间表，尽早完成以留出缓冲空间——不喜欢临时赶工', b: 'P', bText: '在临近截止时进入高效状态，压力下产出最佳——不喜欢被提前锁定' },
    { dim: 'JP', label: '处事方式', q: '对于"确定性"和"可能性"：', a: 'J', aText: '更喜欢事情是确定的、有明确方向的——尽早做出决定然后推进', b: 'P', bText: '更喜欢保持开放，看看还有什么新的可能性——多收集信息再决定' },
    { dim: 'JP', label: '处事方式', q: '你处理多任务的方式更接近：', a: 'J', aText: '一件一件来，完成一项再开始下一项——喜欢有始有终的闭环感', b: 'P', bText: '多线并行，在不同任务间灵活切换——喜欢同时保持多个项目活跃' },
    { dim: 'JP', label: '处事方式', q: '当计划遇到变化时，你的反应更接近：', a: 'J', aText: '尽快重新制定计划，恢复秩序和可控感——变化是需要被管理的', b: 'P', bText: '视变化为正常，灵活调整，寻找变化中涌现的新机会——变化是自然的' },
    { dim: 'JP', label: '处事方式', q: '你理想中的工作环境更接近：', a: 'J', aText: '有明确的流程、规范和目标，知道下一步该做什么、做到什么标准', b: 'P', bText: '有足够的自由度和弹性，能根据情况自主调整节奏和方式' },
    { dim: 'JP', label: '处事方式', q: '在收集信息和做决定之间，你的倾向是：', a: 'J', aText: '信息够用就尽快做决定，然后推进执行——行动优于完美', b: 'P', bText: '尽可能多收集信息，保持选择开放更长时间——充分了解优于草率决定' },
    { dim: 'JP', label: '处事方式', q: '你在项目中的节奏管理更接近：', a: 'J', aText: '设定清晰的里程碑节点，严格把控每个阶段的进度和交付物', b: 'P', bText: '整体方向确定后，在过程中灵活调配资源和节奏，允许动态调整' },
    // A/T (32-39)
    { dim: 'AT', label: '抗压风格', q: '工作中出现突发状况时，你的第一反应更接近：', catQ: { tech: '研发中出现意外结果时，你的第一反应更接近：', project: '项目中出现突发状况时，你的第一反应更接近：', business: '客户沟通中出现突发状况时，你的第一反应更接近：', operations: '运营中出现设备故障时，你的第一反应更接近：', support: '工作中出现突发状况时，你的第一反应更接近：' }, a: 'A', aText: '冷静应对，迅速调整方案，把问题当作正常插曲', b: 'Tu', bText: '高度警觉，仔细排查每个环节，确保不再出纰漏' },
    { dim: 'AT', label: '抗压风格', q: '完成一项重要工作后，你通常会：', a: 'A', aText: '对自己的成果感到满意，适度放松后准备下一项', b: 'Tu', bText: '反复回顾哪里可以做得更好，总觉得自己还能再优化' },
    { dim: 'AT', label: '抗压风格', q: '领导指出你的工作时，你更倾向于：', a: 'A', aText: '客观分析反馈，有道理就改，不太往心里去', b: 'Tu', bText: '认真对待每一条意见，反思自己为什么会出这个问题' },
    { dim: 'AT', label: '抗压风格', q: '面对一个全新的挑战性任务，你的内心状态是：', a: 'A', aText: '有信心能搞定，边做边学，遇到困难再想办法', b: 'Tu', bText: '有压力但也有动力，会提前做大量准备确保万无一失' },
    { dim: 'AT', label: '抗压风格', q: '关于过去工作中的失误，你通常：', a: 'A', aText: '吸取教训就翻篇，不太纠结已经过去的事', b: 'Tu', bText: '会反复回想，分析原因，确保下次绝不犯同样错误' },
    { dim: 'AT', label: '抗压风格', q: '团队项目出了问题，你的反应更接近：', a: 'A', aText: '不慌张，先解决眼前问题，再总结经验', b: 'Tu', bText: '会自责是否自己遗漏了什么，仔细复盘每个细节' },
    { dim: 'AT', label: '抗压风格', q: '你对"完美"的态度是：', a: 'A', aText: '追求"足够好"，在质量和效率之间找到平衡', b: 'Tu', bText: '追求尽善尽美，宁可多花时间也要做到最好' },
    { dim: 'AT', label: '抗压风格', q: '高压环境下连续工作一段时间后，你通常：', a: 'A', aText: '状态基本稳定，能持续保持产出', b: 'Tu', bText: '虽然压力会带来疲惫，但也逼出了更高的工作效率' },
];

const personalityTypes = {
    'INTJ': { emoji: '🏛️', name: '建筑师', tagline: '富有想象力又有决断力的战略思考者', strengths: '善于从全局视角分析复杂问题，制定长期战略规划。学习能力强，对专业领域有深度追求。', careers: ['深度技术研发', '技术战略规划', '系统架构设计'] },
    'INTP': { emoji: '🔬', name: '逻辑学家', tagline: '对知识有着永不满足的渴望的创新发明家', strengths: '极具逻辑分析能力，善于发现问题的本质和内在规律。创新能力强，能提出独特的解决方案。', careers: ['深度技术研发', '数据分析建模', '方案设计优化'] },
    'ENTJ': { emoji: '🎖️', name: '指挥官', tagline: '大胆、富有想象力且意志强大的领导者', strengths: '天生的领导者，善于制定战略并高效执行。决策果断，能迅速抓住关键问题。', careers: ['项目统筹管理', '业务线管理', '战略推进'] },
    'ENTP': { emoji: '💡', name: '辩论家', tagline: '聪明好奇的思考者，不会放过任何智力挑战', strengths: '思维活跃，善于从多角度分析问题。创新能力强，乐于挑战传统。沟通能力强。', careers: ['新业务开拓', '方案创新设计', '市场策略'] },
    'INFJ': { emoji: '🌊', name: '提倡者', tagline: '安静而神秘，同时鼓舞人心的理想主义者', strengths: '对人和社会有深刻的洞察力，善于理解他人深层需求。有强烈的使命感和理想主义。', careers: ['人才发展管理', '文化建设', '战略咨询'] },
    'INFP': { emoji: '🌸', name: '调停者', tagline: '诗意、善良的利他主义者，渴望帮助善因', strengths: '有强烈的价值观和使命感，被有意义的事业驱动。创造力强，善于从人性化角度思考问题。', careers: ['品牌内容', '员工关怀', '公益项目'] },
    'ENFJ': { emoji: '🌟', name: '主人公', tagline: '富有魅力、鼓舞人心的领导者，能让听众入迷', strengths: '天生的沟通者和领导者，善于激励团队。人际洞察力强，能快速建立信任。', careers: ['团队管理', '人才发展', '客户关系'] },
    'ENFP': { emoji: '🎉', name: '竞选者', tagline: '热情、有创造力、爱社交的自由灵魂', strengths: '热情有感染力，善于激发团队活力。创意丰富，能发现别人看不到的机会。', careers: ['市场推广', '商务拓展', '品牌建设'] },
    'ISTJ': { emoji: '📋', name: '物流师', tagline: '实际而注重事实的可靠主义者', strengths: '工作严谨负责，对流程和细节有极强把控力。执行力出色，能稳定可靠地完成任务。', careers: ['质量管理', '合规审计', '运营管理'] },
    'ISFJ': { emoji: '🛡️', name: '守卫者', tagline: '非常专注、温暖的守护者，时刻准备保护爱的人', strengths: '工作细致负责，是团队中最可靠的支持者。善于记住细节，关心他人需求。', careers: ['行政支持', '文档管理', '客户服务'] },
    'ESTJ': { emoji: '📊', name: '总经理', tagline: '出色的管理者，在管理事物或人员方面无与伦比', strengths: '天生的管理者，善于建立秩序和流程。决策果断，执行力强。', careers: ['运营管理', '项目执行', '供应链管理'] },
    'ESFJ': { emoji: '🤝', name: '执政官', tagline: '极有同情心、爱社交、受欢迎的人，总是热心帮助', strengths: '善于维护人际关系，是团队的凝聚力核心。组织协调能力强，关心团队氛围。', careers: ['人力资源', '行政后勤', '客户关系'] },
    'ISTP': { emoji: '🔧', name: '鉴赏家', tagline: '大胆而实际的实验家，擅长使用各种工具', strengths: '极强的动手实践能力，善于操作工具和设备。冷静沉着，在紧急情况下能快速反应。', careers: ['设备运维', '现场技术', '应急处理'] },
    'ISFP': { emoji: '🎨', name: '探险家', tagline: '灵活、有魅力的艺术家，随时准备探索新事物', strengths: '有敏锐的感知力，善于关注当下细节。温和体贴，善于营造和谐氛围。', careers: ['监测分析', '数据质控', '实验室技术'] },
    'ESTP': { emoji: '🚀', name: '企业家', tagline: '聪明、精力充沛的感知者，真正享受生活在边缘', strengths: '极强的行动力和应变能力，善于在动态环境中快速反应。社交能力强，善于建立关系。', careers: ['市场开拓', '商务拓展', '现场管理'] },
    'ESFP': { emoji: '🎪', name: '表演者', tagline: '自发的、精力充沛的表演者——生活在他们周围永不无聊', strengths: '热情有感染力，善于活跃团队氛围。人际交往能力强，善于建立友好关系。', careers: ['市场推广', '客户关系', '活动策划'] },
};

const typeCategoryFit = {
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
    'ESFP': { tech: 'watch', project: 'general', business: 'best', operations: 'good', support: 'good' },
};

const fitLabels = {
    best: { label: '高度匹配', cls: 'best' },
    good: { label: '良好匹配', cls: 'good' },
    general: { label: '基本匹配', cls: 'general' },
    watch: { label: '需关注适配', cls: 'watch' },
};

const categoryDirections = {
    tech: { best: '前沿技术研发与创新方向', good: '技术标准建立与流程优化方向', general: '技术应用支持方向', watch: '需较长时间适应技术深度要求' },
    project: { best: '大型项目统筹与整体推进方向', good: '项目质量控制与风险管理方向', general: '项目执行实施方向', watch: '需较长时间适应项目高压节奏' },
    business: { best: '市场开拓与新客户开发方向', good: '客户关系深耕与维护方向', general: '市场推广与品牌支持方向', watch: '需较长时间适应商务拓展节奏' },
    operations: { best: '运营体系管理与优化方向', good: '设备运维与应急处置方向', general: '运营执行与日常监测方向', watch: '需较长时间适应运营标准化要求' },
    support: { best: '人才管理与组织发展方向', good: '制度建设与合规管理方向', general: '行政运营与基础支持方向', watch: '需较长时间适应职能支持角色' },
};

/**
 * 根据职业名称返回对应的 emoji
 * 支持中文和英文职业名称匹配
 */
export function getRoleEmoji(roleName: string): string {
  const name = roleName.toLowerCase().trim()

  const rules: Array<{ keywords: string[]; emoji: string }> = [
    // 技术/开发
    {
      keywords: [
        'developer',
        'engineer',
        'programer',
        'coder',
        'coding',
        'software',
        '程序员',
        '开发者',
        '开发工程师',
        '软件工程师',
        '研发',
        '工程师',
        '架构师',
        'architect',
        'devops',
        'backend',
        'frontend',
        'fullstack',
        'full-stack',
        '前端',
        '后端',
        '全栈',
      ],
      emoji: '💻',
    },
    // AI / 机器学习
    {
      keywords: [
        'ai',
        'machine learning',
        'deep learning',
        'data scientist',
        'ml engineer',
        '人工智能',
        '机器学习',
        '深度学习',
        '算法工程师',
        '算法',
      ],
      emoji: '🤖',
    },
    // 数据分析
    {
      keywords: [
        'analyst',
        'data analyst',
        'business analyst',
        'data engineer',
        '数据分析',
        '分析师',
        '数据工程师',
      ],
      emoji: '📊',
    },
    // 产品
    {
      keywords: [
        'product manager',
        'product owner',
        'pm',
        'product',
        '产品经理',
        '产品',
        '产品负责人',
      ],
      emoji: '📦',
    },
    // 设计
    {
      keywords: [
        'designer',
        'design',
        'ui',
        'ux',
        'graphic',
        'creative',
        '设计师',
        '设计',
        'UI设计',
        'UX设计',
        '美工',
        '平面设计',
      ],
      emoji: '🎨',
    },
    // 市场营销
    {
      keywords: [
        'marketing',
        'marketer',
        'growth',
        'brand',
        'campaign',
        '市场',
        '营销',
        '品牌',
        '推广',
        '市场营销',
      ],
      emoji: '📣',
    },
    // 运营
    {
      keywords: [
        'operations',
        'operator',
        'ops',
        '运营',
        '运营专员',
        '运营经理',
        '内容运营',
        '用户运营',
        '社区运营',
      ],
      emoji: '⚙️',
    },
    // SEO / 内容
    {
      keywords: [
        'seo',
        'sem',
        'content',
        'copywriter',
        'copy writer',
        'editor',
        'blogger',
        'writer',
        'SEO专员',
        '内容',
        '内容编辑',
        '文案',
        '编辑',
        '博主',
        '写作',
        '撰稿',
      ],
      emoji: '✍️',
    },
    // 销售
    {
      keywords: [
        'sales',
        'account manager',
        'business development',
        'bd',
        '销售',
        '销售经理',
        '商务',
        '业务',
        '客户经理',
      ],
      emoji: '💼',
    },
    // 客服
    {
      keywords: [
        'customer service',
        'customer success',
        'support',
        '客服',
        '客户服务',
        '售后',
        '用户支持',
      ],
      emoji: '🎧',
    },
    // 财务/会计
    {
      keywords: [
        'finance',
        'accountant',
        'accounting',
        'cfo',
        'financial',
        '财务',
        '会计',
        '审计',
        '出纳',
        '财务总监',
      ],
      emoji: '💰',
    },
    // HR / 人力资源
    {
      keywords: [
        'hr',
        'human resources',
        'recruiter',
        'recruitment',
        'talent',
        '人力资源',
        '人事',
        '招聘',
        'HR',
        '培训',
      ],
      emoji: '👥',
    },
    // 法务/法律
    {
      keywords: [
        'lawyer',
        'legal',
        'attorney',
        'counsel',
        'compliance',
        '律师',
        '法务',
        '法律顾问',
        '合规',
      ],
      emoji: '⚖️',
    },
    // 高管/管理层
    {
      keywords: [
        'ceo',
        'cto',
        'coo',
        'cmo',
        'president',
        'founder',
        'co-founder',
        'director',
        'vp',
        'vice president',
        'executive',
        '总裁',
        '总经理',
        'CEO',
        'CTO',
        '联合创始人',
        '创始人',
        '董事',
        '副总裁',
        '高管',
      ],
      emoji: '👑',
    },
    // 管理/经理
    {
      keywords: [
        'manager',
        'management',
        'team lead',
        'lead',
        '经理',
        '管理',
        '负责人',
        '主管',
        '总监',
      ],
      emoji: '👔',
    },
    // 创业者
    {
      keywords: [
        'entrepreneur',
        'startup',
        'venture',
        '创业者',
        '创业',
        '企业家',
      ],
      emoji: '🚀',
    },
    // 咨询顾问
    {
      keywords: [
        'consultant',
        'consulting',
        'advisor',
        'adviser',
        '顾问',
        '咨询',
      ],
      emoji: '💡',
    },
    // 行政
    {
      keywords: [
        'admin',
        'administration',
        'administrative',
        'secretary',
        'assistant',
        '行政',
        '助理',
        '秘书',
        '行政助理',
      ],
      emoji: '📋',
    },
    // 医生/医疗
    {
      keywords: [
        'doctor',
        'physician',
        'surgeon',
        'medical',
        'dentist',
        '医生',
        '医师',
        '外科',
        '内科',
        '牙医',
        '医疗',
      ],
      emoji: '👨‍⚕️',
    },
    // 护士
    {
      keywords: ['nurse', 'nursing', '护士', '护理'],
      emoji: '👩‍⚕️',
    },
    // 教师/教育
    {
      keywords: [
        'teacher',
        'professor',
        'instructor',
        'tutor',
        'educator',
        'lecturer',
        '教师',
        '老师',
        '教授',
        '教育',
        '讲师',
        '辅导',
      ],
      emoji: '👨‍🏫',
    },
    // 学生
    {
      keywords: ['student', 'intern', 'graduate', '学生', '实习生', '毕业生'],
      emoji: '📚',
    },
    // 科研/研究
    {
      keywords: [
        'researcher',
        'scientist',
        'research',
        '研究员',
        '科学家',
        '研究',
        '科研',
      ],
      emoji: '🔬',
    },
    // 记者/媒体
    {
      keywords: [
        'journalist',
        'reporter',
        'media',
        'news',
        '记者',
        '媒体',
        '新闻',
      ],
      emoji: '📰',
    },
    // 摄影师
    {
      keywords: ['photographer', 'photography', '摄影师', '摄影'],
      emoji: '📷',
    },
    // 演员/导演
    {
      keywords: [
        'actor',
        'actress',
        'director',
        'filmmaker',
        '演员',
        '导演',
        '影视',
      ],
      emoji: '🎬',
    },
    // 音乐
    {
      keywords: [
        'musician',
        'music',
        'singer',
        'composer',
        '音乐家',
        '音乐人',
        '歌手',
        '作曲',
        '音乐',
      ],
      emoji: '🎵',
    },
    // 艺术家
    {
      keywords: ['artist', 'art', '艺术家', '艺术'],
      emoji: '🎭',
    },
    // 厨师
    {
      keywords: ['chef', 'cook', 'culinary', '厨师', '烹饪'],
      emoji: '👨‍🍳',
    },
    // 司机/物流
    {
      keywords: [
        'driver',
        'logistics',
        'delivery',
        'transport',
        '司机',
        '物流',
        '快递',
        '运输',
      ],
      emoji: '🚗',
    },
    // 飞行员
    {
      keywords: ['pilot', 'aviation', 'airline', '飞行员', '航空'],
      emoji: '✈️',
    },
    // 建筑
    {
      keywords: [
        'architect',
        'architecture',
        'construction',
        'civil engineer',
        '建筑师',
        '建筑',
        '土木',
      ],
      emoji: '🏗️',
    },
    // 警察/安保
    {
      keywords: [
        'police',
        'officer',
        'security',
        'guard',
        '警察',
        '警官',
        '安保',
        '保安',
      ],
      emoji: '👮',
    },
    // 军人
    {
      keywords: [
        'soldier',
        'military',
        'army',
        'navy',
        'air force',
        '军人',
        '军官',
        '士兵',
        '部队',
      ],
      emoji: '🎖️',
    },
    // 消防
    {
      keywords: ['firefighter', 'fire', '消防员', '消防'],
      emoji: '🚒',
    },
    // 农业/农民
    {
      keywords: ['farmer', 'agriculture', 'farming', '农民', '农业', '农场'],
      emoji: '🌾',
    },
    // 自由职业
    {
      keywords: [
        'freelancer',
        'freelance',
        'independent',
        '自由职业',
        '自由撰稿',
        '独立',
      ],
      emoji: '🧑‍💻',
    },
  ]

  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return rule.emoji
      }
    }
  }

  return '👤'
}

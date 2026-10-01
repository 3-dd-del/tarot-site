/**
 * 反思问答（流程第 5 步）。
 * 回答只决定第二层解读的侧重方向与建议句式，不改变牌的核心指向（产品设计文档 2、6.1）。
 */

import type { CategoryId } from './questions'

export interface ReflectOption {
  id: string
  label: string
  /** 侧重句：写进个性化解读的方向。 */
  lean: string
  /** 建议句式池里对应的一句。 */
  advice: string
}

export interface ReflectQuestion {
  id: string
  question: string
  options: ReflectOption[]
}

export const REFLECTION: Record<CategoryId, ReflectQuestion[]> = {
  love: [
    {
      id: 'love-want',
      question: '这件事里，你现在最想弄清楚的是什么？',
      options: [
        {
          id: 'want-them',
          label: '对方到底怎么想',
          lean: '你更想知道对方的心意，但对方的内心是看不到的，能看到的只有他做过什么。',
          advice: '这一周别去猜，只记录对方实际做了什么，再看看你的感受。',
        },
        {
          id: 'want-me',
          label: '我自己到底想要什么',
          lean: '你更该看的是自己的感受，它比对方的表态更早给出答案。',
          advice: '找个安静的时间问自己：这段关系里我最不愿意放弃的是什么。',
        },
        {
          id: 'want-next',
          label: '下一步该怎么走',
          lean: '你已经在想下一步了，说明心里其实有一个方向，只是还没承认。',
          advice: '先做一件不需要对方同意的小事，比如整理好自己想说的话。',
        },
      ],
    },
    {
      id: 'love-energy',
      question: '如果要往前挪一小步，你更愿意做哪件事？',
      options: [
        {
          id: 'energy-talk',
          label: '把话说开',
          lean: '你倾向于用沟通解决，这是最直接的一条路，前提是你说的是自己的感受，不是对方的对错。',
          advice: '用“我有点在意……”开头，而不是“你为什么……”。',
        },
        {
          id: 'energy-space',
          label: '先给自己一点空间',
          lean: '你需要一点距离才看得清，退一步不是放弃，而是让自己重新有判断力。',
          advice: '给自己定一个期限，比如两周，期限内不做重大决定。',
        },
        {
          id: 'energy-act',
          label: '做点实际的事',
          lean: '你更相信行动，那就做一件具体的小事，而不是反复在心里排练。',
          advice: '挑一件能让关系变轻松的小事，今天就做掉它。',
        },
      ],
    },
  ],
  career: [
    {
      id: 'career-focus',
      question: '现在最让你难受的是哪一块？',
      options: [
        {
          id: 'focus-energy',
          label: '累，提不起劲',
          lean: '消耗感比能力问题更明显，你需要的也许不是更努力，而是换一种用力方式。',
          advice: '这一周记录一下：哪些具体的事让你回血，哪些让你掉电。',
        },
        {
          id: 'focus-growth',
          label: '看不到成长',
          lean: '你在意的是自己有没有变强，这比薪水更值得正视。',
          advice: '写下这半年新学会的三件事，若写不出，答案就很清楚了。',
        },
        {
          id: 'focus-people',
          label: '和人的关系',
          lean: '问题更多出在协作方式上，而不是事情本身。',
          advice: '先处理一件事的边界，别一次性摊开所有不满。',
        },
      ],
    },
    {
      id: 'career-step',
      question: '如果只能先做一件事，你会选？',
      options: [
        {
          id: 'step-info',
          label: '先把信息补全',
          lean: '你现在缺的是判断依据，而不是决心。',
          advice: '找两位在做你想做的事的人聊二十分钟，只问他们真实的一天怎么过。',
        },
        {
          id: 'step-small',
          label: '先做一个小尝试',
          lean: '把大决定拆成可以试错的小动作，风险会立刻变得可控。',
          advice: '挑一件两周内能完成、失败了也不致命的事先做。',
        },
        {
          id: 'step-rest',
          label: '先缓一缓',
          lean: '你现在最需要的可能是恢复状态，而不是立刻做决定。',
          advice: '给自己划一个不做决定的期限，到点再回来看这张牌。',
        },
      ],
    },
  ],
  study: [
    {
      id: 'study-block',
      question: '现在最卡住你的是什么？',
      options: [
        {
          id: 'block-method',
          label: '方法不对，效率低',
          lean: '你缺的是结构，而不是时间。',
          advice: '把目标换成可完成的动作，比如「今天做十道题」，而不是「今天好好学习」。',
        },
        {
          id: 'block-mood',
          label: '心态不稳，容易崩',
          lean: '情绪的波动比知识漏洞更影响你的发挥。',
          advice: '给自己固定的休息时间，别用连轴转的方式证明努力。',
        },
        {
          id: 'block-direction',
          label: '不知道学了有什么用',
          lean: '你在怀疑方向，这比执行问题更需要先回答。',
          advice: '写下你希望三年后自己在做什么，再看看现在的事和它有多远。',
        },
      ],
    },
  ],
  money: [
    {
      id: 'money-feel',
      question: '谈到钱，你现在的第一反应是？',
      options: [
        {
          id: 'feel-anxious',
          label: '焦虑、不踏实',
          lean: '焦虑本身消耗的精力，往往比缺钱更多。',
          advice: '把数字写下来：收入、支出、结余。看得见的数字比模糊的恐惧小很多。',
        },
        {
          id: 'feel-fine',
          label: '还好，只是有点迷茫',
          lean: '你的基本盘还行，缺的是方向感。',
          advice: '先定一个具体的小目标，比如三个月后多出多少结余。',
        },
        {
          id: 'feel-avoid',
          label: '不想谈，说了也没用',
          lean: '回避是保护自己的方式，但它也让你失去掌控感。',
          advice: '只做一件事：打开账单看五分钟，不做任何决定。',
        },
      ],
    },
  ],
  decision: [
    {
      id: 'decision-hard',
      question: '让你难下决定的，主要是哪一点？',
      options: [
        {
          id: 'hard-loss',
          label: '怕选错，代价太大',
          lean: '你怕的不是选择本身，而是选择之后无法回头。',
          advice: '写下最坏的结果，再写一条能承受它的退路。',
        },
        {
          id: 'hard-info',
          label: '信息不够，看不清',
          lean: '你需要的是更多事实，而不是更多建议。',
          advice: '列出你还需要确认的三件事，先去把最容易确认那件弄清楚。',
        },
        {
          id: 'hard-feel',
          label: '理智和感觉在打架',
          lean: '两边都有道理，说明真正的答案在于你更不愿意失去什么。',
          advice: '假设两个选项都成了，你会更愿意跟哪一个自己相处。',
        },
      ],
    },
    {
      id: 'decision-time',
      question: '你打算什么时候做决定？',
      options: [
        {
          id: 'time-now',
          label: '越快越好',
          lean: '你想要一个了断，这种心情本身也值得参考。',
          advice: '给决定设一个具体日期，比如三天后的晚上，到点就定。',
        },
        {
          id: 'time-wait',
          label: '再等等看',
          lean: '等待只有在能带回新信息时才成立，否则只是拖延。',
          advice: '写清楚你在等什么，以及等到什么时候为止。',
        },
        {
          id: 'time-other',
          label: '看情况，暂时定不了',
          lean: '你其实把决定权交给了外部条件，先承认这一点，反而轻松些。',
          advice: '把可控的部分和不可控的部分分开写，先处理可控的那半。',
        },
      ],
    },
  ],
  self: [
    {
      id: 'self-body',
      question: '这种状态，身体上最明显的感觉是？',
      options: [
        {
          id: 'body-tired',
          label: '累，睡不够',
          lean: '身体的疲惫会先于情绪说话，它比想法更诚实。',
          advice: '这三天先把睡眠补回来，再评估自己的状态。',
        },
        {
          id: 'body-tight',
          label: '绷着，放松不下来',
          lean: '你一直在待命状态，弦拉得太紧了。',
          advice: '给自己安排一段没有目的的时间，二十分钟就够。',
        },
        {
          id: 'body-numb',
          label: '没什么感觉',
          lean: '麻木往往是因为感受太久没被听见，它是保护，不是冷漠。',
          advice: '从身体开始：泡个热水澡、走一段路，让感觉慢慢回来。',
        },
      ],
    },
    {
      id: 'self-need',
      question: '如果现在可以对自己说一句话，你更想说？',
      options: [
        {
          id: 'need-slow',
          label: '慢一点也没关系',
          lean: '你需要的是允许自己慢下来，而不是再加一把劲。',
          advice: '这周把一件事的截止时间往后挪，让出一段缓冲。',
        },
        {
          id: 'need-seen',
          label: '其实我挺不容易的',
          lean: '你已经做了很多，只是没人替你记着。',
          advice: '写下三件你扛过去的事，认真看一遍。',
        },
        {
          id: 'need-change',
          label: '我不想再这样下去了',
          lean: '改变的动力已经在，缺的是一个足够小的第一步。',
          advice: '把一个想改变的习惯拆到十分钟以内，明天就做一次。',
        },
      ],
    },
  ],
  relation: [
    {
      id: 'relation-gap',
      question: '这段关系里，最让你在意的是？',
      options: [
        {
          id: 'gap-misread',
          label: '感觉被误解',
          lean: '误会多来自没有说出口的部分，而不是对方不肯懂你。',
          advice: '挑一件具体的小事说清楚，不要从“你从来都……”开始。',
        },
        {
          id: 'gap-distance',
          label: '距离越来越远',
          lean: '关系的疏远常常是双方的节奏错开，不一定是有人做错了什么。',
          advice: '主动发起一次不解决问题的见面或聊天。',
        },
        {
          id: 'gap-boundary',
          label: '边界被踩，很不舒服',
          lean: '你在意的是被尊重，这一点值得说清楚。',
          advice: '把“我不太能接受……”讲给对方听，只讲这一件事。',
        },
      ],
    },
  ],
  now: [
    {
      id: 'now-tone',
      question: '这段时间，你的整体感觉更接近哪一种？',
      options: [
        {
          id: 'tone-heavy',
          label: '有点沉，走得慢',
          lean: '现在不是加速的时候，先让节奏恢复到你能呼吸的程度。',
          advice: '这周只安排三件必须完成的事，其他的往后放。',
        },
        {
          id: 'tone-flat',
          label: '平淡，没什么起伏',
          lean: '平淡不是坏事，它常常是变化前的安静。',
          advice: '给这段时间留下记录，一周后回看会有线索。',
        },
        {
          id: 'tone-stirring',
          label: '暗流涌动，说不上来',
          lean: '你已经察觉到有东西在动，只是还没成形。',
          advice: '把最近反复出现的念头写下来，哪怕只有一句。',
        },
      ],
    },
  ],
}

export function reflectQuestions(categoryId: CategoryId): ReflectQuestion[] {
  return REFLECTION[categoryId] ?? []
}

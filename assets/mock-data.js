/* IM Bot 用户分层 — 内存 + sessionStorage mock */

const STORE_KEY = 'im-bot-layering-v1';

const TAG_DEFS = [
  { key: 'vip_level', label: 'vip_level', values: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'] },
  { key: 'is_rd', label: 'is_rd', values: ['true', 'false'] },
  { key: 'is_reg', label: 'is_reg', values: ['true', 'false'] }
];

const PAGE_TYPES = ['首页', '列表', '分类菜单', '过渡', '收尾兜底'];
const BUTTON_EVENTS = [
  { value: 'open_node', label: '打开节点' },
  { value: 'open_flow', label: '打开对话流' },
  { value: 'back_menu', label: '回主菜单' },
  { value: 'open_bp', label: '打开 BP URL' },
  { value: 'none', label: '无' }
];
const IMAGE_PRESETS = [
  { value: '', label: '不使用图片' },
  { value: 'https://cdn.example.com/welcome.jpg', label: '欢迎图' },
  { value: 'https://cdn.example.com/offer.jpg', label: '活动图' },
  { value: 'https://cdn.example.com/rewards.jpg', label: '奖励图' },
  { value: 'https://cdn.example.com/vip.jpg', label: 'VIP 专属图' }
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function nowTs() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function makeBtn(id, text, event, extra = {}) {
  return {
    id,
    text,
    event,
    paramNodeId: extra.paramNodeId || '',
    paramFlowId: extra.paramFlowId || '',
    paramVariantKey: extra.paramVariantKey || '',
    paramBpUrl: extra.paramBpUrl || '',
    style: extra.style || 'primary',
    sort: extra.sort || 1,
    variantOverrides: extra.variantOverrides || []
  };
}

const SEED = {
  seq: 200,
  bots: [
    {
      id: 'bot_1',
      botName: 'BingoPlus_Official',
      botToken: '7283****:AAH****CmKpq',
      botUsername: '@BingoPlusBot',
      platforms: ['tg', 'wa', 'vb', 'ms'],
      status: 'SUCCESS',
      createTime: '2026-05-12 10:24:18',
      autoLoginPages: [
        { id: 'al_1', autoLoginUrl: 'https://example.com/order', pageType: 'H5', palCode: 'TG_ORDER' },
        { id: 'al_2', autoLoginUrl: 'https://example.com/mini/wallet', pageType: 'Mini App', palCode: 'TG_WALLET' }
      ]
    },
    {
      id: 'bot_2',
      botName: 'Rewards_Support',
      botToken: '6691****:AAG****QwxRt',
      botUsername: '@RewardsSupportBot',
      platforms: ['tg', 'ms'],
      status: 'SUCCESS',
      createTime: '2026-06-03 15:41:02',
      autoLoginPages: [
        { id: 'al_3', autoLoginUrl: 'https://rewards.example.com/claim', pageType: 'H5', palCode: 'RW_CLAIM' }
      ]
    },
    {
      id: 'bot_3',
      botName: 'GameLobby_Bot',
      botToken: '5510****:AAF****LpZyT',
      botUsername: '@GameLobbyBot',
      platforms: ['tg', 'wa'],
      status: 'SUCCESS',
      createTime: '2026-07-01 09:12:45',
      autoLoginPages: []
    }
  ],
  flows: [
    {
      id: 'flow_home',
      name: '首页承接',
      type: 'normal',
      status: 'published',
      firstScreenNodeId: 'node_welcome',
      mainMenuKeyboardId: 'keyboard_main',
      updatedAt: '2026-09-14 16:40:00',
      nodes: [
        {
          id: 'node_welcome',
          name: '欢迎页',
          nodeType: 'message',
          pageType: '首页',
          keyboardId: 'keyboard_welcome',
          cards: [{
            image: 'https://cdn.example.com/welcome.jpg',
            title: '欢迎回来',
            subtitle: '今日推荐活动',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [
              makeBtn('btn_w1', '查看活动', 'open_node', {
                paramNodeId: 'node_offer',
                sort: 1,
                variantOverrides: [{ variantKey: 'vip', text: '进入专属活动' }]
              }),
              makeBtn('btn_w2', '我的奖励', 'open_node', { paramNodeId: 'node_rewards', style: 'secondary', sort: 2 })
            ]
          }]
        },
        {
          id: 'node_offer',
          name: '活动页',
          nodeType: 'message',
          pageType: '列表',
          keyboardId: '',
          cards: [{
            image: 'https://cdn.example.com/offer.jpg',
            title: '本周精选活动',
            subtitle: '充值即送',
            statusLine: '',
            descLine: '完成任务可获得奖励',
            progress: '',
            buttons: [
              makeBtn('btn_o1', '去充值', 'open_bp', { paramBpUrl: 'https://bp.com/deposit?mid={memberId}', sort: 1 })
            ]
          }]
        },
        {
          id: 'node_rewards',
          name: '奖励页',
          nodeType: 'message',
          pageType: '列表',
          keyboardId: '',
          cards: [{
            image: 'https://cdn.example.com/rewards.jpg',
            title: '我的奖励',
            subtitle: '待领取 2 项',
            statusLine: '进度 50%',
            descLine: '',
            progress: 50,
            buttons: [
              makeBtn('btn_r1', '立即领取', 'open_bp', { paramBpUrl: 'https://bp.com/rewards?mid={memberId}', sort: 1 })
            ]
          }]
        },
        {
          id: 'node_levelup',
          name: '升级页',
          nodeType: 'message',
          pageType: '过渡',
          keyboardId: '',
          cards: [{
            image: '',
            title: '升级攻略',
            subtitle: '查看 VIP 权益',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [
              makeBtn('btn_l1', '回主菜单', 'back_menu', { style: 'secondary', sort: 1 })
            ]
          }]
        },
        {
          id: 'keyboard_main',
          name: '主菜单键盘',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [
            makeBtn('kb_m1', '首页', 'open_node', { paramNodeId: 'node_welcome', sort: 1 }),
            makeBtn('kb_m2', '活动', 'open_node', { paramNodeId: 'node_offer', sort: 2 }),
            makeBtn('kb_m3', '奖励', 'open_node', { paramNodeId: 'node_rewards', sort: 3 })
          ]
        },
        {
          id: 'keyboard_welcome',
          name: '欢迎页键盘',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [
            makeBtn('kb_w1', '主菜单', 'back_menu', { sort: 1 })
          ]
        }
      ],
      variants: [
        { key: 'default', name: '默认', status: 'active', nodeOverrides: {} },
        {
          key: 'vip',
          name: 'VIP 专属',
          status: 'active',
          nodeOverrides: {
            node_welcome: {
              cards: [{
                title: '尊贵的 VIP，欢迎回来',
                subtitle: '专属活动已为您准备',
                image: 'https://cdn.example.com/vip.jpg',
                buttons: { btn_w1: { text: '进入专属活动' } }
              }]
            }
          }
        }
      ]
    },
    {
      id: 'flow_support',
      name: '客服承接',
      type: 'normal',
      status: 'published',
      firstScreenNodeId: 'node_support_hi',
      mainMenuKeyboardId: 'keyboard_support',
      updatedAt: '2026-09-12 11:08:00',
      nodes: [
        {
          id: 'node_support_hi',
          name: '客服欢迎',
          nodeType: 'message',
          pageType: '首页',
          keyboardId: '',
          cards: [{
            image: '',
            title: '需要帮助吗？',
            subtitle: '查看常见问题',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [makeBtn('btn_s1', '回首页', 'open_flow', { paramFlowId: 'flow_home', paramVariantKey: '', sort: 1 })]
          }]
        },
        {
          id: 'keyboard_support',
          name: '客服主菜单',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [makeBtn('kb_s1', '首页', 'open_flow', { paramFlowId: 'flow_home', sort: 1 })]
        }
      ],
      variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
    },
    {
      id: 'flow_promo',
      name: '活动草稿',
      type: 'normal',
      status: 'draft',
      firstScreenNodeId: '',
      mainMenuKeyboardId: '',
      updatedAt: '2026-09-15 09:12:00',
      nodes: [],
      variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
    },
    {
      id: 'sys_bind',
      name: '绑定流程',
      type: 'system',
      status: 'published',
      purpose: '未绑定时进入，完成后用原 context 重走',
      firstScreenNodeId: 'node_bind',
      mainMenuKeyboardId: 'keyboard_bind',
      updatedAt: '2026-09-01 00:00:00',
      nodes: [
        {
          id: 'node_bind',
          name: '绑定引导',
          nodeType: 'message',
          pageType: '首页',
          keyboardId: '',
          cards: [{
            image: '',
            title: '请先绑定账号',
            subtitle: '绑定后即可享受个性化承接',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [makeBtn('btn_b1', '去绑定', 'open_bp', { paramBpUrl: 'https://bp.com/bind?mid={memberId}', sort: 1 })]
          }]
        },
        {
          id: 'keyboard_bind',
          name: '绑定键盘',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [makeBtn('kb_b1', '稍后', 'none', { style: 'secondary', sort: 1 })]
        }
      ],
      variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
    },
    {
      id: 'sys_default',
      name: '全局默认',
      type: 'system',
      status: 'published',
      purpose: '所有策略落空时使用的兜底对话流',
      firstScreenNodeId: 'node_sys_hi',
      mainMenuKeyboardId: 'keyboard_sys_default',
      updatedAt: '2026-09-01 00:00:00',
      nodes: [
        {
          id: 'node_sys_hi',
          name: '默认欢迎',
          nodeType: 'message',
          pageType: '首页',
          keyboardId: '',
          cards: [{
            image: '',
            title: '欢迎来到 BingoPlus',
            subtitle: '为您展示默认内容',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [makeBtn('btn_d1', '查看活动', 'none', { sort: 1 })]
          }]
        },
        {
          id: 'keyboard_sys_default',
          name: '默认键盘',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [makeBtn('kb_d1', '首页', 'back_menu', { sort: 1 })]
        }
      ],
      variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
    },
    {
      id: 'sys_offline',
      name: '离线留单',
      type: 'system',
      status: 'published',
      purpose: '客服离线时使用',
      firstScreenNodeId: 'node_offline',
      mainMenuKeyboardId: 'keyboard_offline',
      updatedAt: '2026-09-01 00:00:00',
      nodes: [
        {
          id: 'node_offline',
          name: '离线提示',
          nodeType: 'message',
          pageType: '收尾兜底',
          keyboardId: '',
          cards: [{
            image: '',
            title: '客服暂时离线',
            subtitle: '请留下您的问题，上线后回复',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [makeBtn('btn_off1', '无', 'none', { sort: 1 })]
          }]
        },
        {
          id: 'keyboard_offline',
          name: '离线键盘',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [makeBtn('kb_off1', '回主菜单', 'back_menu', { sort: 1 })]
        }
      ],
      variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
    },
    {
      id: 'sys_finish',
      name: '收尾',
      type: 'system',
      status: 'published',
      purpose: '客服会话结束后使用',
      firstScreenNodeId: 'node_finish',
      mainMenuKeyboardId: 'keyboard_finish',
      updatedAt: '2026-09-01 00:00:00',
      nodes: [
        {
          id: 'node_finish',
          name: '会话结束',
          nodeType: 'message',
          pageType: '收尾兜底',
          keyboardId: '',
          cards: [{
            image: '',
            title: '本次会话已结束',
            subtitle: '感谢您的咨询',
            statusLine: '',
            descLine: '',
            progress: '',
            buttons: [makeBtn('btn_f1', '回主菜单', 'back_menu', { sort: 1 })]
          }]
        },
        {
          id: 'keyboard_finish',
          name: '收尾键盘',
          nodeType: 'keyboard',
          pageType: '',
          keyboardId: '',
          cards: [],
          buttons: [makeBtn('kb_f1', '首页', 'open_flow', { paramFlowId: 'flow_home', sort: 1 })]
        }
      ],
      variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
    }
  ],
  groups: [
    {
      id: 'home',
      name: '首页策略组',
      defaultFlowId: 'flow_home',
      defaultVariantKey: 'default',
      status: 'active',
      updatedAt: '2026-09-14 18:00:00'
    },
    {
      id: 'campaign',
      name: '活动策略组',
      defaultFlowId: 'flow_support',
      defaultVariantKey: 'default',
      status: 'active',
      updatedAt: '2026-09-10 10:20:00'
    }
  ],
  strategies: [
    {
      id: 'str_001',
      groupId: 'home',
      name: 'VIP6-8 首页',
      sourceCondition: 'flow_home',
      tagConditions: [{ key: 'vip_level', op: 'in', value: ['V6', 'V7', 'V8'] }],
      takeoverFlowId: 'flow_home',
      takeoverVariantKey: 'vip',
      priority: 10,
      validStart: '2026-09-01',
      validEnd: '2026-12-31',
      status: 'active',
      updatedAt: '2026-09-14 18:10:00'
    },
    {
      id: 'str_002',
      groupId: 'home',
      name: 'RD 用户首页',
      sourceCondition: 'flow_home',
      tagConditions: [{ key: 'is_rd', op: '=', value: ['true'] }],
      takeoverFlowId: 'flow_home',
      takeoverVariantKey: 'default',
      priority: 20,
      validStart: '',
      validEnd: '',
      status: 'active',
      updatedAt: '2026-09-13 12:00:00'
    },
    {
      id: 'str_003',
      groupId: 'campaign',
      name: '已注册活动',
      sourceCondition: 'flow_support',
      tagConditions: [{ key: 'is_reg', op: '=', value: ['true'] }],
      takeoverFlowId: 'flow_support',
      takeoverVariantKey: 'default',
      priority: 10,
      validStart: '2026-09-01',
      validEnd: '',
      status: 'draft',
      updatedAt: '2026-09-11 09:30:00'
    }
  ]
};

function loadStore() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return clone(SEED);
}

function saveStore() {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(DB));
}

let DB = loadStore();

function nextId(prefix) {
  DB.seq += 1;
  saveStore();
  return `${prefix}_${DB.seq}`;
}

function isIdToken(s, max = 30) {
  return /^[a-z][a-z0-9_]{0,29}$/.test(s) && s.length <= max;
}

function eventLabel(v) {
  return BUTTON_EVENTS.find(e => e.value === v)?.label || v || '-';
}

function formatTagCondition(list) {
  if (!list || !list.length) return '不限';
  return list.map(c => {
    if (c.op === 'in') return `${c.key} in (${(c.value || []).join(', ')})`;
    return `${c.key} = ${(c.value || [])[0] || ''}`;
  }).join(' AND ');
}

function normalFlows() {
  return DB.flows.filter(f => f.type !== 'system');
}

function systemFlows() {
  return DB.flows.filter(f => f.type === 'system');
}

function publishedFlows() {
  return normalFlows().filter(f => f.status === 'published');
}

function flowById(id) {
  return DB.flows.find(f => f.id === id);
}

function groupById(id) {
  return DB.groups.find(g => g.id === id);
}

function strategyById(id) {
  return DB.strategies.find(s => s.id === id);
}

function messageNodes(flow) {
  return (flow?.nodes || []).filter(n => n.nodeType === 'message');
}

function keyboardNodes(flow) {
  return (flow?.nodes || []).filter(n => n.nodeType === 'keyboard');
}

function firstScreenCandidates(flow) {
  return messageNodes(flow).filter(n => (n.cards || []).length === 1);
}

function groupRefCount(groupId) {
  return DB.strategies.filter(s => s.groupId === groupId).length;
}

function flowRefCount(flowId) {
  const fromStrategies = DB.strategies.filter(s => s.takeoverFlowId === flowId).length;
  const fromGroups = DB.groups.filter(g => g.defaultFlowId === flowId).length;
  return fromStrategies + fromGroups;
}

function variantRefCount(flowId, key) {
  const fromS = DB.strategies.filter(s => s.takeoverFlowId === flowId && s.takeoverVariantKey === key).length;
  const fromG = DB.groups.filter(g => g.defaultFlowId === flowId && g.defaultVariantKey === key).length;
  return fromS + fromG;
}

function overrideCount(variant) {
  if (!variant?.nodeOverrides) return 0;
  let n = 0;
  Object.values(variant.nodeOverrides).forEach(node => {
    (node.cards || []).forEach(card => {
      ['title', 'subtitle', 'image', 'statusLine', 'descLine', 'progress'].forEach(k => {
        if (card[k] !== undefined && card[k] !== '' && card[k] !== null) n += 1;
      });
      if (card.buttons) n += Object.keys(card.buttons).length;
    });
  });
  return n;
}

function flowPreview(flow, variantKey) {
  return `${flow?.id || '-'}+${variantKey || 'default'}`;
}

function nodeById(flow, nodeId) {
  return (flow?.nodes || []).find(n => n.id === nodeId);
}

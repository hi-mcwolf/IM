/* IM Bot 用户分层 v0.4 — 内存 + sessionStorage mock */

const STORE_KEY = 'im-bot-layering-v05';

const PRODUCT_LINES = [
  { id: 'digiplus', name: 'digiplus' },
  { id: 'BingoPlus', name: 'BingoPlus' }
];

const TAG_GROUPS = [
  { category: '用户等级', tags: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'] },
  { category: '生命周期', tags: ['rd', 'fd'] }
];

const TAG_LABELS = { rd: 'rd', fd: 'fd' };

const PAGE_TYPES = ['首页', '列表', '状态', '分类菜单', '过渡', '收尾'];

const BUTTON_EVENTS = [
  { value: 'Page', label: '页面' },
  { value: 'Url', label: 'URL' },
  { value: 'Flow', label: '对话流' },
  { value: 'Event', label: '事件' },
  { value: 'Home', label: '回主菜单' }
];

const BUILTIN_EVENTS = [
  { value: 'Support', label: '调起客服' },
  { value: 'SharePhone', label: '分享手机号' },
  { value: 'WifiCode', label: 'wifi code' }
];

const IMAGE_PRESETS = [
  { value: '', label: '不使用图片' },
  { value: 'https://cdn.example.com/welcome.jpg', label: '欢迎图' },
  { value: 'https://cdn.example.com/offer.jpg', label: '活动图' },
  { value: 'https://cdn.example.com/vip.jpg', label: 'VIP 图' }
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
    pageId: extra.pageId || '',
    url: extra.url || '',
    autoLogin: extra.autoLogin || false,
    flowId: extra.flowId || '',
    eventType: extra.eventType || '',
    style: extra.style || 'primary',
    displayTags: extra.displayTags || [],
    sort: extra.sort || 1
  };
}

function makePage(id, name, pageType, extra = {}) {
  return {
    id,
    name,
    pageType,
    image: extra.image || '',
    text: extra.text || '',
    cardButtons: extra.cardButtons || [],
    mainMenuOverrideId: extra.mainMenuOverrideId || '',
    autoNextPageId: extra.autoNextPageId || '',
    status: extra.status || 'active',
    order: extra.order || 0
  };
}

const SEED = {
  seq: 300,
  bots: [
    {
      id: 'bot_1',
      botName: 'BingoPlus_Official',
      botToken: '7283****:AAH****CmKpq',
      botUsername: '@BingoPlusBot',
      productLineId: 'BingoPlus',
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
      productLineId: 'BingoPlus',
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
      productLineId: 'digiplus',
      platforms: ['vb'],
      status: 'SUCCESS',
      createTime: '2026-07-01 09:12:45',
      autoLoginPages: []
    }
  ],
  menus: [
    {
      id: 'menu_main',
      name: '主菜单',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      status: 'active',
      buttons: [
        makeBtn('mb_1', '首页', 'Page', { pageId: 'page_welcome', style: 'primary', sort: 1 }),
        makeBtn('mb_2', '活动', 'Page', { pageId: 'page_offer', style: 'primary', sort: 2 }),
        makeBtn('mb_3', '客服', 'Event', { eventType: 'Support', style: 'secondary', sort: 3 }),
        makeBtn('mb_4', '回首页', 'Home', { style: 'secondary', sort: 4 })
      ]
    },
    {
      id: 'menu_support',
      name: '客服菜单',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      status: 'active',
      buttons: [
        makeBtn('msb_1', '联系客服', 'Event', { eventType: 'Support', style: 'primary', sort: 1 }),
        makeBtn('msb_2', '回首页', 'Flow', { flowId: 'flow_vip_home', style: 'secondary', sort: 2 })
      ]
    },
    {
      id: 'menu_bind',
      name: '绑定菜单',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      status: 'active',
      buttons: [
        makeBtn('mbb_1', '分享手机号', 'Event', { eventType: 'SharePhone', style: 'primary', sort: 1 })
      ]
    }
  ],
  flows: [
    {
      id: 'flow_vip_home',
      name: 'VIP大客首页',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'normal',
      status: 'published',
      mainMenuId: 'menu_main',
      firstPageId: 'page_welcome',
      remark: '',
      updatedAt: '2026-09-16 16:40:00',
      pages: [
        makePage('page_welcome', '欢迎页', '首页', {
          order: 0,
          image: 'https://cdn.example.com/vip.jpg',
          text: '尊贵的 VIP，欢迎回来 {nickname}',
          cardButtons: [
            makeBtn('cb_w1', '查看活动详情', 'Page', { pageId: 'page_offer', sort: 1 }),
            makeBtn('cb_w2', '去充值', 'Url', { url: 'https://bp.com/deposit?mid={memberId}', autoLogin: true, sort: 2 })
          ]
        }),
        makePage('page_offer', '活动详情', '列表', {
          order: 1,
          image: 'https://cdn.example.com/offer.jpg',
          text: '本周精选活动，充值即送',
          cardButtons: [
            makeBtn('cb_o1', '去充值', 'Url', { url: 'https://bp.com/deposit?mid={memberId}', autoLogin: true, sort: 1 })
          ]
        }),
        makePage('page_wifi', 'Wifi', '过渡', {
          order: 2,
          text: '请使用场内 Wifi',
          cardButtons: [
            makeBtn('cb_wf1', '获取 wifi code', 'Event', { eventType: 'WifiCode', sort: 1 })
          ]
        })
      ]
    },
    {
      id: 'flow_member',
      name: '普通会员首页',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'normal',
      status: 'published',
      mainMenuId: 'menu_main',
      firstPageId: 'page_member_hi',
      remark: '',
      updatedAt: '2026-09-15 11:08:00',
      pages: [
        makePage('page_member_hi', '会员欢迎', '首页', {
          order: 0,
          image: 'https://cdn.example.com/welcome.jpg',
          text: '欢迎回来，今日推荐活动',
          cardButtons: [
            makeBtn('cb_m1', '查看活动', 'Page', { pageId: 'page_member_offer', sort: 1 })
          ]
        }),
        makePage('page_member_offer', '会员活动', '列表', {
          order: 1,
          text: '完成任务可获得奖励',
          cardButtons: [
            makeBtn('cb_m2', '分享手机号', 'Event', { eventType: 'SharePhone', sort: 1 })
          ]
        })
      ]
    },
    {
      id: 'flow_cs',
      name: '客服入口',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'normal',
      status: 'published',
      mainMenuId: 'menu_support',
      firstPageId: 'page_cs_hi',
      remark: '',
      updatedAt: '2026-09-14 09:12:00',
      pages: [
        makePage('page_cs_hi', '客服欢迎', '首页', {
          order: 0,
          text: '需要帮助吗？点击下方联系客服',
          cardButtons: [
            makeBtn('cb_cs1', '联系客服', 'Event', { eventType: 'Support', sort: 1 })
          ]
        })
      ]
    },
    {
      id: 'flow_promo',
      name: '活动草稿',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'normal',
      status: 'draft',
      mainMenuId: 'menu_main',
      firstPageId: '',
      remark: '',
      updatedAt: '2026-09-16 09:12:00',
      pages: []
    },
    {
      id: 'sys_bind',
      name: '绑定对话流',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'bind',
      status: 'published',
      purpose: '未绑定用户显示',
      mainMenuId: 'menu_bind',
      firstPageId: 'page_bind',
      remark: '用于未绑定用户显示',
      updatedAt: '2026-09-01 00:00:00',
      pages: [
        makePage('page_bind', '绑定引导', '首页', {
          order: 0,
          text: '请先绑定账号，绑定后即可享受个性化承接',
          cardButtons: [
            makeBtn('cb_b1', '分享手机号', 'Event', { eventType: 'SharePhone', sort: 1 })
          ]
        })
      ]
    },
    {
      id: 'sys_default',
      name: '兜底对话流',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'fallback',
      status: 'published',
      purpose: '所有策略都没匹配上时显示',
      mainMenuId: 'menu_main',
      firstPageId: 'page_sys_hi',
      remark: '用于所有策略都没匹配上',
      updatedAt: '2026-09-01 00:00:00',
      pages: [
        makePage('page_sys_hi', '默认欢迎', '首页', {
          order: 0,
          text: '欢迎来到 BingoPlus',
          cardButtons: [
            makeBtn('cb_d1', '查看活动', 'Home', { sort: 1 })
          ]
        })
      ]
    },
    {
      id: 'sys_offline',
      name: '离线留单',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'system',
      status: 'published',
      purpose: '客服无坐席时走此流程',
      mainMenuId: 'menu_support',
      firstPageId: 'page_offline',
      updatedAt: '2026-09-01 00:00:00',
      pages: [
        makePage('page_offline', '离线提示', '收尾', {
          order: 0,
          text: '客服暂时离线，请留下您的问题',
          cardButtons: []
        })
      ]
    },
    {
      id: 'sys_finish',
      name: '收尾',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      type: 'system',
      status: 'published',
      purpose: '客服会话结束走此流程',
      mainMenuId: 'menu_support',
      firstPageId: 'page_finish',
      updatedAt: '2026-09-01 00:00:00',
      pages: [
        makePage('page_finish', '会话结束', '收尾', {
          order: 0,
          text: '本次会话已结束，感谢您的咨询',
          cardButtons: [
            makeBtn('cb_f1', '回主菜单', 'Home', { sort: 1 })
          ]
        })
      ]
    }
  ],
  scenes: [
    {
      id: 'scene_vip',
      name: 'VIP大客',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      entryFlowId: '',
      useStrategy: true,
      effectiveStart: '2026-09-01 00:00:00',
      effectiveEnd: '2026-12-31 23:59:59',
      status: 'active',
      remark: 'deeplink source=scene_vip',
      createdAt: '2026-09-10 10:00:00',
      updatedAt: '2026-09-16 18:00:00'
    },
    {
      id: 'scene_member',
      name: '普通会员',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      entryFlowId: '',
      useStrategy: true,
      effectiveStart: '',
      effectiveEnd: '',
      status: 'active',
      remark: '',
      createdAt: '2026-09-10 10:05:00',
      updatedAt: '2026-09-15 12:00:00'
    },
    {
      id: 'scene_cs',
      name: '客服',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      entryFlowId: 'flow_cs',
      useStrategy: false,
      effectiveStart: '',
      effectiveEnd: '',
      status: 'active',
      remark: '专属客服入口，不走策略',
      createdAt: '2026-09-10 10:10:00',
      updatedAt: '2026-09-14 09:00:00'
    }
  ],
  strategies: [
    {
      id: 'strategy_vip68',
      sceneId: 'scene_vip',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      tags: ['V6', 'V7', 'V8'],
      flowId: 'flow_vip_home',
      priority: 10,
      effectiveStart: '2026-09-01 00:00:00',
      effectiveEnd: '2026-12-31 23:59:59',
      status: 'active',
      remark: '',
      createdAt: '2026-09-14 18:10:00'
    },
    {
      id: 'strategy_rd',
      sceneId: 'scene_vip',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      tags: ['rd'],
      flowId: 'flow_member',
      priority: 20,
      effectiveStart: '',
      effectiveEnd: '',
      status: 'active',
      remark: '',
      createdAt: '2026-09-13 12:00:00'
    },
    {
      id: 'strategy_member_default',
      sceneId: 'scene_member',
      productLineId: 'BingoPlus',
      botId: 'bot_1',
      tags: ['V1', 'V2', 'V3', 'V4', 'V5'],
      flowId: 'flow_member',
      priority: 10,
      effectiveStart: '',
      effectiveEnd: '',
      status: 'active',
      remark: '',
      createdAt: '2026-09-11 09:30:00'
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

function isIdToken(s, max = 50) {
  return /^[a-z][a-z0-9_]{0,49}$/.test(s) && s.length <= max;
}

function eventLabel(v) {
  return BUTTON_EVENTS.find(e => e.value === v)?.label || v || '-';
}

function builtinEventLabel(v) {
  return BUILTIN_EVENTS.find(e => e.value === v)?.label || v || '-';
}

function tagLabel(t) {
  return TAG_LABELS[t] || t;
}

function formatTags(tags) {
  if (!tags || !tags.length) return '-';
  return tags.map(tagLabel).join(' / ');
}

function productLineById(id) {
  return PRODUCT_LINES.find(p => p.id === id);
}

function botsByProductLine(pl) {
  return DB.bots.filter(b => !pl || b.productLineId === pl);
}

function defaultProductLine() {
  return PRODUCT_LINES[1]?.id || PRODUCT_LINES[0].id;
}

function defaultBot(pl) {
  return botsByProductLine(pl)[0]?.id || '';
}

function isFixedFlow(f) {
  return !!f && (f.type === 'bind' || f.type === 'fallback');
}

function fixedFlowLabel(type) {
  if (type === 'bind') return '绑定对话流';
  if (type === 'fallback') return '兜底对话流';
  return '';
}

function findFixedFlow(pl, botId, type) {
  return DB.flows.find(f => f.productLineId === pl && f.botId === botId && f.type === type);
}

function normalFlows() {
  return DB.flows.filter(f => f.type !== 'system');
}

function systemFlows() {
  return DB.flows.filter(f => f.type === 'system');
}

function publishedFlows(pl, botId) {
  return DB.flows.filter(f => f.status === 'published' && f.type !== 'system' && (!pl || f.productLineId === pl) && (!botId || f.botId === botId));
}

function publishedMatchFlows(pl, botId) {
  return publishedFlows(pl, botId).filter(f => f.type === 'normal' || !f.type);
}

function flowById(id) {
  return DB.flows.find(f => f.id === id);
}

function menuById(id) {
  return (DB.menus || []).find(m => m.id === id);
}

function menusByScope(pl, botId) {
  return (DB.menus || []).filter(m => (!pl || m.productLineId === pl) && (!botId || m.botId === botId));
}

function sceneById(id) {
  return DB.scenes.find(s => s.id === id);
}

function scenesByScope(pl, botId) {
  return DB.scenes.filter(s => (!pl || s.productLineId === pl) && (!botId || s.botId === botId));
}

function strategyById(id) {
  return DB.strategies.find(s => s.id === id);
}

function pageById(flow, pageId) {
  return (flow?.pages || []).find(p => p.id === pageId);
}

function sceneRefCount(sceneId) {
  return DB.strategies.filter(s => s.sceneId === sceneId).length;
}

function flowRefCount(flowId) {
  const fromS = DB.strategies.filter(s => s.flowId === flowId).length;
  const fromSc = DB.scenes.filter(s => s.entryFlowId === flowId).length;
  return fromS + fromSc;
}

function menuButtonCount(menuId) {
  return (menuById(menuId)?.buttons || []).length;
}

function productLineOptions(selected) {
  return PRODUCT_LINES.map(p => optionHtml(p.id, p.name, selected)).join('');
}

function botOptions(pl, selected) {
  return botsByProductLine(pl).map(b => optionHtml(b.id, b.botName, selected)).join('');
}

function sceneOptions(pl, botId, selected) {
  return scenesByScope(pl, botId).map(s => optionHtml(s.id, `${s.name} (${s.id})`, selected)).join('');
}

function publishedFlowOptions(pl, botId, selected) {
  return publishedFlows(pl, botId).map(f => optionHtml(f.id, `${f.name} (${f.id})`, selected)).join('');
}

function publishedMatchFlowOptions(pl, botId, selected) {
  return publishedMatchFlows(pl, botId).map(f => optionHtml(f.id, `${f.name} (${f.id})`, selected)).join('');
}

function menuOptions(pl, botId, selected) {
  return menusByScope(pl, botId).map(m => optionHtml(m.id, `${m.name} (${m.id})`, selected)).join('');
}

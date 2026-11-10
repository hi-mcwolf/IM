/* Messenger Bot 配置：底部菜单（Persistent Menu）+ 键盘与文字处理，按 产品线 + Bot（平台固定 Messenger） */

const MS_PLATFORM = 'messenger';
let filters = readQueryFilters(['pl', 'bot']);
let cfg = null;
let sim = '';
let dirty = false;

if (!filters.pl) filters.pl = defaultProductLine();
if (!filters.bot || !botsByScope(filters.pl, MS_PLATFORM).some(b => b.id === filters.bot)) filters.bot = defaultBot(filters.pl, MS_PLATFORM);

function loadCfg() {
  cfg = filters.bot ? getMsCfg(filters.pl, filters.bot) : null;
  dirty = false;
  sim = '';
}

function onPl() {
  filters.pl = document.getElementById('f-pl').value;
  filters.bot = defaultBot(filters.pl, MS_PLATFORM);
  writeQueryFilters(filters);
  loadCfg();
  render();
}

function onBot() {
  filters.bot = document.getElementById('f-bot').value;
  writeQueryFilters(filters);
  loadCfg();
  render();
}

/* ---------- 校验 ---------- */
function validate(c) {
  const errs = [];
  const L = MS_LIMITS;
  if (c.items.length > L.menuItems) errs.push(`菜单最多 ${L.menuItems} 项`);
  if (c.composerHidden && c.items.length < 1) errs.push('键盘默认隐藏为开时，菜单至少 1 项（平台要求）');
  c.items.forEach((it, i) => {
    const n = `第 ${i + 1} 项`;
    if (!it.title.trim()) errs.push(`${n}：请填写菜单文案`);
    else if (it.title.length > L.menuTitle) errs.push(`${n}：菜单文案最多 ${L.menuTitle} 字符`);
    if (it.action === 'Page' && (!it.flowId || !it.pageId)) errs.push(`${n}：请选择对话流和页面`);
    if (it.action === 'Flow' && !it.flowId) errs.push(`${n}：请选择对话流`);
    if (it.action === 'Event' && !it.eventType) errs.push(`${n}：请选择事件`);
    if (it.action === 'Url' && !/^https:\/\/[^\s]+$/.test(it.url.trim())) errs.push(`${n}：请输入合法的 https 链接`);
  });
  if (!c.endText.trim()) errs.push('请填写结束会话文案');
  else if (c.endText.length > L.menuTitle) errs.push(`结束会话文案最多 ${L.menuTitle} 字符`);
  if (!c.composerHidden && !c.boundToSupport) {
    if (!c.promptText.trim()) errs.push('请填写提示文案');
    else if (c.promptText.length > 200) errs.push('提示文案最多 200 字符');
    if (!c.qrTitle.trim()) errs.push('请填写快速回复文案');
    else if (c.qrTitle.length > 20) errs.push('快速回复文案最多 20 字符');
  }
  return errs;
}

/* ---------- 数据操作 ---------- */
function flowsOfBot() {
  return DB.flows.filter(f => f.platform === MS_PLATFORM && f.productLineId === filters.pl && f.botId === filters.bot);
}

function touch() { dirty = true; renderPreview(); renderErrors(); }

function setField(k, v) { cfg[k] = v; dirty = true; render(); }

function setText(k, v) { cfg[k] = v; touch(); updateCounters(); }

function setItem(i, k, v, rerender) {
  const it = cfg.items[i];
  it[k] = v;
  if (k === 'action') { it.flowId = ''; it.pageId = ''; it.eventType = ''; it.url = ''; }
  if (k === 'flowId') it.pageId = '';
  dirty = true;
  if (rerender) render(); else touch();
}

function addItem() {
  if (cfg.items.length >= MS_LIMITS.menuItems) { showToast(`最多 ${MS_LIMITS.menuItems} 项`, 'err'); return; }
  cfg.items.push({ id: nextId('mi'), title: '', action: 'Event', flowId: '', pageId: '', eventType: '', url: '' });
  dirty = true;
  render();
}

function delItem(i) { cfg.items.splice(i, 1); dirty = true; render(); }

function moveItem(i, d) {
  const j = i + d;
  if (j < 0 || j >= cfg.items.length) return;
  [cfg.items[i], cfg.items[j]] = [cfg.items[j], cfg.items[i]];
  dirty = true;
  render();
}

function setSim(v) { sim = v; renderPreview(); }

function saveDraft() {
  saveMsCfg(filters.pl, filters.bot, cfg);
  dirty = false;
  showToast('已保存');
  render();
}

async function resetCfg() {
  const pub = getMsCfgPub(filters.pl, filters.bot);
  const ok = await confirmModal({ title: '确认重置？', message: pub ? '将恢复为已发布版本，当前修改会丢失' : '尚未发布过，将恢复为默认配置，当前修改会丢失', confirmText: '确认重置', danger: false });
  if (!ok) return;
  cfg = pub ? (() => { const c = clone(pub); delete c.publishedAt; return c; })() : defaultMsCfg();
  saveMsCfg(filters.pl, filters.bot, cfg);
  dirty = false;
  showToast('已重置');
  render();
}

async function publishCfg() {
  const errs = validate(cfg);
  if (errs.length) { showToast('请先修正校验项', 'err'); return; }
  const ok = await confirmModal({ title: '确认发布到 Messenger？', message: '将同步底部菜单和键盘默认状态（Page 级设置），最长 24 小时生效；系统会确保 Get Started 已开启。', confirmText: '确认发布', danger: false });
  if (!ok) return;
  const btn = document.getElementById('ms-publish');
  btn.disabled = true; btn.textContent = '同步中…';
  setTimeout(() => {
    saveMsCfg(filters.pl, filters.bot, cfg);
    publishMsCfg(filters.pl, filters.bot, cfg);
    dirty = false;
    showToast('已同步到 Messenger');
    render();
  }, 900);
}

/* ---------- 渲染 ---------- */
function targetHtml(it, i) {
  const flows = flowsOfBot();
  if (it.action === 'Page') {
    const pages = it.flowId ? (flowById(it.flowId)?.pages || []) : [];
    return `<select class="select" onchange="setItem(${i},'flowId',this.value,true)"><option value="">选择对话流</option>${flows.map(f => optionHtml(f.id, f.name, it.flowId)).join('')}</select>
      <select class="select" onchange="setItem(${i},'pageId',this.value)"><option value="">选择页面</option>${pages.map(p => optionHtml(p.id, p.name, it.pageId)).join('')}</select>`;
  }
  if (it.action === 'Flow') return `<select class="select" onchange="setItem(${i},'flowId',this.value)"><option value="">选择对话流</option>${flows.map(f => optionHtml(f.id, f.name, it.flowId)).join('')}</select>`;
  if (it.action === 'Event') return `<select class="select" onchange="setItem(${i},'eventType',this.value)"><option value="">选择事件</option>${MS_MENU_EVENTS.map(e => optionHtml(e.value, e.label, it.eventType)).join('')}</select>`;
  return `<input class="input" placeholder="https://" value="${esc(it.url)}" oninput="setItem(${i},'url',this.value)" />`;
}

const MS_MENU_EVENTS = [{ value: 'Support', label: '调起客服' }, { value: 'SharePhone', label: '分享手机号' }];
const MS_MENU_ACTIONS = [{ value: 'Page', label: '页面' }, { value: 'Flow', label: '对话流' }, { value: 'Event', label: '事件' }, { value: 'Url', label: 'URL' }];

function itemRows() {
  if (!cfg.items.length) return '<div class="table-empty" style="padding:12px">暂无菜单项</div>';
  return cfg.items.map((it, i) => `
    <div class="mc-item">
      <div class="mc-item-no">${i + 1}</div>
      <div><input class="input" placeholder="菜单文案，最多 30 字符" value="${esc(it.title)}" oninput="setItem(${i},'title',this.value);updateCounters()" /><div class="counter mc-cnt" id="mc-cnt-${i}">${it.title.length}/${MS_LIMITS.menuTitle}</div></div>
      <select class="select" onchange="setItem(${i},'action',this.value,true)">${MS_MENU_ACTIONS.map(a => optionHtml(a.value, a.label, it.action)).join('')}</select>
      <div class="mc-target">${targetHtml(it, i)}</div>
      <div class="mc-ops">
        <button class="link-btn" type="button" onclick="moveItem(${i},-1)" ${i === 0 ? 'disabled' : ''}>上移</button>
        <button class="link-btn" type="button" onclick="moveItem(${i},1)" ${i === cfg.items.length - 1 ? 'disabled' : ''}>下移</button>
        <button class="link-btn link-btn-danger" type="button" onclick="delItem(${i})">删除</button>
      </div>
    </div>`).join('');
}

function updateCounters() {
  cfg.items.forEach((it, i) => { const e = document.getElementById(`mc-cnt-${i}`); if (e) e.textContent = `${it.title.length}/${MS_LIMITS.menuTitle}`; });
  const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  set('mc-end-cnt', ` ${cfg.endText.length}/${MS_LIMITS.menuTitle}`);
  set('mc-prompt-cnt', ` ${cfg.promptText.length}/200`);
  set('mc-qrt-cnt', ` ${cfg.qrTitle.length}/20`);
}

function renderErrors() {
  const errs = validate(cfg);
  const host = document.getElementById('mc-errs');
  if (host) host.innerHTML = errs.length ? `<div class="ms-issues"><div class="ms-issues-title">${errs.length} 项待修正</div>${errs.map(e => `<div class="ms-issue err">${esc(e)}</div>`).join('')}</div>` : '<div class="ms-issues ok">校验通过</div>';
  const pub = document.getElementById('ms-publish');
  if (pub && pub.textContent.indexOf('同步中') < 0) pub.disabled = errs.length > 0;
}

function renderPreview() {
  const host = document.getElementById('mc-preview');
  if (!host) return;
  const menuTitles = sim === 'support' ? [`<b class="ms-end">${esc(cfg.endText || '结束会话')}</b>`] : cfg.items.map(i => esc(i.title || '未命名'));
  const composerOn = !cfg.composerHidden || !!sim;
  const state = sim === 'phone' ? '键盘已显示（用户点了分享手机号，可直接回复手机号）'
    : sim === 'support' ? '键盘已显示（客服会话中，菜单只有结束会话）'
    : (cfg.composerHidden ? '键盘已隐藏（默认状态）' : '键盘已显示（键盘默认隐藏=关）');
  const bot = (DB.bots || []).find(b => b.id === filters.bot);
  host.innerHTML = `
    <div class="ms-sim"><label>模拟用户状态：<select onchange="setSim(this.value)"><option value="">默认</option><option value="phone"${sim === 'phone' ? ' selected' : ''}>点了分享手机号</option><option value="support"${sim === 'support' ? ' selected' : ''}>客服会话中</option></select></label></div>
    <div class="viber-chat ms-chat" style="min-height:300px">
      <div class="viber-chat-head ms-head"><span class="avatar">${esc((bot?.botName || 'B').slice(0, 1).toUpperCase())}</span><div class="meta"><div class="name">${esc(bot?.botName || 'Bot')}</div><div class="sub">Messenger</div></div></div>
      <div class="viber-chat-body"><div class="viber-empty">对话内容</div></div>
      <div class="ms-bottom ${composerOn ? 'on' : 'off'}">
        ${composerOn ? '<div class="ms-composer"><span class="ms-plus">＋</span><span class="ms-input">Aa</span><span class="ms-plus">☺</span></div>' : ''}
        <div class="ms-pmenu"${composerOn ? ' style="margin-top:6px"' : ''}>☰ ${menuTitles.join(' · ') || '（无底部菜单）'}</div>
        <div class="ms-state">${state}</div>
      </div>
    </div>
    <div class="ms-note">近似预览，菜单为收起状态，以 Messenger 实际显示为准</div>`;
}

function radio(name, val, label, onchange, checked) {
  return `<label><input type="radio" name="${name}" ${checked ? 'checked' : ''} onchange="${onchange}"> ${label}</label>`;
}

function render() {
  const bots = botsByScope(filters.pl, MS_PLATFORM);
  const pub = cfg ? getMsCfgPub(filters.pl, filters.bot) : null;
  const showBound = cfg && !cfg.composerHidden;
  const showPrompt = showBound && !cfg.boundToSupport;
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Messenger Bot 配置</h1>
        <p class="page-desc">按 Bot 配置底部菜单（Persistent Menu）、键盘默认状态和用户发文字的处理；对该 Bot 下所有对话流生效</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-outline" type="button" onclick="resetCfg()" ${cfg ? '' : 'disabled'}>重置</button>
        <button class="btn btn-outline" type="button" onclick="saveDraft()" ${cfg ? '' : 'disabled'}>保存草稿</button>
        <button class="btn btn-primary" type="button" id="ms-publish" onclick="publishCfg()" ${cfg ? '' : 'disabled'}>发布到 Messenger</button>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item"><span class="filter-label">产品线</span><select class="select" id="f-pl" onchange="onPl()">${productLineOptions(filters.pl)}</select></div>
        <div class="filter-item"><span class="filter-label">Bot</span><select class="select" id="f-bot" onchange="onBot()">${botOptions(filters.pl, filters.bot, MS_PLATFORM)}</select></div>
        <div class="filter-item"><span class="filter-label">状态</span>${pub ? `<span class="tag tag-success">已发布 ${esc(pub.publishedAt || '')}</span>${dirty ? '<span class="tag" style="margin-left:6px">有未保存修改</span>' : ''}` : '<span class="tag">未发布</span>'}</div>
      </div>
    </section>
    ${!cfg ? '<section class="card"><div class="table-empty">该产品线下没有开通 Messenger 的 Bot</div></section>' : `
    <div class="mc-grid">
      <div class="mc-main">
        <div id="mc-errs"></div>
        <section class="card">
          <h4 class="card-title">底部菜单（Persistent Menu）</h4>
          <div class="field-hint" style="margin-bottom:10px">Bot 级固定入口，对所有用户、所有对话流相同；仅文字，≤${MS_LIMITS.menuItems} 项，文案 ≤${MS_LIMITS.menuTitle}；菜单为收起状态，用户点开才可见，不要放需要用户注意的引导。点击只做固定路由，不重新匹配策略。</div>
          <div class="mc-list">${itemRows()}</div>
          <button class="btn btn-outline" type="button" onclick="addItem()" ${cfg.items.length >= MS_LIMITS.menuItems ? 'disabled' : ''}>添加菜单项</button>
          <div class="field" style="margin-top:16px">
            <label class="field-label">结束会话文案<span class="req">*</span><span class="counter" id="mc-end-cnt"> ${cfg.endText.length}/${MS_LIMITS.menuTitle}</span></label>
            <input class="input" style="max-width:320px" value="${esc(cfg.endText)}" oninput="setText('endText',this.value)" />
            <div class="field-hint">客服会话中，底部菜单只显示这一项；用户点击后结束会话，恢复菜单并重新下发进入客服前的页面</div>
          </div>
        </section>
        <section class="card" style="margin-top:16px">
          <h4 class="card-title">键盘与文字处理</h4>
          <div class="field">
            <label class="field-label">键盘默认隐藏</label>
            <div class="radio-group">${radio('mc-hide', 1, '开', 'setField(\'composerHidden\', true)', cfg.composerHidden)}${radio('mc-hide', 0, '关', 'setField(\'composerHidden\', false)', !cfg.composerHidden)}</div>
            <div class="field-hint">开：用户默认只能点菜单和按钮，分享手机号、调起客服时才显示键盘；关：键盘始终显示</div>
          </div>
          ${showBound ? `<div class="field">
            <label class="field-label">已绑定用户输入直接转客服</label>
            <div class="radio-group">${radio('mc-bound', 1, '开', 'setField(\'boundToSupport\', true)', cfg.boundToSupport)}${radio('mc-bound', 0, '关', 'setField(\'boundToSupport\', false)', !cfg.boundToSupport)}</div>
            <div class="field-hint">开：已绑定用户发文字即打开客服会话；关：先回复下方提示文案和快速回复，用户点击后转客服，并把之前输入的最近 10 条一并发给客服</div>
          </div>` : ''}
          ${showPrompt ? `<div class="field">
            <label class="field-label">提示文案<span class="req">*</span><span class="counter" id="mc-prompt-cnt"> ${cfg.promptText.length}/200</span></label>
            <textarea class="textarea" rows="2" oninput="setText('promptText',this.value)">${esc(cfg.promptText)}</textarea>
          </div>
          <div class="field">
            <label class="field-label">快速回复文案<span class="req">*</span><span class="counter" id="mc-qrt-cnt"> ${cfg.qrTitle.length}/20</span></label>
            <input class="input" style="max-width:320px" value="${esc(cfg.qrTitle)}" oninput="setText('qrTitle',this.value)" />
          </div>` : ''}
        </section>
      </div>
      <aside class="mc-side"><div class="viber-preview-caption">Messenger 预览</div><div id="mc-preview"></div></aside>
    </div>`}`;
  if (cfg) { renderErrors(); renderPreview(); }
  refreshIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('msconfig');
  loadCfg();
  render();
});

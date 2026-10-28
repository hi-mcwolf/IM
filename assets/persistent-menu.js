/* 全局菜单（Messenger Page 级）：Get Started + Persistent Menu + 输入框默认状态 */

const PM_TYPES = [
  { value: 'home', label: '回主页' },
  { value: 'support', label: '客服' },
  { value: 'url', label: 'URL' }
];

let pl = defaultProductLine();
let botId = '';
let cfg = null;
let dirty = false;
let sim = '';
let publishing = false;
let dragFrom = -1;

function msBots() {
  return botsByScope(pl, 'messenger');
}

function loadCfg() {
  if (!msBots().some(b => b.id === botId)) botId = msBots()[0]?.id || '';
  cfg = getPmenu(pl, botId);
  dirty = false;
}

function isHttps(u) {
  return /^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/.test(u || '');
}

function itemErrors(it) {
  const e = {};
  if (!(it.title || '').trim()) e.title = '请填写菜单文案';
  else if (it.title.length > MS_LIMITS.menuTitle) e.title = `菜单文案最多 ${MS_LIMITS.menuTitle} 字符`;
  if (it.type === 'url') {
    if (!(it.url || '').trim()) e.url = '请填写跳转链接';
    else if (!isHttps(it.url.trim())) e.url = '请输入合法的 https 链接';
  }
  return e;
}

function publishProblems() {
  const list = [];
  if (!cfg.getStartedEnabled) list.push('Get Started 未启用');
  if (cfg.getStartedEnabled && cfg.route === 'flow' && !cfg.routeFlowId) list.push('请选择 Get Started 指定的对话流');
  if (!cfg.items.length) list.push('Persistent Menu 至少需要 1 项');
  cfg.items.forEach((it, i) => {
    const e = itemErrors(it);
    if (e.title) list.push(`菜单项 ${i + 1}：${e.title}`);
    if (e.url) list.push(`菜单项 ${i + 1}：${e.url}`);
  });
  return list;
}

function switchHtml(id, checked, onchange) {
  return `<label class="pm-switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${onchange}"><span class="track"></span></label>`;
}

function previewHtml() {
  const bot = DB.bots.find(b => b.id === botId);
  const name = bot?.botName || 'Bot';
  const composerOn = !cfg.composerHidden || !!sim;
  const titles = cfg.items.map(i => esc(i.title || '未命名')).concat(sim === 'support' ? ['<b class="ms-end">结束客服</b>'] : []);
  return `
    <div class="ms-sim"><label>模拟触发：<select onchange="onSim(this.value)"><option value="">无</option><option value="phone"${sim === 'phone' ? ' selected' : ''}>分享手机号</option><option value="support"${sim === 'support' ? ' selected' : ''}>调起客服</option></select></label></div>
    <div class="viber-chat ms-chat">
      <div class="viber-chat-head ms-head">
        <span class="avatar">${esc(name.slice(0, 1).toUpperCase())}</span>
        <div class="meta"><div class="name">${esc(name)}</div><div class="sub">Messenger · Page 级菜单</div></div>
      </div>
      <div class="viber-chat-body" style="padding-right:12px">
        <div class="viber-bubble" style="padding:10px 12px;font-size:13px">${cfg.getStartedEnabled ? '欢迎！点击下方菜单开始使用。' : '（Get Started 未启用，菜单不会显示）'}</div>
      </div>
      <div class="ms-bottom ${composerOn ? 'on' : 'off'}">
        ${composerOn
          ? `<div class="ms-composer"><span class="ms-plus">＋</span><span class="ms-input">Aa</span><span class="ms-plus">☺</span></div><div class="ms-pmenu" style="margin-top:6px">☰ ${titles.join(' · ') || '（无菜单项）'}</div><div class="ms-state">输入框已显示${sim ? '（按用户覆盖）' : ''}${sim === 'support' ? '，菜单已追加「结束客服」' : ''}</div>`
          : `<div class="ms-pmenu">☰ ${titles.join(' · ') || '（无菜单项）'}</div><div class="ms-state">输入框已隐藏（仅可点击菜单与按钮）</div>`}
      </div>
    </div>
    <div class="ms-note">近似预览，以 Messenger 实际显示为准</div>`;
}

function onSim(v) {
  sim = v || '';
  refreshPreview();
}

function refreshPreview() {
  const host = document.getElementById('pm-preview');
  if (host) host.innerHTML = previewHtml();
}

function itemsHtml() {
  return cfg.items.map((it, i) => {
    const e = itemErrors(it);
    const showErr = it._touched;
    return `
    <div class="pm-item" draggable="true" data-i="${i}"
         ondragstart="dragFrom=${i}" ondragover="event.preventDefault()" ondrop="onDrop(${i})">
      <span class="drag-handle" title="拖动排序"><i data-lucide="grip-vertical"></i></span>
      <div>
        <input class="input" value="${esc(it.title)}" placeholder="菜单文案" oninput="onItem(${i}, 'title', this.value)" />
        <div class="counter" id="pm-cnt-${i}" style="margin:2px 0 0">${(it.title || '').length}/${MS_LIMITS.menuTitle}</div>
        <div class="field-error" id="pm-err-title-${i}">${showErr && e.title ? e.title : ''}</div>
      </div>
      <div>
        <select class="select" onchange="onItem(${i}, 'type', this.value)">
          ${PM_TYPES.map(t => optionHtml(t.value, t.label, it.type)).join('')}
        </select>
      </div>
      <div>
        ${it.type === 'url'
          ? `<input class="input" value="${esc(it.url || '')}" placeholder="请输入 https 链接" oninput="onItem(${i}, 'url', this.value)" />
             <div class="field-error" id="pm-err-url-${i}">${showErr && e.url ? e.url : ''}</div>`
          : `<span class="page-desc">${it.type === 'home' ? '回到该用户策略匹配的对话流首页，不重新匹配来源' : '创建 Sobot 会话（触发前显示输入框）'}</span>`}
      </div>
      <button class="link-btn link-btn-danger" type="button" onclick="removeItem(${i})">删除</button>
    </div>`;
  }).join('') || '<div class="table-empty">暂无菜单项，请添加</div>';
}

function render() {
  const problems = publishProblems();
  const pubTag = cfg.publishedAt
    ? `<span class="tag tag-success pm-tag-pub">已发布 · ${esc(cfg.publishedAt)}</span>`
    : '<span class="tag tag-gray pm-tag-pub">未发布</span>';
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">全局菜单</h1>
        <p class="page-desc">配置 Messenger Page 级固定入口与输入框默认状态</p>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <select class="select" id="f-pl" onchange="onScope()">${productLineOptions(pl)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">平台</span>
          <input class="input" value="messenger" disabled style="width:140px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot（Page）</span>
          <select class="select" id="f-bot" onchange="onScope()">${botOptions(pl, botId, 'messenger')}</select>
        </div>
      </div>
    </section>
    ${!botId ? '<section class="card"><div class="table-empty">该产品线下没有 Messenger Bot</div></section>' : `
    <div class="pm-grid" style="margin-top:16px">
      <div>
        <section class="card">
          <h4 class="card-title">Get Started ${pubTag}</h4>
          <div class="field">
            <label class="field-label">启用</label>
            ${switchHtml('gs-on', cfg.getStartedEnabled, 'onGs(this.checked)')}
          </div>
          ${cfg.getStartedEnabled ? `
          <div class="field">
            <label class="field-label">回调路由<span class="req">*</span></label>
            <div class="radio-group">
              <label><input type="radio" name="gs-route" value="strategy" ${cfg.route === 'strategy' ? 'checked' : ''} onchange="onRoute('strategy')"> 按来源 + 标签匹配</label>
              <label><input type="radio" name="gs-route" value="flow" ${cfg.route === 'flow' ? 'checked' : ''} onchange="onRoute('flow')"> 指定对话流</label>
            </div>
          </div>
          ${cfg.route === 'flow' ? `<div class="field">
            <label class="field-label">对话流<span class="req">*</span></label>
            <select class="select" id="gs-flow" onchange="onFlow(this.value)">
              <option value="">请选择对话流</option>
              ${publishedFlowOptions(pl, botId, cfg.routeFlowId, 'messenger')}
            </select>
          </div>` : ''}` : `<div class="pm-warn">Get Started 未启用：Persistent Menu 依赖 Get Started，需先启用才能发布。</div>`}
        </section>

        <section class="card">
          <h4 class="card-title">Persistent Menu</h4>
          <div class="field">
            <label class="field-label">默认隐藏输入框</label>
            ${switchHtml('cp-hide', cfg.composerHidden, 'onHide(this.checked)')}
            <div class="field-hint" id="hide-hint">${cfg.composerHidden
              ? '开启：用户默认只能通过菜单和按钮交互；需文字输入的事件触发前会按用户覆盖为显示。'
              : '关闭：用户始终可输入文字，下方「输入框显示控制」规则不再生效。'}</div>
          </div>
          <div class="field">
            <label class="field-label">菜单项（≤${MS_LIMITS.menuItems}，可拖动排序）</label>
            <div id="pm-items">${itemsHtml()}</div>
            <button class="btn btn-outline" type="button" onclick="addItem()" ${cfg.items.length >= MS_LIMITS.menuItems ? 'disabled' : ''}>添加菜单项</button>
            ${cfg.items.length >= MS_LIMITS.menuItems ? `<div class="field-hint">最多 ${MS_LIMITS.menuItems} 项，保持入口精简（平台上限 20）</div>` : ''}
          </div>
        </section>

        <section class="card">
          <h4 class="card-title">输入框显示控制（系统逻辑，只读）</h4>
          <div class="table-scroll">
            <table class="table table-nowrap">
              <thead><tr><th>触发</th><th>动作</th><th>恢复时机</th></tr></thead>
              <tbody>
                <tr><td>下发分享手机号消息前</td><td>将该用户输入框覆盖为显示</td><td>绑定完成；或手机号校验失败 3 次后</td></tr>
                <tr><td>触发调起客服（Support）</td><td>将该用户输入框覆盖为显示；用户级菜单追加文字项「结束客服」</td><td>用户点击「结束客服」或客服会话结束：移除该项，恢复默认隐藏</td></tr>
              </tbody>
            </table>
          </div>
          <div class="field-hint" style="margin-top:8px">覆盖或恢复调用失败会重试，仍失败则记录告警，不阻断主流程；隐藏状态下菜单里始终保留客服入口。Messenger 不支持「关闭键盘」动作与图片按钮，用文字项「结束客服」替代 Viber 的结束客服图片。</div>
        </section>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-outline" type="button" onclick="doSave()">保存草稿</button>
          <button class="btn btn-outline" type="button" onclick="doReset()">重置</button>
          <button class="btn btn-primary" type="button" id="pm-publish" onclick="doPublish()" ${problems.length ? 'disabled' : ''}>发布到 Messenger</button>
        </div>
        <div class="field-hint" id="pm-problems">${problems.length ? '不可发布：' + problems.map(esc).join('；') : ''}</div>
      </div>
      <aside class="pm-preview"><div class="viber-preview-caption">Messenger 预览</div><div id="pm-preview">${previewHtml()}</div></aside>
    </div>`}`;
  refreshIcons();
}

function syncUI() {
  const problems = publishProblems();
  const btn = document.getElementById('pm-publish');
  if (btn) btn.disabled = problems.length > 0 || publishing;
  const pe = document.getElementById('pm-problems');
  if (pe) pe.innerHTML = problems.length ? '不可发布：' + problems.map(esc).join('；') : '';
  cfg.items.forEach((it, i) => {
    const c = document.getElementById(`pm-cnt-${i}`);
    if (c) c.textContent = `${(it.title || '').length}/${MS_LIMITS.menuTitle}`;
    const e = itemErrors(it);
    const et = document.getElementById(`pm-err-title-${i}`);
    if (et) et.textContent = it._touched && e.title ? e.title : '';
    const eu = document.getElementById(`pm-err-url-${i}`);
    if (eu) eu.textContent = it._touched && e.url ? e.url : '';
  });
  refreshPreview();
}

async function onScope() {
  const npl = document.getElementById('f-pl').value;
  const nbot = document.getElementById('f-bot').value;
  if (dirty) {
    const ok = await confirmModal({ title: '确认切换？', message: '当前配置有未保存的改动', confirmText: '确认切换', danger: false });
    if (!ok) { render(); return; }
  }
  if (npl !== pl) { pl = npl; botId = ''; } else botId = nbot;
  loadCfg();
  render();
}

function onGs(v) { cfg.getStartedEnabled = v; dirty = true; render(); }
function onRoute(r) { cfg.route = r; dirty = true; render(); }
function onFlow(v) { cfg.routeFlowId = v; dirty = true; syncUI(); }
function onHide(v) {
  cfg.composerHidden = v;
  dirty = true;
  const h = document.getElementById('hide-hint');
  if (h) h.textContent = v
    ? '开启：用户默认只能通过菜单和按钮交互；需文字输入的事件触发前会按用户覆盖为显示。'
    : '关闭：用户始终可输入文字，下方「输入框显示控制」规则不再生效。';
  syncUI();
}

function onItem(i, key, val) {
  const it = cfg.items[i];
  it[key] = val;
  it._touched = true;
  dirty = true;
  if (key === 'type') { render(); return; }
  syncUI();
}

function addItem() {
  if (cfg.items.length >= MS_LIMITS.menuItems) {
    showToast(`最多 ${MS_LIMITS.menuItems} 项`, 'err');
    return;
  }
  cfg.items.push({ id: nextId('pm'), title: '', type: 'url', url: '', _touched: false });
  dirty = true;
  render();
}

async function removeItem(i) {
  const ok = await confirmModal({ title: '确认删除该菜单项？', confirmText: '确认删除' });
  if (!ok) return;
  cfg.items.splice(i, 1);
  dirty = true;
  render();
}

function onDrop(to) {
  if (dragFrom < 0 || dragFrom === to) return;
  const [m] = cfg.items.splice(dragFrom, 1);
  cfg.items.splice(to, 0, m);
  dragFrom = -1;
  dirty = true;
  render();
}

function cleanCfg() {
  const c = clone(cfg);
  c.items.forEach(i => { delete i._touched; });
  return c;
}

function doSave() {
  savePmenu(pl, botId, cleanCfg());
  dirty = false;
  showToast('草稿已保存');
  render();
}

async function doReset() {
  const ok = await confirmModal({ title: '确认重置？', message: '将恢复为最近一次保存的配置', confirmText: '确认重置', danger: false });
  if (!ok) return;
  loadCfg();
  render();
  showToast('已重置');
}

async function doPublish() {
  cfg.items.forEach(i => { i._touched = true; });
  const problems = publishProblems();
  if (problems.length) {
    render();
    showToast(problems[0], 'err');
    return;
  }
  const ok = await confirmModal({
    title: '确认发布到 Messenger？',
    message: '将同步 Page 级配置，对该 Page 的全部用户生效（平台侧最多 24 小时）',
    confirmText: '确认发布',
    danger: false
  });
  if (!ok) return;
  publishing = true;
  const btn = document.getElementById('pm-publish');
  if (btn) { btn.disabled = true; btn.textContent = '同步中…'; }
  setTimeout(() => {
    publishing = false;
    cfg.publishedAt = nowTs();
    savePmenu(pl, botId, cleanCfg());
    dirty = false;
    render();
    showToast('已同步到 Messenger');
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('pmenu');
  botId = msBots()[0]?.id || '';
  loadCfg();
  render();
});

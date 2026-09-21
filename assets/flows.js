/* 对话流列表 */

const PAGE_SIZE = 20;
let page = 1;
let filters = readQueryFilters(['pl', 'platform', 'bot', 'flowId', 'flowName', 'status']);

if (!filters.pl) filters.pl = defaultProductLine();
if (!filters.platform) filters.platform = defaultPlatform();
if (!filters.bot) filters.bot = defaultBot(filters.pl, filters.platform);

function applyQuery() {
  filters.pl = document.getElementById('f-pl')?.value || '';
  filters.platform = document.getElementById('f-platform')?.value || '';
  filters.bot = document.getElementById('f-bot')?.value || '';
  filters.flowId = document.getElementById('f-flow-id')?.value || '';
  filters.flowName = document.getElementById('f-flow-name')?.value || '';
  filters.status = document.getElementById('f-status')?.value || '';
  page = 1;
  writeQueryFilters(filters);
  render();
}

function onPlChange() {
  filters.pl = document.getElementById('f-pl').value;
  filters.bot = defaultBot(filters.pl, filters.platform);
  filters.flowId = '';
  filters.flowName = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot, filters.platform);
  applyQuery();
}

function onPlatformChange() {
  filters.platform = document.getElementById('f-platform').value;
  filters.bot = defaultBot(filters.pl, filters.platform);
  filters.flowId = '';
  filters.flowName = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot, filters.platform);
  applyQuery();
}

function gotoPage(p) {
  page = p;
  render();
}

function scopedFlows() {
  return normalFlows().filter(f =>
    (!filters.pl || f.productLineId === filters.pl) &&
    (!filters.bot || f.botId === filters.bot) &&
    (!filters.platform || f.platform === filters.platform || !f.platform)
  );
}

function filteredFlows() {
  return scopedFlows()
    .filter(f => {
      if (filters.flowId && f.id !== filters.flowId) return false;
      if (filters.flowName && f.id !== filters.flowName) return false;
      if (filters.status && f.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => {
      const rank = f => (f.type === 'fallback' ? 0 : 1);
      return rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt);
    });
}

function canPublish(flow) {
  const hasPage = (flow.pages || []).length >= 1;
  const menu = menuById(flow.mainMenuId);
  const hasMenuBtn = (menu?.buttons || []).length >= 1;
  const hasFirst = !!flow.firstPageId && (flow.pages || []).some(p => p.id === flow.firstPageId);
  return hasPage && hasMenuBtn && hasFirst;
}

function render() {
  const all = filteredFlows();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  const scope = scopedFlows();
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">对话流</h1>
        <p class="page-desc">配置主菜单 + 多页面承接结构；策略未命中走兜底对话流</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-outline" type="button" ${findFixedFlow(filters.pl, filters.bot, 'fallback', filters.platform) ? 'disabled title="当前 Bot 已有兜底对话流"' : ''} onclick="goNew('fallback')">
          <i data-lucide="plus"></i>新建兜底对话流
        </button>
        <button class="btn btn-primary" type="button" onclick="goNew()">
          <i data-lucide="plus"></i>新建对话流
        </button>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <select class="select" id="f-pl" onchange="onPlChange()">${productLineOptions(filters.pl)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">平台</span>
          <select class="select" id="f-platform" onchange="onPlatformChange()">${platformOptions(filters.platform)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot</span>
          <select class="select" id="f-bot" onchange="applyQuery()">${botOptions(filters.pl, filters.bot, filters.platform)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">对话流 ID</span>
          <select class="select" id="f-flow-id" onchange="applyQuery()">
            <option value="">全部</option>
            ${scope.map(f => optionHtml(f.id, f.id, filters.flowId)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">对话流名称</span>
          <select class="select" id="f-flow-name" onchange="applyQuery()">
            <option value="">全部</option>
            ${scope.map(f => optionHtml(f.id, f.name, filters.flowName)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <select class="select" id="f-status" onchange="applyQuery()">
            <option value="">全部</option>
            <option value="draft"${filters.status === 'draft' ? ' selected' : ''}>草稿</option>
            <option value="published"${filters.status === 'published' ? ' selected' : ''}>启用</option>
            <option value="offline"${filters.status === 'offline' ? ' selected' : ''}>禁用</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="button" onclick="applyQuery()">查询</button>
        </div>
      </div>
    </section>
    <section class="card table-card">
      <h4 class="card-title">对话流列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>对话流 ID</th>
              <th>名称</th>
              <th>默认主菜单</th>
              <th>页面数</th>
              <th>类型</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(f => {
              const menu = menuById(f.mainMenuId);
              const published = f.status === 'published';
              const canEnable = (f.status === 'draft' || f.status === 'offline') && canPublish(f);
              return `<tr>
                <td>${esc(f.id)}</td>
                <td>${isFixedFlow(f) ? fixedPinHtml() : ''}${esc(f.name)}</td>
                <td>${esc(menu ? menu.name : '-')}</td>
                <td>${(f.pages || []).length}</td>
                <td>${statusTag(f.type)}</td>
                <td>${statusTag(f.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="location.href='flow-editor.html?id=${encodeURIComponent(f.id)}'">编辑</button>
                  <button class="link-btn" type="button" onclick="copyFlow('${esc(f.id)}')">复制</button>
                  ${!published ? `<button class="link-btn" type="button" ${canEnable ? '' : 'disabled'} onclick="enableFlow('${esc(f.id)}')">启用</button>` : ''}
                  ${published && !isFixedFlow(f) ? `<button class="link-btn" type="button" onclick="disableFlow('${esc(f.id)}')">禁用</button>` : ''}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="7"><div class="table-empty">暂无数据</div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination(all.length, page, PAGE_SIZE, 'gotoPage')}
    </section>`;
  refreshIcons();
}

function goNew(type) {
  if (!filters.pl || !filters.bot) {
    showToast('请先选择产品线与 Bot', 'err');
    return;
  }
  const t = type || 'normal';
  if (t === 'fallback' && findFixedFlow(filters.pl, filters.bot, t, filters.platform)) {
    showToast(`当前 Bot 已有${fixedFlowLabel(t)}`, 'err');
    return;
  }
  const q = `pl=${encodeURIComponent(filters.pl)}&platform=${encodeURIComponent(filters.platform)}&bot=${encodeURIComponent(filters.bot)}${t !== 'normal' ? `&type=${encodeURIComponent(t)}` : ''}`;
  location.href = `flow-editor.html?${q}`;
}

async function copyFlow(id) {
  const f = flowById(id);
  if (!f) return;
  const ok = await confirmModal({ title: `确认复制对话流 ${f.name}？`, confirmText: '确认复制', danger: false });
  if (!ok) return;
  let newId = `${f.id}_copy`;
  let n = 2;
  while (flowById(newId)) {
    newId = `${f.id}_copy${n}`;
    n += 1;
  }
  const copy = clone(f);
  copy.id = newId;
  copy.name = `${f.name} 副本`;
  copy.status = 'draft';
  copy.type = 'normal';
  copy.purpose = '';
  copy.remark = '';
  copy.updatedAt = nowTs();
  DB.flows.push(copy);
  saveStore();
  location.href = `flow-editor.html?id=${encodeURIComponent(newId)}`;
}

function enableFlow(id) {
  const f = flowById(id);
  if (!f) return;
  if (!canPublish(f)) {
    showToast('启用前需至少 1 个页面、1 个主菜单按钮，并指定首屏', 'err');
    return;
  }
  f.status = 'published';
  f.updatedAt = nowTs();
  saveStore();
  showToast('已启用');
  render();
}

async function disableFlow(id) {
  const f = flowById(id);
  if (!f) return;
  const ok = await confirmModal({ title: `确认禁用对话流 ${f.name}？`, confirmText: '确认禁用', danger: false });
  if (!ok) return;
  f.status = 'offline';
  f.updatedAt = nowTs();
  saveStore();
  showToast('已禁用');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('flows');
  writeQueryFilters(filters);
  render();
});

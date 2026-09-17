/* 来源列表 / 编辑 */

const PAGE_SIZE = 20;
let page = 1;
let filters = readQueryFilters(['pl', 'bot', 'kw']);
let editingId = null;
let dirty = false;

if (!filters.pl) filters.pl = defaultProductLine();
if (!filters.bot) filters.bot = defaultBot(filters.pl);

function applyQuery() {
  filters.pl = document.getElementById('f-pl')?.value || '';
  filters.bot = document.getElementById('f-bot')?.value || '';
  filters.kw = (document.getElementById('f-kw')?.value || '').trim();
  page = 1;
  writeQueryFilters(filters);
  render();
}

function onPlChange() {
  filters.pl = document.getElementById('f-pl').value;
  filters.bot = defaultBot(filters.pl);
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot);
  applyQuery();
}

function gotoPage(p) {
  page = p;
  render();
}

function filteredScenes() {
  const kw = (filters.kw || '').toLowerCase();
  return scenesByScope(filters.pl, filters.bot)
    .filter(s => !kw || s.id.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function render() {
  const all = filteredScenes();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">来源管理</h1>
        <p class="page-desc">识别 deeplink source 入口；专属来源可关闭走策略，直接进入入口会话流</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" type="button" onclick="openSceneEdit(null)">
          <i data-lucide="plus"></i>新建来源
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
          <span class="filter-label">Bot</span>
          <select class="select" id="f-bot" onchange="applyQuery()">${botOptions(filters.pl, filters.bot)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">关键字</span>
          <input class="input" id="f-kw" maxlength="50" placeholder="输入来源 ID 或名称模糊搜索" value="${esc(filters.kw)}" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="button" onclick="applyQuery()">查询</button>
        </div>
      </div>
    </section>
    <section class="card table-card">
      <h4 class="card-title">来源列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>来源 ID</th>
              <th>来源名称</th>
              <th>入口会话流</th>
              <th>走策略</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(s => {
              const refs = sceneRefCount(s.id);
              const flow = flowById(s.entryFlowId);
              return `<tr>
                <td>${esc(s.id)}</td>
                <td>${esc(s.name)}</td>
                <td>${esc(flow ? `${flow.name} (${flow.id})` : '-')}</td>
                <td>${boolLabel(s.useStrategy)}</td>
                <td>${statusTag(s.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openSceneEdit('${esc(s.id)}')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" ${refs ? 'disabled title="该来源被策略引用"' : ''} onclick="deleteScene('${esc(s.id)}')">删除</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="6"><div class="table-empty">暂无数据</div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination(all.length, page, PAGE_SIZE, 'gotoPage')}
    </section>`;
  refreshIcons();
}

function openSceneEdit(id) {
  if (!filters.pl || !filters.bot) {
    showToast('请先选择产品线与 Bot', 'err');
    return;
  }
  editingId = id;
  dirty = false;
  const s = id ? clone(sceneById(id)) : {
    id: '', name: '', productLineId: filters.pl, botId: filters.bot,
    entryFlowId: '', useStrategy: true, effectiveStart: '', effectiveEnd: '',
    status: 'active', remark: ''
  };
  document.getElementById('sceneDrawerTitle').textContent = id ? '编辑来源' : '新建来源';
  document.getElementById('sceneDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">产品线<span class="req">*</span></label>
      <select class="select" id="sc-pl" onchange="onFormPlChange()">${productLineOptions(s.productLineId)}</select>
    </div>
    <div class="field">
      <label class="field-label">Bot<span class="req">*</span></label>
      <select class="select" id="sc-bot" onchange="onFormBotChange()">${botOptions(s.productLineId, s.botId)}</select>
    </div>
    <div class="field">
      <label class="field-label">来源 ID<span class="req">*</span></label>
      <input class="input" id="sc-id" maxlength="50" ${id ? 'disabled' : ''} placeholder="请输入来源 ID" value="${esc(s.id)}" />
      <div class="field-error" id="err-id"></div>
    </div>
    <div class="field">
      <label class="field-label">来源名称<span class="req">*</span></label>
      <input class="input" id="sc-name" maxlength="30" placeholder="请输入来源名称" value="${esc(s.name)}" />
    </div>
    <div class="field">
      <label class="field-label">走策略<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="sc-use" value="1"${s.useStrategy ? ' checked' : ''} onchange="syncEntryRequired()"> 是</label>
        <label><input type="radio" name="sc-use" value="0"${s.useStrategy ? '' : ' checked'} onchange="syncEntryRequired()"> 否</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">入口会话流<span id="entry-req" class="req" ${s.useStrategy ? 'hidden' : ''}>*</span></label>
      <select class="select" id="sc-flow">
        <option value="">请选择入口会话流（不走策略时直接进入）</option>
        ${publishedMatchFlowOptions(s.productLineId, s.botId, s.entryFlowId)}
      </select>
      <div class="field-error" id="err-flow"></div>
    </div>
    <div class="field">
      <label class="field-label">生效开始时间</label>
      <input class="input" id="sc-start" type="datetime-local" value="${esc((s.effectiveStart || '').replace(' ', 'T').slice(0, 16))}" />
    </div>
    <div class="field">
      <label class="field-label">生效结束时间</label>
      <input class="input" id="sc-end" type="datetime-local" value="${esc((s.effectiveEnd || '').replace(' ', 'T').slice(0, 16))}" />
      <div class="field-error" id="err-date"></div>
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="sc-status" value="active"${s.status === 'active' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="sc-status" value="disabled"${s.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">备注</label>
      <textarea class="textarea" id="sc-remark" maxlength="500" placeholder="请输入备注">${esc(s.remark)}</textarea>
    </div>`;
  document.getElementById('sceneDrawerBody').addEventListener('input', () => { dirty = true; syncSaveBtn(); });
  document.getElementById('sceneDrawerBody').addEventListener('change', () => { dirty = true; syncSaveBtn(); });
  syncEntryRequired();
  syncSaveBtn();
  openDrawer('sceneDrawer');
}

function onFormPlChange() {
  const pl = document.getElementById('sc-pl').value;
  const bot = defaultBot(pl);
  document.getElementById('sc-bot').innerHTML = botOptions(pl, bot);
  onFormBotChange();
}

function onFormBotChange() {
  const pl = document.getElementById('sc-pl').value;
  const bot = document.getElementById('sc-bot').value;
  document.getElementById('sc-flow').innerHTML = `<option value="">请选择入口会话流（不走策略时直接进入）</option>${publishedMatchFlowOptions(pl, bot, '')}`;
}

function useStrategyYes() {
  return document.querySelector('input[name="sc-use"]:checked')?.value === '1';
}

function syncEntryRequired() {
  const req = document.getElementById('entry-req');
  if (req) req.hidden = useStrategyYes();
  syncSaveBtn();
}

function toTs(v) {
  return v ? v.replace('T', ' ') + ':00' : '';
}

function readForm() {
  return {
    id: (document.getElementById('sc-id')?.value || '').trim(),
    name: (document.getElementById('sc-name')?.value || '').trim(),
    productLineId: document.getElementById('sc-pl')?.value || '',
    botId: document.getElementById('sc-bot')?.value || '',
    entryFlowId: document.getElementById('sc-flow')?.value || '',
    useStrategy: useStrategyYes(),
    effectiveStart: toTs(document.getElementById('sc-start')?.value || ''),
    effectiveEnd: toTs(document.getElementById('sc-end')?.value || ''),
    status: document.querySelector('input[name="sc-status"]:checked')?.value || 'active',
    remark: (document.getElementById('sc-remark')?.value || '').trim()
  };
}

function syncSaveBtn() {
  const d = readForm();
  const entryOk = d.useStrategy || !!d.entryFlowId;
  document.getElementById('sceneSaveBtn').disabled = !d.id || !d.name || !d.productLineId || !d.botId || !entryOk;
}

function saveScene() {
  const d = readForm();
  ['err-id', 'err-flow', 'err-date'].forEach(id => fieldError(id, ''));
  if (!editingId) {
    if (!isIdToken(d.id)) {
      fieldError('err-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-50');
      return;
    }
    if (sceneById(d.id)) {
      fieldError('err-id', '该来源 ID 已存在');
      return;
    }
  }
  if (!d.useStrategy && !d.entryFlowId) {
    fieldError('err-flow', '不走策略时入口会话流必填');
    return;
  }
  if (d.effectiveStart && d.effectiveEnd && d.effectiveEnd < d.effectiveStart) {
    fieldError('err-date', '结束时间须晚于开始时间');
    return;
  }
  if (editingId) {
    Object.assign(sceneById(editingId), d, { id: editingId, updatedAt: nowTs() });
  } else {
    DB.scenes.push({ ...d, createdAt: nowTs(), updatedAt: nowTs() });
  }
  saveStore();
  dirty = false;
  closeDrawer('sceneDrawer');
  showToast('保存成功');
  render();
}

async function maybeClose() {
  if (!dirty) return true;
  return confirmModal({ title: '确认取消？', message: '表单有未保存的改动', confirmText: '确认离开', danger: false });
}

async function deleteScene(id) {
  const s = sceneById(id);
  if (!s) return;
  if (sceneRefCount(id)) {
    showToast('来源无策略引用时可删', 'err');
    return;
  }
  const ok = await confirmModal({ title: `确认删除来源 ${s.name}？`, confirmText: '确认删除' });
  if (!ok) return;
  DB.scenes = DB.scenes.filter(x => x.id !== id);
  saveStore();
  showToast('删除成功');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('scenes');
  writeQueryFilters(filters);
  bindDrawerClose({ beforeClose: maybeClose });
  document.getElementById('sceneSaveBtn').addEventListener('click', saveScene);
  document.getElementById('sceneCancelBtn').addEventListener('click', async () => {
    if (await maybeClose()) closeDrawer('sceneDrawer');
  });
  render();
});

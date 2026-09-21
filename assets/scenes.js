/* 来源列表 / 编辑 */

const PAGE_SIZE = 20;
let page = 1;
let filters = readQueryFilters(['pl', 'platform', 'bot', 'code', 'name']);
let editingId = null;
let dirty = false;

if (!filters.pl) filters.pl = defaultProductLine();
if (!filters.platform) filters.platform = defaultPlatform();
if (!filters.bot) filters.bot = defaultBot(filters.pl, filters.platform);

function applyQuery() {
  filters.pl = document.getElementById('f-pl')?.value || '';
  filters.platform = document.getElementById('f-platform')?.value || '';
  filters.bot = document.getElementById('f-bot')?.value || '';
  filters.code = document.getElementById('f-code')?.value || '';
  filters.name = document.getElementById('f-name')?.value || '';
  page = 1;
  writeQueryFilters(filters);
  render();
}

function onPlChange() {
  filters.pl = document.getElementById('f-pl').value;
  filters.bot = defaultBot(filters.pl, filters.platform);
  filters.code = '';
  filters.name = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot, filters.platform);
  applyQuery();
}

function onPlatformChange() {
  filters.platform = document.getElementById('f-platform').value;
  filters.bot = defaultBot(filters.pl, filters.platform);
  filters.code = '';
  filters.name = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot, filters.platform);
  applyQuery();
}

function gotoPage(p) {
  page = p;
  render();
}

function filteredScenes() {
  return scenesByScope(filters.pl, filters.bot, filters.platform)
    .filter(s => {
      if (filters.code && s.id !== filters.code) return false;
      if (filters.name && s.id !== filters.name) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function render() {
  const all = filteredScenes();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  const scopeScenes = scenesByScope(filters.pl, filters.bot, filters.platform);
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">来源管理</h1>
        <p class="page-desc">识别 deeplink source 入口，作为策略匹配的来源维度</p>
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
          <span class="filter-label">平台</span>
          <select class="select" id="f-platform" onchange="onPlatformChange()">${platformOptions(filters.platform)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot</span>
          <select class="select" id="f-bot" onchange="applyQuery()">${botOptions(filters.pl, filters.bot, filters.platform)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">来源 code</span>
          <select class="select" id="f-code" onchange="applyQuery()">
            <option value="">全部</option>
            ${scopeScenes.map(s => optionHtml(s.id, s.id, filters.code)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">来源名称</span>
          <select class="select" id="f-name" onchange="applyQuery()">
            <option value="">全部</option>
            ${scopeScenes.map(s => optionHtml(s.id, s.name, filters.name)).join('')}
          </select>
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
              <th>来源 code</th>
              <th>来源名称</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(s => {
              const refs = sceneRefCount(s.id);
              return `<tr>
                <td>${esc(s.id)}</td>
                <td>${esc(s.name)}</td>
                <td>${statusTag(s.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openSceneEdit('${esc(s.id)}')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" ${refs ? 'disabled title="该来源被策略引用"' : ''} onclick="deleteScene('${esc(s.id)}')">删除</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="4"><div class="table-empty">暂无数据</div></td></tr>`}
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
    id: '', name: '', productLineId: filters.pl, platform: filters.platform, botId: filters.bot,
    status: 'active', remark: ''
  };
  if (!s.platform) s.platform = filters.platform || defaultPlatform();
  document.getElementById('sceneDrawerTitle').textContent = id ? '编辑来源' : '新建来源';
  document.getElementById('sceneDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">产品线<span class="req">*</span></label>
      <select class="select" id="sc-pl" onchange="onFormPlChange()">${productLineOptions(s.productLineId)}</select>
    </div>
    <div class="field">
      <label class="field-label">平台<span class="req">*</span></label>
      <select class="select" id="sc-platform" onchange="onFormPlatformChange()">${platformOptions(s.platform)}</select>
    </div>
    <div class="field">
      <label class="field-label">Bot<span class="req">*</span></label>
      <select class="select" id="sc-bot">${botOptions(s.productLineId, s.botId, s.platform)}</select>
    </div>
    <div class="field">
      <label class="field-label">来源 code<span class="req">*</span></label>
      <input class="input" id="sc-id" maxlength="50" ${id ? 'disabled' : ''} placeholder="请输入来源 code" value="${esc(s.id)}" />
      <div class="field-error" id="err-id"></div>
    </div>
    <div class="field">
      <label class="field-label">来源名称<span class="req">*</span></label>
      <input class="input" id="sc-name" maxlength="30" placeholder="请输入来源名称" value="${esc(s.name)}" />
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
      <textarea class="textarea" id="sc-remark" maxlength="500" placeholder="请输入备注">${esc(s.remark || '')}</textarea>
    </div>`;
  document.getElementById('sceneDrawerBody').addEventListener('input', () => { dirty = true; syncSaveBtn(); });
  document.getElementById('sceneDrawerBody').addEventListener('change', () => { dirty = true; syncSaveBtn(); });
  syncSaveBtn();
  openDrawer('sceneDrawer');
}

function onFormPlChange() {
  const pl = document.getElementById('sc-pl').value;
  const platform = document.getElementById('sc-platform').value;
  const bot = defaultBot(pl, platform);
  document.getElementById('sc-bot').innerHTML = botOptions(pl, bot, platform);
}

function onFormPlatformChange() {
  onFormPlChange();
}

function readForm() {
  return {
    id: (document.getElementById('sc-id')?.value || '').trim(),
    name: (document.getElementById('sc-name')?.value || '').trim(),
    productLineId: document.getElementById('sc-pl')?.value || '',
    platform: document.getElementById('sc-platform')?.value || '',
    botId: document.getElementById('sc-bot')?.value || '',
    status: document.querySelector('input[name="sc-status"]:checked')?.value || 'active',
    remark: (document.getElementById('sc-remark')?.value || '').trim()
  };
}

function syncSaveBtn() {
  const d = readForm();
  document.getElementById('sceneSaveBtn').disabled = !d.id || !d.name || !d.productLineId || !d.platform || !d.botId;
}

function saveScene() {
  const d = readForm();
  fieldError('err-id', '');
  if (!editingId) {
    if (!isIdToken(d.id)) {
      fieldError('err-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-50');
      return;
    }
    if (sceneById(d.id)) {
      fieldError('err-id', '该来源 code 已存在');
      return;
    }
  }
  if (editingId) {
    const cur = sceneById(editingId);
    Object.assign(cur, d, { id: editingId, updatedAt: nowTs() });
    delete cur.entryFlowId;
    delete cur.useStrategy;
    delete cur.effectiveStart;
    delete cur.effectiveEnd;
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

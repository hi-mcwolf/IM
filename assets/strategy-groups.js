/* 策略组列表 / 编辑 */

const PAGE_SIZE = 20;
let page = 1;
let filters = { keyword: '', status: '' };
let editingId = null;
let dirty = false;

function groupStatusLabel(s) {
  return s === 'active' ? '启用' : '停用';
}

function filteredGroups() {
  const kw = filters.keyword.toLowerCase();
  return DB.groups
    .filter(g => {
      if (kw && !g.id.toLowerCase().includes(kw) && !g.name.toLowerCase().includes(kw)) return false;
      if (filters.status && g.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function applyQuery() {
  filters.keyword = (document.getElementById('f-kw')?.value || '').trim();
  filters.status = document.getElementById('f-status')?.value || '';
  page = 1;
  render();
}

function resetQuery() {
  filters = { keyword: '', status: '' };
  page = 1;
  render();
}

function gotoPage(p) {
  page = p;
  render();
}

function render() {
  const all = filteredGroups();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">策略组管理</h1>
        <p class="page-desc">配置策略组的默认承接（对话流 + 变体），作为策略匹配落空时的组内兜底</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" type="button" onclick="openGroupEdit(null)">
          <i data-lucide="plus"></i>新建策略组
        </button>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">搜索</span>
          <input class="input" id="f-kw" type="text" placeholder="请输入策略组名称或 Id" maxlength="30" value="${esc(filters.keyword)}" />
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <select class="select" id="f-status">
            <option value="">全部</option>
            <option value="active"${filters.status === 'active' ? ' selected' : ''}>启用</option>
            <option value="disabled"${filters.status === 'disabled' ? ' selected' : ''}>停用</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="button" onclick="applyQuery()">查询</button>
          <button class="btn btn-outline" type="button" onclick="resetQuery()">重置</button>
        </div>
      </div>
    </section>
    <section class="card table-card">
      <h4 class="card-title">策略组列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>ID</th>
              <th>策略组名称</th>
              <th>默认承接</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(g => {
              const refs = groupRefCount(g.id);
              const delDisabled = g.status === 'active' && refs > 0;
              const flow = flowById(g.defaultFlowId);
              return `<tr>
                <td>${esc(g.id)}</td>
                <td>${esc(g.name)}</td>
                <td>${esc(flowPreview(flow, g.defaultVariantKey))}</td>
                <td>${statusTag(g.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openGroupEdit('${esc(g.id)}')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" ${delDisabled ? 'disabled title="该策略组被 ' + refs + ' 条策略引用,请先解除引用"' : ''} onclick="deleteGroup('${esc(g.id)}')">删除</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="5"><div class="table-empty">暂无数据</div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination(all.length, page, PAGE_SIZE, 'gotoPage')}
    </section>`;
  refreshIcons();
}

function publishedFlowOptions(selected) {
  return publishedFlows().map(f => optionHtml(f.id, `${f.name} (${f.id})`, selected)).join('');
}

function variantOptions(flowId, selected) {
  const flow = flowById(flowId);
  return (flow?.variants || []).filter(v => v.status === 'active').map(v => optionHtml(v.key, `${v.name} (${v.key})`, selected)).join('');
}

function openGroupEdit(id) {
  editingId = id;
  dirty = false;
  const g = id ? groupById(id) : {
    id: '', name: '', defaultFlowId: '', defaultVariantKey: 'default', status: 'active'
  };
  const isEdit = !!id;
  document.getElementById('groupDrawerTitle').textContent = isEdit ? '策略组编辑' : '新建策略组';
  document.getElementById('groupDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">策略组 Id<span class="req">*</span></label>
      <input class="input" id="g-id" maxlength="30" ${isEdit ? 'disabled' : ''} placeholder="请输入策略组 Id,小写字母+下划线,创建后不可改" value="${esc(g.id)}" />
      <div class="field-error" id="err-id"></div>
    </div>
    <div class="field">
      <label class="field-label">策略组名称<span class="req">*</span></label>
      <input class="input" id="g-name" maxlength="30" placeholder="请输入策略组名称" value="${esc(g.name)}" />
      <div class="field-error" id="err-name"></div>
    </div>
    <div class="field">
      <label class="field-label">默认承接对话流<span class="req">*</span></label>
      <select class="select" id="g-flow">
        <option value="">请选择默认承接对话流</option>
        ${publishedFlowOptions(g.defaultFlowId)}
      </select>
      <div class="field-error" id="err-flow"></div>
    </div>
    <div class="field">
      <label class="field-label">默认承接变体<span class="req">*</span></label>
      <select class="select" id="g-variant">
        <option value="">请选择默认承接变体</option>
        ${variantOptions(g.defaultFlowId, g.defaultVariantKey)}
      </select>
      <div class="field-error" id="err-variant"></div>
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="g-status" value="active"${g.status === 'active' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="g-status" value="disabled"${g.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>`;
  const markDirty = () => { dirty = true; syncSaveBtn(); };
  document.getElementById('g-flow').addEventListener('change', () => {
    const flowId = document.getElementById('g-flow').value;
    document.getElementById('g-variant').innerHTML = `<option value="">请选择默认承接变体</option>${variantOptions(flowId, '')}`;
    markDirty();
  });
  document.getElementById('groupDrawerBody').addEventListener('input', markDirty);
  document.getElementById('groupDrawerBody').addEventListener('change', markDirty);
  syncSaveBtn();
  openDrawer('groupDrawer');
  refreshIcons();
}

function readGroupForm() {
  return {
    id: (document.getElementById('g-id')?.value || '').trim(),
    name: (document.getElementById('g-name')?.value || '').trim(),
    defaultFlowId: document.getElementById('g-flow')?.value || '',
    defaultVariantKey: document.getElementById('g-variant')?.value || '',
    status: document.querySelector('input[name="g-status"]:checked')?.value || 'active'
  };
}

function syncSaveBtn() {
  const d = readGroupForm();
  const btn = document.getElementById('groupSaveBtn');
  btn.disabled = !d.id || !d.name || !d.defaultFlowId || !d.defaultVariantKey;
}

function validateGroup(d) {
  ['err-id', 'err-name', 'err-flow', 'err-variant'].forEach(id => fieldError(id, ''));
  let ok = true;
  if (!editingId) {
    if (!isIdToken(d.id)) {
      fieldError('err-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-30');
      ok = false;
    } else if (groupById(d.id)) {
      fieldError('err-id', '该策略组 Id 已存在');
      ok = false;
    }
  }
  if (!d.name) {
    fieldError('err-name', '请输入策略组名称');
    ok = false;
  }
  if (!d.defaultFlowId) {
    fieldError('err-flow', '请选择默认承接对话流');
    ok = false;
  }
  if (!d.defaultVariantKey) {
    fieldError('err-variant', '请选择默认承接变体');
    ok = false;
  }
  return ok;
}

function saveGroup() {
  const d = readGroupForm();
  if (!validateGroup(d)) return;
  if (editingId) {
    const g = groupById(editingId);
    Object.assign(g, { name: d.name, defaultFlowId: d.defaultFlowId, defaultVariantKey: d.defaultVariantKey, status: d.status, updatedAt: nowTs() });
  } else {
    DB.groups.push({ ...d, updatedAt: nowTs() });
  }
  saveStore();
  dirty = false;
  closeDrawer('groupDrawer');
  showToast('保存成功');
  render();
}

async function maybeCloseGroup() {
  if (!dirty) return true;
  return confirmModal({ title: '确认取消？', message: '表单有未保存的改动', confirmText: '确认离开', danger: false });
}

async function deleteGroup(id) {
  const g = groupById(id);
  if (!g) return;
  const refs = groupRefCount(id);
  if (g.status === 'active' && refs > 0) {
    showToast(`该策略组被 ${refs} 条策略引用,请先解除引用`, 'err');
    return;
  }
  const ok = await confirmModal({ title: `确认删除策略组 ${g.name}？`, confirmText: '确认删除' });
  if (!ok) return;
  DB.groups = DB.groups.filter(x => x.id !== id);
  saveStore();
  showToast('删除成功');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('strategy-groups');
  bindDrawerClose({ beforeClose: maybeCloseGroup });
  document.getElementById('groupSaveBtn').addEventListener('click', saveGroup);
  document.getElementById('groupCancelBtn').addEventListener('click', async () => {
    if (await maybeCloseGroup()) closeDrawer('groupDrawer');
  });
  render();
});

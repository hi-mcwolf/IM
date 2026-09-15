/* 策略列表 / 编辑（含标签条件配置器） */

const PAGE_SIZE = 20;
let page = 1;
let filters = { groupId: '', status: '' };
let editingId = null;
let dirty = false;
let condDraft = [];

function filteredStrategies() {
  return DB.strategies
    .filter(s => {
      if (filters.groupId && s.groupId !== filters.groupId) return false;
      if (filters.status && s.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function applyQuery() {
  filters.groupId = document.getElementById('f-group')?.value || '';
  filters.status = document.getElementById('f-status')?.value || '';
  page = 1;
  render();
}

function resetQuery() {
  filters = { groupId: '', status: '' };
  page = 1;
  render();
}

function gotoPage(p) {
  page = p;
  render();
}

function strategyStatusTag(s) {
  if (s === 'active') return statusTag('active');
  if (s === 'draft') return statusTag('draft');
  return statusTag('disabled');
}

function render() {
  const all = filteredStrategies();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  const groupOpts = DB.groups.map(g => optionHtml(g.id, g.name, filters.groupId)).join('');
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">策略管理</h1>
        <p class="page-desc">按来源条件 + 标签条件匹配对话流与变体，同组内按优先级升序、首条命中即停</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" type="button" onclick="openStrategyEdit(null)">
          <i data-lucide="plus"></i>新建策略
        </button>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">策略组</span>
          <select class="select" id="f-group">
            <option value="">全部</option>
            ${groupOpts}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <select class="select" id="f-status">
            <option value="">全部</option>
            <option value="draft"${filters.status === 'draft' ? ' selected' : ''}>草稿</option>
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
      <h4 class="card-title">策略列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>ID</th>
              <th>策略名称</th>
              <th>来源条件</th>
              <th>标签条件</th>
              <th>承接</th>
              <th>优先级</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(s => {
              const flow = flowById(s.takeoverFlowId);
              return `<tr>
                <td>${esc(s.id)}</td>
                <td>${esc(s.name)}</td>
                <td>${esc(s.sourceCondition || '不限')} <span class="cell-muted">（context）</span></td>
                <td>${esc(formatTagCondition(s.tagConditions))}</td>
                <td>${esc(flowPreview(flow, s.takeoverVariantKey))}</td>
                <td>${esc(s.priority)}</td>
                <td>${strategyStatusTag(s.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openStrategyEdit('${esc(s.id)}')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" onclick="deleteStrategy('${esc(s.id)}')">删除</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="8"><div class="table-empty">暂无数据</div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination(all.length, page, PAGE_SIZE, 'gotoPage')}
    </section>`;
  refreshIcons();
}

function variantOptions(flowId, selected) {
  const flow = flowById(flowId);
  return (flow?.variants || []).filter(v => v.status !== 'offline').map(v => optionHtml(v.key, `${v.name} (${v.key})`, selected)).join('');
}

function sourceFromGroup(groupId) {
  const g = groupById(groupId);
  return g?.defaultFlowId || '';
}

function condValueControl(idx, c) {
  const def = TAG_DEFS.find(t => t.key === c.key) || TAG_DEFS[0];
  if (c.op === 'in') {
    const selected = new Set(c.value || []);
    const chips = (c.value || []).map(v => `<span class="tag">${esc(v)}</span>`).join('');
    const opts = def.values.filter(v => !selected.has(v)).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    return `<div class="msel-fake">
      ${chips || '<span class="cell-muted">请选择取值</span>'}
      <select onchange="addCondValue(${idx}, this.value)">
        <option value="">添加</option>
        ${opts}
      </select>
    </div>`;
  }
  const opts = def.values.map(v => optionHtml(v, v, (c.value || [])[0] || '')).join('');
  return `<select class="select" onchange="setCondValue(${idx}, this.value)">
    <option value="">请输入取值</option>${opts}
  </select>`;
}

function renderCondList() {
  const host = document.getElementById('cond-list');
  if (!host) return;
  host.innerHTML = condDraft.map((c, idx) => `
    <div class="cond-row">
      <select class="select" onchange="setCondKey(${idx}, this.value)">
        ${TAG_DEFS.map(t => optionHtml(t.key, t.label, c.key)).join('')}
      </select>
      <select class="select" onchange="setCondOp(${idx}, this.value)">
        ${optionHtml('=', '=', c.op)}
        ${optionHtml('in', 'in', c.op)}
      </select>
      <div>${condValueControl(idx, c)}</div>
      <button class="icon-btn" type="button" ${condDraft.length <= 1 ? 'disabled' : ''} onclick="removeCond(${idx})" title="删除">
        <i data-lucide="trash-2"></i>
      </button>
    </div>`).join('');
  refreshIcons();
}

function addCond() {
  condDraft.push({ key: 'vip_level', op: '=', value: [] });
  dirty = true;
  renderCondList();
  syncSaveBtn();
}

function removeCond(idx) {
  if (condDraft.length <= 1) return;
  condDraft.splice(idx, 1);
  dirty = true;
  renderCondList();
  syncSaveBtn();
}

function setCondKey(idx, key) {
  condDraft[idx].key = key;
  condDraft[idx].value = [];
  dirty = true;
  renderCondList();
}

function setCondOp(idx, op) {
  condDraft[idx].op = op;
  condDraft[idx].value = [];
  dirty = true;
  renderCondList();
}

function setCondValue(idx, val) {
  condDraft[idx].value = val ? [val] : [];
  dirty = true;
  syncSaveBtn();
}

function addCondValue(idx, val) {
  if (!val) return;
  const set = new Set(condDraft[idx].value || []);
  set.add(val);
  condDraft[idx].value = [...set];
  dirty = true;
  renderCondList();
  syncSaveBtn();
}

function openStrategyEdit(id) {
  editingId = id;
  dirty = false;
  const s = id ? clone(strategyById(id)) : {
    id: '',
    groupId: DB.groups[0]?.id || '',
    name: '',
    sourceCondition: sourceFromGroup(DB.groups[0]?.id),
    tagConditions: [{ key: 'vip_level', op: 'in', value: [] }],
    takeoverFlowId: '',
    takeoverVariantKey: '',
    priority: 10,
    validStart: '',
    validEnd: '',
    status: 'draft'
  };
  condDraft = clone(s.tagConditions && s.tagConditions.length ? s.tagConditions : [{ key: 'vip_level', op: '=', value: [] }]);
  document.getElementById('strategyDrawerTitle').textContent = id ? '策略编辑' : '新建策略';
  document.getElementById('strategyDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">所属策略组<span class="req">*</span></label>
      <select class="select" id="s-group">
        <option value="">请选择所属策略组</option>
        ${DB.groups.map(g => optionHtml(g.id, g.name, s.groupId)).join('')}
      </select>
    </div>
    <div class="field">
      <label class="field-label">策略名称<span class="req">*</span></label>
      <input class="input" id="s-name" maxlength="30" placeholder="请输入策略名称" value="${esc(s.name)}" />
      <div class="field-error" id="err-name"></div>
    </div>
    <div class="field">
      <label class="field-label">来源条件<span class="req">*</span></label>
      <select class="select" id="s-source" disabled>
        ${publishedFlows().map(f => optionHtml(f.id, `${f.id}（context 对话流 id）`, s.sourceCondition)).join('')}
      </select>
      <div class="field-hint">一期来源条件固定从 deeplink context 读取，跟随所属策略组联动</div>
    </div>
    <div class="field">
      <label class="field-label">标签条件<span class="req">*</span></label>
      <div class="cond-box">
        <button class="btn btn-outline btn-sm" type="button" onclick="addCond()"><i data-lucide="plus"></i>添加标签条件</button>
        <div id="cond-list"></div>
      </div>
      <div class="field-error" id="err-cond"></div>
    </div>
    <div class="field">
      <label class="field-label">承接对话流<span class="req">*</span></label>
      <select class="select" id="s-flow">
        <option value="">请选择承接对话流</option>
        ${publishedFlows().map(f => optionHtml(f.id, `${f.name} (${f.id})`, s.takeoverFlowId)).join('')}
      </select>
    </div>
    <div class="field">
      <label class="field-label">承接变体<span class="req">*</span></label>
      <select class="select" id="s-variant">
        <option value="">请选择承接变体</option>
        ${variantOptions(s.takeoverFlowId, s.takeoverVariantKey)}
      </select>
    </div>
    <div class="field">
      <label class="field-label">优先级<span class="req">*</span></label>
      <input class="input" id="s-priority" type="number" min="1" max="9999" placeholder="请输入优先级,同组内唯一" value="${esc(s.priority)}" />
      <div class="field-error" id="err-priority"></div>
    </div>
    <div class="field">
      <label class="field-label">有效期</label>
      <div class="date-range">
        <input class="input" id="s-start" type="date" value="${esc(s.validStart || '')}" />
        <span class="date-sep">至</span>
        <input class="input" id="s-end" type="date" value="${esc(s.validEnd || '')}" />
      </div>
      <div class="field-error" id="err-date"></div>
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="s-status" value="active"${s.status === 'active' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="s-status" value="draft"${s.status === 'draft' ? ' checked' : ''}> 草稿</label>
        <label><input type="radio" name="s-status" value="disabled"${s.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>`;
  renderCondList();
  document.getElementById('s-group').addEventListener('change', () => {
    const gid = document.getElementById('s-group').value;
    document.getElementById('s-source').value = sourceFromGroup(gid);
    dirty = true;
    syncSaveBtn();
  });
  document.getElementById('s-flow').addEventListener('change', () => {
    const fid = document.getElementById('s-flow').value;
    document.getElementById('s-variant').innerHTML = `<option value="">请选择承接变体</option>${variantOptions(fid, '')}`;
    dirty = true;
    syncSaveBtn();
  });
  document.getElementById('strategyDrawerBody').addEventListener('input', () => { dirty = true; syncSaveBtn(); });
  document.getElementById('strategyDrawerBody').addEventListener('change', () => { dirty = true; syncSaveBtn(); });
  syncSaveBtn();
  openDrawer('strategyDrawer');
  refreshIcons();
}

function readForm() {
  return {
    groupId: document.getElementById('s-group')?.value || '',
    name: (document.getElementById('s-name')?.value || '').trim(),
    sourceCondition: document.getElementById('s-source')?.value || sourceFromGroup(document.getElementById('s-group')?.value),
    tagConditions: clone(condDraft),
    takeoverFlowId: document.getElementById('s-flow')?.value || '',
    takeoverVariantKey: document.getElementById('s-variant')?.value || '',
    priority: Number(document.getElementById('s-priority')?.value || 0),
    validStart: document.getElementById('s-start')?.value || '',
    validEnd: document.getElementById('s-end')?.value || '',
    status: document.querySelector('input[name="s-status"]:checked')?.value || 'draft'
  };
}

function condValid() {
  return condDraft.length >= 1 && condDraft.every(c => c.key && c.op && (c.value || []).length);
}

function syncSaveBtn() {
  const d = readForm();
  document.getElementById('strategySaveBtn').disabled = !d.groupId || !d.name || !d.takeoverFlowId || !d.takeoverVariantKey || !condValid();
}

function validate(d) {
  ['err-name', 'err-cond', 'err-priority', 'err-date'].forEach(id => fieldError(id, ''));
  let ok = true;
  if (!d.name) {
    fieldError('err-name', '请输入策略名称');
    ok = false;
  } else {
    const dup = DB.strategies.find(s => s.groupId === d.groupId && s.name === d.name && s.id !== editingId);
    if (dup) {
      fieldError('err-name', '同组内策略名称须唯一');
      ok = false;
    }
  }
  if (!condValid()) {
    fieldError('err-cond', '请至少添加一条完整的标签条件');
    ok = false;
  }
  if (!Number.isInteger(d.priority) || d.priority < 1 || d.priority > 9999) {
    fieldError('err-priority', '优先级须为 1-9999 的整数');
    ok = false;
  } else {
    const dupP = DB.strategies.find(s => s.groupId === d.groupId && s.priority === d.priority && s.id !== editingId);
    if (dupP) {
      fieldError('err-priority', '该优先级已被同组其他策略占用');
      ok = false;
    }
  }
  if (d.validStart && d.validEnd && d.validEnd < d.validStart) {
    fieldError('err-date', '结束日期不能早于开始日期');
    ok = false;
  }
  return ok;
}

function saveStrategy() {
  const d = readForm();
  if (!validate(d)) return;
  if (editingId) {
    const s = strategyById(editingId);
    Object.assign(s, d, { updatedAt: nowTs() });
  } else {
    DB.strategies.push({ id: nextId('str'), ...d, updatedAt: nowTs() });
  }
  saveStore();
  dirty = false;
  closeDrawer('strategyDrawer');
  showToast('保存成功');
  render();
}

async function maybeClose() {
  if (!dirty) return true;
  return confirmModal({ title: '确认取消？', message: '表单有未保存的改动', confirmText: '确认离开', danger: false });
}

async function deleteStrategy(id) {
  const s = strategyById(id);
  if (!s) return;
  const ok = await confirmModal({ title: `确认删除策略 ${s.name}？`, confirmText: '确认删除' });
  if (!ok) return;
  DB.strategies = DB.strategies.filter(x => x.id !== id);
  saveStore();
  showToast('删除成功');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('strategies');
  bindDrawerClose({ beforeClose: maybeClose });
  document.getElementById('strategySaveBtn').addEventListener('click', saveStrategy);
  document.getElementById('strategyCancelBtn').addEventListener('click', async () => {
    if (await maybeClose()) closeDrawer('strategyDrawer');
  });
  render();
});

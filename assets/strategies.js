/* 策略列表 / 编辑：来源 + 标签 chip → 对话流 */

const PAGE_SIZE = 20;
let page = 1;
let filters = readQueryFilters(['pl', 'bot', 'scene', 'tagCat']);
let editingId = null;
let dirty = false;
let tagDraft = [];

if (!filters.pl) filters.pl = defaultProductLine();
if (!filters.bot) filters.bot = defaultBot(filters.pl);

function applyQuery() {
  filters.pl = document.getElementById('f-pl')?.value || '';
  filters.bot = document.getElementById('f-bot')?.value || '';
  filters.scene = document.getElementById('f-scene')?.value || '';
  filters.tagCat = document.getElementById('f-tag')?.value || '';
  page = 1;
  writeQueryFilters(filters);
  render();
}

function onPlChange() {
  filters.pl = document.getElementById('f-pl').value;
  filters.bot = defaultBot(filters.pl);
  filters.scene = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot);
  document.getElementById('f-scene').innerHTML = `<option value="">全部</option>${sceneOptions(filters.pl, filters.bot, '')}`;
  applyQuery();
}

function onBotChange() {
  filters.bot = document.getElementById('f-bot').value;
  filters.scene = '';
  document.getElementById('f-scene').innerHTML = `<option value="">全部</option>${sceneOptions(filters.pl, filters.bot, '')}`;
  applyQuery();
}

function gotoPage(p) {
  page = p;
  render();
}

function filteredStrategies() {
  return DB.strategies
    .filter(s => {
      if (filters.pl && s.productLineId !== filters.pl) return false;
      if (filters.bot && s.botId !== filters.bot) return false;
      if (filters.scene && s.sceneId !== filters.scene) return false;
      if (filters.tagCat) {
        const group = TAG_GROUPS.find(g => g.category === filters.tagCat);
        if (group && !(s.tags || []).some(t => group.tags.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.priority - b.priority);
}

function render() {
  const all = filteredStrategies();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">策略管理</h1>
        <p class="page-desc">将来源 + 标签组合映射到对话流；未绑定用户不走标签策略，命中绑定对话流；全部未命中走兜底对话流</p>
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
          <span class="filter-label">产品线</span>
          <select class="select" id="f-pl" onchange="onPlChange()">${productLineOptions(filters.pl)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot</span>
          <select class="select" id="f-bot" onchange="onBotChange()">${botOptions(filters.pl, filters.bot)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">来源</span>
          <select class="select" id="f-scene" onchange="applyQuery()">
            <option value="">全部</option>
            ${sceneOptions(filters.pl, filters.bot, filters.scene)}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">标签分类</span>
          <select class="select" id="f-tag" onchange="applyQuery()">
            <option value="">全部</option>
            ${TAG_GROUPS.map(g => optionHtml(g.category, g.category, filters.tagCat)).join('')}
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="button" onclick="applyQuery()">查询</button>
        </div>
      </div>
    </section>
    <section class="card table-card">
      <h4 class="card-title">策略列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>优先级</th>
              <th>策略 ID</th>
              <th>来源</th>
              <th>标签组合</th>
              <th>对话流</th>
              <th>生效时间</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(s => {
              const sc = sceneById(s.sceneId);
              const flow = flowById(s.flowId);
              const same = all.filter(x => x.sceneId === s.sceneId);
              const idx = same.findIndex(x => x.id === s.id);
              return `<tr>
                <td>${esc(s.priority)}</td>
                <td>${esc(s.id)}</td>
                <td>${esc(sc ? sc.name : s.sceneId)}</td>
                <td>${esc(formatTags(s.tags))}</td>
                <td>${esc(flow ? `${flow.name} (${flow.id})` : s.flowId)}</td>
                <td>${esc((s.effectiveStart || s.effectiveEnd) ? `${s.effectiveStart || '-'} ~ ${s.effectiveEnd || '-'}` : '-')}</td>
                <td>${statusTag(s.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" ${idx <= 0 ? 'disabled' : ''} onclick="movePriority('${esc(s.id)}',-1)">上移</button>
                  <button class="link-btn" type="button" ${idx >= same.length - 1 ? 'disabled' : ''} onclick="movePriority('${esc(s.id)}',1)">下移</button>
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

function movePriority(id, dir) {
  const s = strategyById(id);
  if (!s) return;
  const same = DB.strategies.filter(x => x.sceneId === s.sceneId).sort((a, b) => a.priority - b.priority);
  const idx = same.findIndex(x => x.id === id);
  const swap = same[idx + dir];
  if (!swap) return;
  const tmp = s.priority;
  s.priority = swap.priority;
  swap.priority = tmp;
  saveStore();
  render();
}

function nextPriority(sceneId) {
  const same = DB.strategies.filter(s => s.sceneId === sceneId);
  if (!same.length) return 10;
  return Math.max(...same.map(s => s.priority)) + 10;
}

function openStrategyEdit(id) {
  const scenes = scenesByScope(filters.pl, filters.bot);
  if (!scenes.length) {
    showToast('当前筛选来源必须存在', 'err');
    return;
  }
  editingId = id;
  dirty = false;
  const s = id ? clone(strategyById(id)) : {
    id: '',
    sceneId: filters.scene || scenes[0].id,
    productLineId: filters.pl,
    botId: filters.bot,
    tags: [],
    flowId: '',
    priority: nextPriority(filters.scene || scenes[0].id),
    effectiveStart: '',
    effectiveEnd: '',
    status: 'active',
    remark: ''
  };
  tagDraft = clone(s.tags || []);
  document.getElementById('strategyDrawerTitle').textContent = id ? '编辑策略' : '新建策略';
  document.getElementById('strategyDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">产品线<span class="req">*</span></label>
      <select class="select" id="st-pl" onchange="onStPlChange()">${productLineOptions(s.productLineId)}</select>
    </div>
    <div class="field">
      <label class="field-label">Bot<span class="req">*</span></label>
      <select class="select" id="st-bot" onchange="onStBotChange()">${botOptions(s.productLineId, s.botId)}</select>
    </div>
    <div class="field">
      <label class="field-label">策略 ID<span class="req">*</span></label>
      <input class="input" id="st-id" maxlength="50" ${id ? 'disabled' : ''} placeholder="请输入策略 ID" value="${esc(s.id)}" />
      <div class="field-error" id="err-id"></div>
    </div>
    <div class="field">
      <label class="field-label">来源<span class="req">*</span></label>
      <select class="select" id="st-scene" onchange="onStSceneChange()">
        ${sceneOptions(s.productLineId, s.botId, s.sceneId)}
      </select>
    </div>
    <div class="field">
      <label class="field-label">标签组合<span class="req">*</span></label>
      <div class="field-hint">多选 AND，命中需同时满足所有选中标签</div>
      <div id="tag-chips">${renderTagChips()}</div>
      <div class="field-error" id="err-tags"></div>
    </div>
    <div class="field">
      <label class="field-label">对话流<span class="req">*</span></label>
      <select class="select" id="st-flow">
        <option value="">请选择对话流</option>
        ${publishedMatchFlowOptions(s.productLineId, s.botId, s.flowId)}
      </select>
    </div>
    <div class="field">
      <label class="field-label">优先级<span class="req">*</span></label>
      <input class="input" id="st-priority" type="number" min="0" max="999" value="${esc(s.priority)}" />
      <div class="field-error" id="err-priority"></div>
    </div>
    <div class="field">
      <label class="field-label">生效开始时间</label>
      <input class="input" id="st-start" type="datetime-local" value="${esc((s.effectiveStart || '').replace(' ', 'T').slice(0, 16))}" />
    </div>
    <div class="field">
      <label class="field-label">生效结束时间</label>
      <input class="input" id="st-end" type="datetime-local" value="${esc((s.effectiveEnd || '').replace(' ', 'T').slice(0, 16))}" />
      <div class="field-error" id="err-date"></div>
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="st-status" value="active"${s.status === 'active' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="st-status" value="disabled"${s.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">备注</label>
      <textarea class="textarea" id="st-remark" maxlength="500" placeholder="请输入备注">${esc(s.remark || '')}</textarea>
    </div>`;
  document.getElementById('strategyDrawerBody').addEventListener('input', () => { dirty = true; syncSaveBtn(); });
  document.getElementById('strategyDrawerBody').addEventListener('change', () => { dirty = true; syncSaveBtn(); });
  syncSaveBtn();
  openDrawer('strategyDrawer');
  refreshIcons();
}

function renderTagChips() {
  return TAG_GROUPS.map(g => `
    <div class="chip-group-label">${esc(g.category)}</div>
    <div class="chip-group">
      ${g.tags.map(t => {
        const on = tagDraft.includes(t);
        return `<button type="button" class="chip${on ? ' selected' : ''}" onclick="toggleTag('${t}')">${esc(tagLabel(t))}</button>`;
      }).join('')}
    </div>`).join('');
}

function toggleTag(t) {
  dirty = true;
  if (tagDraft.includes(t)) tagDraft = tagDraft.filter(x => x !== t);
  else tagDraft.push(t);
  const host = document.getElementById('tag-chips');
  if (host) host.innerHTML = renderTagChips();
  syncSaveBtn();
}

function onStPlChange() {
  const pl = document.getElementById('st-pl').value;
  const bot = defaultBot(pl);
  document.getElementById('st-bot').innerHTML = botOptions(pl, bot);
  onStBotChange();
}

function onStBotChange() {
  const pl = document.getElementById('st-pl').value;
  const bot = document.getElementById('st-bot').value;
  document.getElementById('st-scene').innerHTML = sceneOptions(pl, bot, '');
  document.getElementById('st-flow').innerHTML = `<option value="">请选择对话流</option>${publishedMatchFlowOptions(pl, bot, '')}`;
  onStSceneChange();
}

function onStSceneChange() {
  const sceneId = document.getElementById('st-scene').value;
  if (!editingId) document.getElementById('st-priority').value = nextPriority(sceneId);
  syncSaveBtn();
}

function toTs(v) {
  return v ? v.replace('T', ' ') + ':00' : '';
}

function readForm() {
  return {
    id: (document.getElementById('st-id')?.value || '').trim(),
    sceneId: document.getElementById('st-scene')?.value || '',
    productLineId: document.getElementById('st-pl')?.value || '',
    botId: document.getElementById('st-bot')?.value || '',
    tags: clone(tagDraft),
    flowId: document.getElementById('st-flow')?.value || '',
    priority: Number(document.getElementById('st-priority')?.value || 0),
    effectiveStart: toTs(document.getElementById('st-start')?.value || ''),
    effectiveEnd: toTs(document.getElementById('st-end')?.value || ''),
    status: document.querySelector('input[name="st-status"]:checked')?.value || 'active',
    remark: (document.getElementById('st-remark')?.value || '').trim()
  };
}

function syncSaveBtn() {
  const d = readForm();
  document.getElementById('strategySaveBtn').disabled = !d.id || !d.sceneId || !d.flowId || !(d.tags || []).length;
}

function saveStrategy() {
  const d = readForm();
  ['err-id', 'err-tags', 'err-priority', 'err-date'].forEach(id => fieldError(id, ''));
  if (!editingId) {
    if (!isIdToken(d.id)) {
      fieldError('err-id', '必须以字母开头，长度 1-50');
      return;
    }
    if (strategyById(d.id)) {
      fieldError('err-id', '该策略 ID 已存在');
      return;
    }
  }
  if (!d.tags.length) {
    fieldError('err-tags', '请至少选择 1 个标签');
    return;
  }
  if (!Number.isInteger(d.priority) || d.priority < 0 || d.priority > 999) {
    fieldError('err-priority', '优先级须为 0-999 的整数');
    return;
  }
  const dup = DB.strategies.find(s => s.sceneId === d.sceneId && s.priority === d.priority && s.id !== editingId);
  if (dup) {
    fieldError('err-priority', '该优先级已被同来源其他策略占用');
    return;
  }
  if (d.effectiveStart && d.effectiveEnd && d.effectiveEnd < d.effectiveStart) {
    fieldError('err-date', '结束时间须晚于开始时间');
    return;
  }
  if (editingId) Object.assign(strategyById(editingId), d, { id: editingId });
  else DB.strategies.push({ ...d, createdAt: nowTs() });
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
  const ok = await confirmModal({ title: `确认删除策略 ${s.id}？`, confirmText: '确认删除' });
  if (!ok) return;
  DB.strategies = DB.strategies.filter(x => x.id !== id);
  saveStore();
  showToast('删除成功');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('strategies');
  writeQueryFilters(filters);
  bindDrawerClose({ beforeClose: maybeClose });
  document.getElementById('strategySaveBtn').addEventListener('click', saveStrategy);
  document.getElementById('strategyCancelBtn').addEventListener('click', async () => {
    if (await maybeClose()) closeDrawer('strategyDrawer');
  });
  render();
});

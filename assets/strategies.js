/* 策略列表 / 编辑：来源多选 + 星灵标签 → 对话流 */

const PAGE_SIZE = 20;
let page = 1;
let filters = readQueryFilters(['pl', 'platform', 'bot', 'strategyId', 'strategyName', 'sceneCode', 'sceneName', 'status']);
let editingId = null;
let dirty = false;
let sceneDraft = [];
let protosRows = [{ parentId: '', childIds: [] }];

if (!filters.pl) filters.pl = defaultProductLine();
if (!filters.platform) filters.platform = defaultPlatform();
if (!filters.bot) filters.bot = defaultBot(filters.pl, filters.platform);

function applyQuery() {
  filters.pl = document.getElementById('f-pl')?.value || '';
  filters.platform = document.getElementById('f-platform')?.value || '';
  filters.bot = document.getElementById('f-bot')?.value || '';
  filters.strategyId = document.getElementById('f-strategy-id')?.value || '';
  filters.strategyName = document.getElementById('f-strategy-name')?.value || '';
  filters.sceneCode = document.getElementById('f-scene-code')?.value || '';
  filters.sceneName = document.getElementById('f-scene-name')?.value || '';
  filters.status = document.getElementById('f-status')?.value || '';
  page = 1;
  writeQueryFilters(filters);
  render();
}

function onPlChange() {
  filters.pl = document.getElementById('f-pl').value;
  filters.bot = defaultBot(filters.pl, filters.platform);
  filters.strategyId = '';
  filters.strategyName = '';
  filters.sceneCode = '';
  filters.sceneName = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot, filters.platform);
  applyQuery();
}

function onPlatformChange() {
  filters.platform = document.getElementById('f-platform').value;
  filters.bot = defaultBot(filters.pl, filters.platform);
  filters.strategyId = '';
  filters.strategyName = '';
  filters.sceneCode = '';
  filters.sceneName = '';
  document.getElementById('f-bot').innerHTML = botOptions(filters.pl, filters.bot, filters.platform);
  applyQuery();
}

function onBotChange() {
  filters.bot = document.getElementById('f-bot').value;
  filters.strategyId = '';
  filters.strategyName = '';
  filters.sceneCode = '';
  filters.sceneName = '';
  applyQuery();
}

function gotoPage(p) {
  page = p;
  render();
}

function scopedStrategies() {
  return DB.strategies.filter(s => {
    if (isFallbackStrategy(s)) return false;
    if (filters.pl && s.productLineId !== filters.pl) return false;
    if (filters.platform && s.platform && s.platform !== filters.platform) return false;
    if (filters.bot && s.botId !== filters.bot) return false;
    return true;
  });
}

function filteredStrategies() {
  return scopedStrategies()
    .filter(s => {
      if (filters.strategyId && s.id !== filters.strategyId) return false;
      if (filters.strategyName && s.id !== filters.strategyName) return false;
      const ids = strategySceneIds(s);
      if (filters.sceneCode && !ids.includes(filters.sceneCode)) return false;
      if (filters.sceneName && !ids.includes(filters.sceneName)) return false;
      if (filters.status && s.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function formatSceneNames(s) {
  const ids = strategySceneIds(s);
  if (!ids.length) return '不限';
  return ids.map(id => sceneById(id)?.name || id).join(' / ');
}

function ensureFallbackStrategy() {
  let fb = findFallbackStrategy(filters.pl, filters.bot, filters.platform);
  if (fb) return fb;
  const flow = findFixedFlow(filters.pl, filters.bot, 'fallback', filters.platform);
  fb = {
    id: `strategy_fallback_${filters.bot || 'default'}`,
    type: 'fallback',
    name: '兜底策略',
    sceneIds: [],
    productLineId: filters.pl,
    platform: filters.platform,
    botId: filters.bot,
    protosTagIds: [],
    tags: [],
    flowId: flow?.id || '',
    priority: 999,
    effectiveStart: '',
    effectiveEnd: '',
    status: 'active',
    remark: '所有策略都没匹配上时走此策略',
    createdAt: nowTs()
  };
  if (strategyById(fb.id)) fb.id = nextId('strategy_fallback');
  DB.strategies.push(fb);
  saveStore();
  return fb;
}

function fallbackRowHtml() {
  const fb = findFallbackStrategy(filters.pl, filters.bot, filters.platform);
  const flow = fb ? flowById(fb.flowId) : null;
  return `<tr class="fallback-row">
    <td>-</td>
    <td>${esc(fb?.id || '-')}</td>
    <td>${fixedPinHtml()}${esc(fb?.name || '兜底策略')}</td>
    <td>-</td>
    <td>-</td>
    <td>${esc(flow ? `${flow.name} (${flow.id})` : (fb?.flowId || '-'))}</td>
    <td>-</td>
    <td>${fb ? statusTag(fb.status) : statusTag('draft')}</td>
    <td class="col-ops">
      <button class="link-btn" type="button" onclick="editFallbackStrategy()">编辑</button>
    </td>
  </tr>`;
}

function editFallbackStrategy() {
  const fb = ensureFallbackStrategy();
  openStrategyEdit(fb.id);
}

function render() {
  const all = filteredStrategies();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  const scopeScenes = scenesByScope(filters.pl, filters.bot, filters.platform);
  const scopeStrategies = scopedStrategies();
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">策略管理</h1>
        <p class="page-desc">将来源 + 星灵标签映射到对话流；全部未命中走兜底策略</p>
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
          <span class="filter-label">平台</span>
          <select class="select" id="f-platform" onchange="onPlatformChange()">${platformOptions(filters.platform)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot</span>
          <select class="select" id="f-bot" onchange="onBotChange()">${botOptions(filters.pl, filters.bot, filters.platform)}</select>
        </div>
        <div class="filter-item">
          <span class="filter-label">策略 ID</span>
          <select class="select" id="f-strategy-id" onchange="applyQuery()">
            <option value="">全部</option>
            ${scopeStrategies.map(s => optionHtml(s.id, s.id, filters.strategyId)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">策略名称</span>
          <select class="select" id="f-strategy-name" onchange="applyQuery()">
            <option value="">全部</option>
            ${scopeStrategies.map(s => optionHtml(s.id, s.name || s.id, filters.strategyName)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">来源 code</span>
          <select class="select" id="f-scene-code" onchange="applyQuery()">
            <option value="">全部</option>
            ${scopeScenes.map(s => optionHtml(s.id, s.id, filters.sceneCode)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">来源名称</span>
          <select class="select" id="f-scene-name" onchange="applyQuery()">
            <option value="">全部</option>
            ${scopeScenes.map(s => optionHtml(s.id, s.name, filters.sceneName)).join('')}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <select class="select" id="f-status" onchange="applyQuery()">
            <option value="">全部</option>
            <option value="active"${filters.status === 'active' ? ' selected' : ''}>启用</option>
            <option value="disabled"${filters.status === 'disabled' ? ' selected' : ''}>停用</option>
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
              <th>策略名称</th>
              <th>来源</th>
              <th>星灵标签</th>
              <th>对话流</th>
              <th>生效时间</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${fallbackRowHtml()}
            ${list.length ? list.map(s => {
              const flow = flowById(s.flowId);
              return `<tr>
                <td>${esc(s.priority)}</td>
                <td>${esc(s.id)}</td>
                <td>${esc(s.name || '-')}</td>
                <td>${esc(formatSceneNames(s))}</td>
                <td>${esc(formatTags(s.tags))}</td>
                <td>${esc(flow ? `${flow.name} (${flow.id})` : s.flowId)}</td>
                <td>${esc((s.effectiveStart || s.effectiveEnd) ? `${s.effectiveStart || '-'} ~ ${s.effectiveEnd || '-'}` : '-')}</td>
                <td>${statusTag(s.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openStrategyEdit('${esc(s.id)}')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" onclick="deleteStrategy('${esc(s.id)}')">删除</button>
                </td>
              </tr>`;
            }).join('') : ''}
          </tbody>
        </table>
      </div>
      ${renderPagination(all.length, page, PAGE_SIZE, 'gotoPage')}
    </section>`;
  refreshIcons();
}

function nextPriority() {
  const same = DB.strategies.filter(s =>
    !isFallbackStrategy(s) &&
    s.productLineId === filters.pl &&
    s.botId === filters.bot &&
    (!s.platform || s.platform === filters.platform)
  );
  if (!same.length) return 10;
  return Math.max(...same.map(s => s.priority)) + 10;
}

function buildProtosRows(s) {
  const parents = (s.protosTagIds || []).filter(Boolean);
  if (!parents.length) {
    const tags = s.tags || [];
    if (!tags.length) return [{ parentId: '', childIds: [] }];
    // legacy: infer parents from children
    const rows = [];
    PROTOS_TAGS.forEach(p => {
      const childIds = (p.children || []).map(c => c.id).filter(cid => tags.includes(cid));
      if (childIds.length) rows.push({ parentId: p.id, childIds });
    });
    return rows.length ? rows : [{ parentId: '', childIds: [] }];
  }
  return parents.map(pid => {
    const allowed = new Set((protosParentById(pid)?.children || []).map(c => c.id));
    return { parentId: pid, childIds: (s.tags || []).filter(t => allowed.has(t)) };
  });
}

function collectProtosFromRows() {
  const protosTagIds = [];
  const tags = [];
  protosRows.forEach(r => {
    if (!r.parentId) return;
    if (!protosTagIds.includes(r.parentId)) protosTagIds.push(r.parentId);
    (r.childIds || []).forEach(cid => {
      if (!tags.includes(cid)) tags.push(cid);
    });
  });
  return { protosTagIds, tags };
}

function openStrategyEdit(id) {
  editingId = id;
  dirty = false;
  const existing = id ? strategyById(id) : null;
  const isFallback = isFallbackStrategy(existing);
  const s = id ? clone(existing) : {
    id: '',
    name: '',
    sceneIds: [],
    productLineId: filters.pl,
    platform: filters.platform,
    botId: filters.bot,
    protosTagIds: [],
    tags: [],
    flowId: '',
    priority: nextPriority(),
    effectiveStart: '',
    effectiveEnd: '',
    status: 'active',
    remark: ''
  };
  if (!s.platform) s.platform = filters.platform || defaultPlatform();
  sceneDraft = strategySceneIds(s);
  protosRows = buildProtosRows(s);
  const scopeLocked = !!id;
  document.getElementById('strategyDrawerTitle').textContent = isFallback
    ? '编辑兜底策略'
    : (id ? '编辑策略' : '新建策略');

  if (isFallback) {
    document.getElementById('strategyDrawerBody').innerHTML = `
      <div class="field">
        <label class="field-label">产品线</label>
        <input class="input" disabled value="${esc(productLineById(s.productLineId)?.name || s.productLineId)}" />
        <input type="hidden" id="st-pl" value="${esc(s.productLineId)}" />
      </div>
      <div class="field">
        <label class="field-label">平台</label>
        <input class="input" disabled value="${esc(s.platform)}" />
        <input type="hidden" id="st-platform" value="${esc(s.platform)}" />
      </div>
      <div class="field">
        <label class="field-label">Bot</label>
        <input class="input" disabled value="${esc(DB.bots.find(b => b.id === s.botId)?.botName || s.botId)}" />
        <input type="hidden" id="st-bot" value="${esc(s.botId)}" />
      </div>
      <div class="field">
        <label class="field-label">策略名称</label>
        <input class="input" id="st-name" disabled value="${esc(s.name || '兜底策略')}" />
        <div class="field-hint">所有普通策略未命中时走此策略</div>
      </div>
      <div class="field">
        <label class="field-label">对话流<span class="req">*</span></label>
        <select class="select" id="st-flow">
          <option value="">请选择对话流</option>
          ${publishedFlowOptions(s.productLineId, s.botId, s.flowId, s.platform)}
        </select>
        <div class="field-hint">建议绑定兜底对话流；若尚未创建，请先在对话流页新建</div>
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
      </div>
      <input type="hidden" id="st-priority" value="${esc(s.priority || 999)}" />
      <input type="hidden" id="st-start" value="" />
      <input type="hidden" id="st-end" value="" />`;
  } else {
    document.getElementById('strategyDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">产品线<span class="req">*</span></label>
      <select class="select" id="st-pl" ${scopeLocked ? 'disabled' : ''} onchange="onStPlChange()">${productLineOptions(s.productLineId)}</select>
    </div>
    <div class="field">
      <label class="field-label">平台<span class="req">*</span></label>
      <select class="select" id="st-platform" ${scopeLocked ? 'disabled' : ''} onchange="onStPlatformChange()">${platformOptions(s.platform)}</select>
    </div>
    <div class="field">
      <label class="field-label">Bot<span class="req">*</span></label>
      <select class="select" id="st-bot" ${scopeLocked ? 'disabled' : ''} onchange="onStBotChange()">${botOptions(s.productLineId, s.botId, s.platform)}</select>
    </div>
    <div class="field">
      <label class="field-label">策略名称<span class="req">*</span></label>
      <input class="input" id="st-name" maxlength="30" placeholder="请输入策略名称" value="${esc(s.name || '')}" />
      <div class="field-error" id="err-name"></div>
    </div>
    <div class="field">
      <label class="field-label">来源</label>
      <div class="field-hint">非必填，可多选；不选表示不限来源</div>
      <div id="scene-chips">${renderSceneChips(s.productLineId, s.botId, s.platform)}</div>
    </div>
    <div class="field">
      <label class="field-label">星灵标签 / Protos Tags<span class="req">*</span></label>
      <div class="field-hint">默认 1 个标签下拉，可选后展示子标签；最多添加 10 个</div>
      <div id="protos-rows">${renderProtosRows()}</div>
      <button type="button" class="btn btn-outline protos-add-btn" id="protos-add-btn" ${protosRows.length >= 10 ? 'disabled' : ''} onclick="addProtosRow()">
        <i data-lucide="plus"></i>添加标签
      </button>
      <div class="field-error" id="err-tags"></div>
    </div>
    <div class="field">
      <label class="field-label">对话流<span class="req">*</span></label>
      <select class="select" id="st-flow">
        <option value="">请选择对话流</option>
        ${publishedMatchFlowOptions(s.productLineId, s.botId, s.flowId, s.platform)}
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
  }
  document.getElementById('strategyDrawerBody').addEventListener('input', () => { dirty = true; syncSaveBtn(); });
  document.getElementById('strategyDrawerBody').addEventListener('change', () => { dirty = true; syncSaveBtn(); });
  syncSaveBtn();
  openDrawer('strategyDrawer');
  refreshIcons();
}

function renderSceneChips(pl, bot, platform) {
  const list = scenesByScope(pl, bot, platform);
  if (!list.length) return '<div class="cell-muted">当前范围暂无来源</div>';
  return `<div class="chip-group">${list.map(s => {
    const on = sceneDraft.includes(s.id);
    return `<button type="button" class="chip${on ? ' selected' : ''}" onclick="toggleScene('${esc(s.id)}')">${esc(s.name)} (${esc(s.id)})</button>`;
  }).join('')}</div>`;
}

function toggleScene(id) {
  dirty = true;
  if (sceneDraft.includes(id)) sceneDraft = sceneDraft.filter(x => x !== id);
  else sceneDraft.push(id);
  const pl = document.getElementById('st-pl')?.value;
  const bot = document.getElementById('st-bot')?.value;
  const platform = document.getElementById('st-platform')?.value;
  const host = document.getElementById('scene-chips');
  if (host) host.innerHTML = renderSceneChips(pl, bot, platform);
  syncSaveBtn();
}

function renderProtosRows() {
  const used = new Set(protosRows.map(r => r.parentId).filter(Boolean));
  return `<div class="protos-rows">${protosRows.map((row, idx) => {
    const parent = row.parentId ? protosParentById(row.parentId) : null;
    const parentOpts = PROTOS_TAGS
      .filter(p => p.id === row.parentId || !used.has(p.id))
      .map(p => optionHtml(p.id, p.name, row.parentId))
      .join('');
    const children = parent?.children || [];
    return `<div class="protos-row">
      <div class="protos-row-head">
        <select class="select" onchange="onProtosParentChange(${idx}, this.value)">
          <option value="">请选择标签</option>
          ${parentOpts}
        </select>
        ${protosRows.length > 1 ? `<button type="button" class="link-btn link-btn-danger" onclick="removeProtosRow(${idx})">删除</button>` : ''}
      </div>
      ${row.parentId ? `<div class="protos-row-children">
        <div class="chip-group-label">子标签</div>
        ${children.length ? `<div class="chip-group">${children.map(c => {
          const on = (row.childIds || []).includes(c.id);
          return `<button type="button" class="chip${on ? ' selected' : ''}" onclick="toggleProtosChild(${idx}, '${esc(c.id)}')">${esc(c.name)}</button>`;
        }).join('')}</div>` : '<div class="cell-muted">该标签暂无子标签</div>'}
      </div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function refreshProtosRowsUi() {
  const host = document.getElementById('protos-rows');
  if (host) host.innerHTML = renderProtosRows();
  const addBtn = document.getElementById('protos-add-btn');
  if (addBtn) addBtn.disabled = protosRows.length >= 10;
  refreshIcons();
  syncSaveBtn();
}

function addProtosRow() {
  if (protosRows.length >= 10) {
    showToast('最多可添加 10 个标签', 'err');
    return;
  }
  dirty = true;
  protosRows.push({ parentId: '', childIds: [] });
  refreshProtosRowsUi();
}

function removeProtosRow(idx) {
  if (protosRows.length <= 1) return;
  dirty = true;
  protosRows.splice(idx, 1);
  refreshProtosRowsUi();
}

function onProtosParentChange(idx, parentId) {
  dirty = true;
  const row = protosRows[idx];
  if (!row) return;
  if (parentId && protosRows.some((r, i) => i !== idx && r.parentId === parentId)) {
    showToast('该标签已添加', 'err');
    refreshProtosRowsUi();
    return;
  }
  row.parentId = parentId;
  row.childIds = [];
  refreshProtosRowsUi();
}

function toggleProtosChild(idx, childId) {
  dirty = true;
  const row = protosRows[idx];
  if (!row) return;
  if ((row.childIds || []).includes(childId)) {
    row.childIds = row.childIds.filter(x => x !== childId);
  } else {
    row.childIds = [...(row.childIds || []), childId];
  }
  refreshProtosRowsUi();
}

function onStPlChange() {
  const pl = document.getElementById('st-pl').value;
  const platform = document.getElementById('st-platform').value;
  const bot = defaultBot(pl, platform);
  document.getElementById('st-bot').innerHTML = botOptions(pl, bot, platform);
  onStBotChange();
}

function onStPlatformChange() {
  onStPlChange();
}

function onStBotChange() {
  const pl = document.getElementById('st-pl').value;
  const bot = document.getElementById('st-bot').value;
  const platform = document.getElementById('st-platform').value;
  sceneDraft = sceneDraft.filter(id => scenesByScope(pl, bot, platform).some(s => s.id === id));
  const host = document.getElementById('scene-chips');
  if (host) host.innerHTML = renderSceneChips(pl, bot, platform);
  document.getElementById('st-flow').innerHTML = `<option value="">请选择对话流</option>${publishedMatchFlowOptions(pl, bot, '', platform)}`;
  syncSaveBtn();
}

function toTs(v) {
  return v ? v.replace('T', ' ') + ':00' : '';
}

function readForm() {
  const { protosTagIds, tags } = collectProtosFromRows();
  return {
    name: (document.getElementById('st-name')?.value || '').trim(),
    sceneIds: clone(sceneDraft),
    productLineId: document.getElementById('st-pl')?.value || '',
    platform: document.getElementById('st-platform')?.value || '',
    botId: document.getElementById('st-bot')?.value || '',
    protosTagIds,
    tags,
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
  const cur = editingId ? strategyById(editingId) : null;
  if (isFallbackStrategy(cur)) {
    document.getElementById('strategySaveBtn').disabled = !d.flowId;
    return;
  }
  document.getElementById('strategySaveBtn').disabled =
    !d.name || !d.flowId || !(d.tags || []).length || !d.productLineId || !d.platform || !d.botId;
}

function saveStrategy() {
  const cur = editingId ? strategyById(editingId) : null;
  const d = readForm();
  ['err-name', 'err-tags', 'err-priority', 'err-date'].forEach(id => fieldError(id, ''));

  if (isFallbackStrategy(cur)) {
    if (!d.flowId) {
      showToast('请选择对话流', 'err');
      return;
    }
    Object.assign(cur, {
      flowId: d.flowId,
      status: d.status,
      remark: d.remark,
      name: cur.name || '兜底策略',
      type: 'fallback',
      sceneIds: [],
      protosTagIds: [],
      tags: [],
      priority: 999
    });
    saveStore();
    dirty = false;
    closeDrawer('strategyDrawer');
    showToast('保存成功');
    render();
    return;
  }

  if (!d.name) {
    fieldError('err-name', '请输入策略名称');
    return;
  }
  if (d.name.length > 30) {
    fieldError('err-name', '策略名称最多 30 个字符');
    return;
  }
  if (!d.protosTagIds.length) {
    fieldError('err-tags', '请至少选择 1 个星灵标签');
    return;
  }
  if (d.protosTagIds.length > 10) {
    fieldError('err-tags', '最多可添加 10 个标签');
    return;
  }
  if (!d.tags.length) {
    fieldError('err-tags', '请至少选择 1 个子标签');
    return;
  }
  if (!Number.isInteger(d.priority) || d.priority < 0 || d.priority > 999) {
    fieldError('err-priority', '优先级须为 0-999 的整数');
    return;
  }
  const dup = DB.strategies.find(s =>
    !isFallbackStrategy(s) &&
    s.productLineId === d.productLineId &&
    s.botId === d.botId &&
    (!s.platform || s.platform === d.platform) &&
    s.priority === d.priority &&
    s.id !== editingId
  );
  if (dup) {
    fieldError('err-priority', '该优先级已被同范围其他策略占用');
    return;
  }
  if (d.effectiveStart && d.effectiveEnd && d.effectiveEnd < d.effectiveStart) {
    fieldError('err-date', '结束时间须晚于开始时间');
    return;
  }
  const payload = { ...d };
  delete payload.sceneId;
  if (editingId) {
    const target = strategyById(editingId);
    Object.assign(target, payload, { id: editingId });
    delete target.sceneId;
  } else {
    DB.strategies.push({ ...payload, id: nextId('strategy'), createdAt: nowTs() });
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
  if (isFallbackStrategy(s)) {
    showToast('兜底策略不可删除', 'err');
    return;
  }
  const ok = await confirmModal({ title: `确认删除策略 ${s.name || s.id}？`, confirmText: '确认删除' });
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

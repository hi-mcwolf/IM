/* 策略列表 / 编辑：来源多选 + 星灵标签 → 对话流 */

const PAGE_SIZE = 20;
let page = 1;
let filters = readQueryFilters(['pl', 'platform', 'bot', 'strategyId', 'strategyName', 'sceneCode', 'sceneName', 'status']);
let editingId = null;
let dirty = false;
let fallbackDraft = 'no';
let sceneDraft = [];
let sceneQuery = '';
let sceneOpen = false;
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
    .sort((a, b) => {
      const rank = s => (s.type === 'fallback' ? 1 : 0);
      return rank(a) - rank(b) || a.priority - b.priority || a.id.localeCompare(b.id);
    });
}

function isFallbackStrategy(s) {
  return !!s && s.type === 'fallback';
}

function scopeHasFallback(pl, platform, bot) {
  return DB.strategies.some(s =>
    isFallbackStrategy(s) &&
    s.productLineId === pl &&
    s.botId === bot &&
    (!s.platform || s.platform === platform)
  );
}

function creatingFallback() {
  if (editingId) return false;
  const field = document.getElementById('st-fallback-field');
  if (!field || field.hidden) return false;
  return (document.querySelector('input[name="st-fallback"]:checked')?.value || fallbackDraft) === 'yes';
}

function applyFallbackVisibility() {
  const yes = creatingFallback();
  const box = document.getElementById('st-nonfallback-fields');
  if (box) box.hidden = yes;
  const req = document.getElementById('st-tags-req');
  if (req) req.hidden = yes;
}

function onStFallbackChange() {
  fallbackDraft = document.querySelector('input[name="st-fallback"]:checked')?.value || 'no';
  applyFallbackVisibility();
  dirty = true;
  syncSaveBtn();
}

function syncFallbackField() {
  if (editingId) return;
  const field = document.getElementById('st-fallback-field');
  if (!field) return;
  const pl = document.getElementById('st-pl')?.value || '';
  const platform = document.getElementById('st-platform')?.value || '';
  const bot = document.getElementById('st-bot')?.value || '';
  const show = !scopeHasFallback(pl, platform, bot);
  field.hidden = !show;
  if (!show) {
    fallbackDraft = 'no';
    const no = document.querySelector('input[name="st-fallback"][value="no"]');
    if (no) no.checked = true;
  }
  applyFallbackVisibility();
  syncSaveBtn();
}

function formatEffectiveTime(s) {
  if (isFallbackStrategy(s) || (!s.effectiveStart && !s.effectiveEnd)) return '-';
  return `<span class="strategy-time"><span>${esc(s.effectiveStart || '-')}</span><span>${esc(s.effectiveEnd || '-')}</span></span>`;
}

function formatSceneNames(s) {
  const ids = strategySceneIds(s);
  if (!ids.length) return '不限';
  return ids.map(id => sceneById(id)?.name || id).join(' / ');
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
        <p class="page-desc">将来源 + 星灵标签映射到对话流</p>
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
        <table class="table strategy-table">
          <thead>
            <tr>
              <th class="col-nowrap">优先级</th>
              <th>策略 ID</th>
              <th>策略名称</th>
              <th>来源</th>
              <th>星灵标签</th>
              <th>对话流</th>
              <th>生效时间</th>
              <th class="col-nowrap">状态</th>
              <th class="col-ops col-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(s => {
              const flow = flowById(s.flowId);
              const fb = isFallbackStrategy(s);
              return `<tr${fb ? ' class="fallback-row"' : ''}>
                <td class="col-nowrap">${fb ? '-' : esc(s.priority)}</td>
                <td>${esc(s.id)}</td>
                <td>${esc(s.name || '-')}${fb ? fixedPinHtml() : ''}</td>
                <td>${esc(formatSceneNames(s))}</td>
                <td>${esc(formatTags(s.tags))}</td>
                <td>${esc(flow ? `${flow.name} (${flow.id})` : s.flowId)}</td>
                <td>${formatEffectiveTime(s)}</td>
                <td class="col-nowrap">${statusTag(s.status)}</td>
                <td class="col-ops col-nowrap">
                  <button class="link-btn" type="button" onclick="openStrategyEdit('${esc(s.id)}')">编辑</button>
                  ${fb ? '' : `<button class="link-btn link-btn-danger" type="button" onclick="deleteStrategy('${esc(s.id)}')">删除</button>`}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="9"><div class="table-empty">暂无数据</div></td></tr>`}
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
  fallbackDraft = 'no';
  const existing = id ? strategyById(id) : null;
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
  sceneQuery = '';
  sceneOpen = false;
  protosRows = buildProtosRows(s);
  const scopeLocked = !!id;
  const isFallback = isFallbackStrategy(s);
  document.getElementById('strategyDrawerTitle').textContent = isFallback ? '编辑兜底策略' : (id ? '编辑策略' : '新建策略');

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
      <div id="scene-msel-host">${renderSceneSelect(s.productLineId, s.botId, s.platform)}</div>
    </div>
    <div class="field">
      <label class="field-label">星灵标签 / Protos Tags<span class="req" id="st-tags-req"${isFallback ? ' hidden' : ''}>*</span></label>
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
    ${isFallback ? '' : `<div id="st-nonfallback-fields">
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
    </div>`}
    ${id ? '' : `<div class="field" id="st-fallback-field"${scopeHasFallback(s.productLineId, s.platform, s.botId) ? ' hidden' : ''}>
      <label class="field-label">是否兜底<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="st-fallback" value="no" checked onchange="onStFallbackChange()"> 否</label>
        <label><input type="radio" name="st-fallback" value="yes" onchange="onStFallbackChange()"> 是</label>
      </div>
    </div>`}
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

function currentSceneScope() {
  return {
    pl: document.getElementById('st-pl')?.value || '',
    bot: document.getElementById('st-bot')?.value || '',
    platform: document.getElementById('st-platform')?.value || ''
  };
}

function sceneTagHtml(list) {
  return sceneDraft.map(id => {
    const s = list.find(x => x.id === id) || sceneById(id);
    return `<span class="msel-tag"><span class="msel-tag-text">${esc(s?.name || id)}</span><button type="button" class="msel-tag-remove" onclick="removeScene(event, '${esc(id)}')">×</button></span>`;
  }).join('');
}

function sceneOptionHtml(list) {
  const q = sceneQuery.trim().toLowerCase();
  const filtered = list.filter(s => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  if (!list.length) return '<div class="msel-empty">当前范围暂无来源</div>';
  if (!filtered.length) return '<div class="msel-empty">无匹配来源</div>';
  return filtered.map(s => `<label class="msel-option" onclick="event.stopPropagation()">
    <input type="checkbox" data-id="${esc(s.id)}" ${sceneDraft.includes(s.id) ? 'checked' : ''} onchange="toggleScene(this.dataset.id)" />
    <span class="msel-option-body">
      <span class="msel-option-label">${esc(s.name)}</span>
      <span class="msel-option-desc">${esc(s.id)}</span>
    </span>
  </label>`).join('');
}

function renderSceneSelect(pl, bot, platform) {
  const list = scenesByScope(pl, bot, platform);
  const tags = sceneTagHtml(list);
  return `<div class="msel${sceneOpen ? ' open' : ''}" id="scene-msel">
    <div class="msel-trigger" tabindex="0" onclick="toggleScenePanel(event)">
      ${tags ? `<span class="msel-tags">${tags}</span>` : '<span class="msel-placeholder">请选择来源</span>'}
      <i data-lucide="chevron-down" class="msel-chevron"></i>
    </div>
    ${sceneOpen ? `<div class="msel-dropdown" id="scene-msel-drop">
      <input class="input msel-search" id="scene-search" placeholder="搜索来源名称或 code" value="${esc(sceneQuery)}" oninput="onSceneSearch(this.value)" onclick="event.stopPropagation()" />
      <div class="msel-list">${sceneOptionHtml(list)}</div>
    </div>` : ''}
  </div>`;
}

function placeSceneDropdown() {
  const trigger = document.querySelector('#scene-msel .msel-trigger');
  const drop = document.getElementById('scene-msel-drop');
  if (!trigger || !drop) return;
  if (drop.parentElement !== document.body) document.body.appendChild(drop);
  const r = trigger.getBoundingClientRect();
  drop.style.position = 'fixed';
  drop.style.top = `${r.bottom + 4}px`;
  drop.style.left = `${r.left}px`;
  drop.style.width = `${r.width}px`;
  drop.style.right = 'auto';
  drop.style.zIndex = '400';
}

function refreshSceneSelect(keepFocus) {
  document.getElementById('scene-msel-drop')?.remove();
  const host = document.getElementById('scene-msel-host');
  if (!host) return;
  const { pl, bot, platform } = currentSceneScope();
  host.innerHTML = renderSceneSelect(pl, bot, platform);
  refreshIcons();
  if (sceneOpen) requestAnimationFrame(() => placeSceneDropdown());
  if (keepFocus) {
    const input = document.getElementById('scene-search');
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }
}

function paintSceneSelection() {
  const trigger = document.querySelector('#scene-msel .msel-trigger');
  if (!trigger) return;
  const { pl, bot, platform } = currentSceneScope();
  const list = scenesByScope(pl, bot, platform);
  const tags = sceneTagHtml(list);
  const tagsEl = trigger.querySelector('.msel-tags');
  const placeholder = trigger.querySelector('.msel-placeholder');
  if (tags) {
    if (tagsEl) tagsEl.innerHTML = tags;
    else {
      placeholder?.remove();
      trigger.insertAdjacentHTML('afterbegin', `<span class="msel-tags">${tags}</span>`);
    }
  } else {
    tagsEl?.remove();
    if (!trigger.querySelector('.msel-placeholder')) {
      trigger.insertAdjacentHTML('afterbegin', '<span class="msel-placeholder">请选择来源</span>');
    }
  }
  document.querySelectorAll('#scene-msel-drop .msel-option input').forEach(input => {
    input.checked = sceneDraft.includes(input.dataset.id);
  });
  requestAnimationFrame(() => placeSceneDropdown());
}

function toggleScenePanel(e) {
  e.stopPropagation();
  sceneOpen = !sceneOpen;
  if (!sceneOpen) sceneQuery = '';
  refreshSceneSelect(sceneOpen);
}

function onSceneSearch(v) {
  sceneQuery = v;
  const { pl, bot, platform } = currentSceneScope();
  const listEl = document.querySelector('#scene-msel-drop .msel-list');
  if (listEl) listEl.innerHTML = sceneOptionHtml(scenesByScope(pl, bot, platform));
}

function toggleScene(id) {
  dirty = true;
  if (sceneDraft.includes(id)) sceneDraft = sceneDraft.filter(x => x !== id);
  else sceneDraft.push(id);
  paintSceneSelection();
  syncSaveBtn();
}

function removeScene(e, id) {
  e.stopPropagation();
  e.preventDefault();
  dirty = true;
  sceneDraft = sceneDraft.filter(x => x !== id);
  paintSceneSelection();
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
  sceneQuery = '';
  refreshSceneSelect(false);
  document.getElementById('st-flow').innerHTML = `<option value="">请选择对话流</option>${publishedMatchFlowOptions(pl, bot, '', platform)}`;
  syncFallbackField();
  syncSaveBtn();
}

function toTs(v) {
  return v ? v.replace('T', ' ') + ':00' : '';
}

function editingFallback() {
  return isFallbackStrategy(editingId ? strategyById(editingId) : null);
}

function readForm() {
  const { protosTagIds, tags } = collectProtosFromRows();
  const fallback = editingFallback() || creatingFallback();
  return {
    name: (document.getElementById('st-name')?.value || '').trim(),
    sceneIds: clone(sceneDraft),
    productLineId: document.getElementById('st-pl')?.value || '',
    platform: document.getElementById('st-platform')?.value || '',
    botId: document.getElementById('st-bot')?.value || '',
    protosTagIds,
    tags,
    flowId: document.getElementById('st-flow')?.value || '',
    priority: fallback ? 999 : Number(document.getElementById('st-priority')?.value || 0),
    effectiveStart: fallback ? '' : toTs(document.getElementById('st-start')?.value || ''),
    effectiveEnd: fallback ? '' : toTs(document.getElementById('st-end')?.value || ''),
    status: fallback ? 'active' : (document.querySelector('input[name="st-status"]:checked')?.value || 'active'),
    remark: (document.getElementById('st-remark')?.value || '').trim()
  };
}

function syncSaveBtn() {
  const d = readForm();
  if (editingFallback() || creatingFallback()) {
    document.getElementById('strategySaveBtn').disabled = !d.flowId || !d.name;
    return;
  }
  document.getElementById('strategySaveBtn').disabled =
    !d.name || !d.flowId || !(d.tags || []).length || !d.productLineId || !d.platform || !d.botId;
}

function saveStrategy() {
  const d = readForm();
  const fallback = editingFallback() || creatingFallback();
  ['err-name', 'err-tags', 'err-priority', 'err-date'].forEach(id => fieldError(id, ''));

  if (!d.name) {
    fieldError('err-name', '请输入策略名称');
    return;
  }
  if (d.name.length > 30) {
    fieldError('err-name', '策略名称最多 30 个字符');
    return;
  }
  if (!fallback) {
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
  }
  const payload = { ...d };
  delete payload.sceneId;
  if (editingId) {
    const target = strategyById(editingId);
    Object.assign(target, payload, { id: editingId, type: target.type });
    if (fallback) {
      target.type = 'fallback';
      target.status = 'active';
      target.priority = 999;
      target.effectiveStart = '';
      target.effectiveEnd = '';
    }
    delete target.sceneId;
  } else {
    const row = { ...payload, id: nextId('strategy'), createdAt: nowTs() };
    if (fallback) {
      row.type = 'fallback';
      row.status = 'active';
      row.priority = 999;
      row.effectiveStart = '';
      row.effectiveEnd = '';
    }
    DB.strategies.push(row);
  }
  saveStore();
  dirty = false;
  sceneOpen = false;
  document.getElementById('scene-msel-drop')?.remove();
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

document.addEventListener('click', e => {
  if (!sceneOpen) return;
  if (e.target.closest('#scene-msel') || e.target.closest('#scene-msel-drop')) return;
  sceneOpen = false;
  sceneQuery = '';
  refreshSceneSelect(false);
});
document.addEventListener('scroll', () => {
  if (sceneOpen) placeSceneDropdown();
}, true);
window.addEventListener('resize', () => {
  if (sceneOpen) placeSceneDropdown();
});

const closeDrawerBase = closeDrawer;
closeDrawer = function (id) {
  if (id === 'strategyDrawer') {
    sceneOpen = false;
    document.getElementById('scene-msel-drop')?.remove();
  }
  closeDrawerBase(id);
};

document.addEventListener('DOMContentLoaded', () => {
  initShell('strategies');
  writeQueryFilters(filters);
  bindDrawerClose({ beforeClose: maybeClose });
  document.getElementById('strategySaveBtn').addEventListener('click', saveStrategy);
  document.getElementById('strategyCancelBtn').addEventListener('click', async () => {
    if (await maybeClose()) {
      sceneOpen = false;
      document.getElementById('scene-msel-drop')?.remove();
      closeDrawer('strategyDrawer');
    }
  });
  render();
});

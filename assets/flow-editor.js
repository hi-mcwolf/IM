/* 对话流编辑器 + 节点/按钮抽屉 */

let draft = null;
let isNew = false;
let dirty = false;
let nodeMode = 'message'; // message | keyboard
let editingNodeId = null;
let btnCtx = null; // { nodeId, cardIndex, btnIndex }

function emptyFlow() {
  return {
    id: '',
    name: '',
    type: 'normal',
    status: 'draft',
    firstScreenNodeId: '',
    mainMenuKeyboardId: '',
    updatedAt: nowTs(),
    nodes: [],
    variants: [{ key: 'default', name: '默认', status: 'active', nodeOverrides: {} }]
  };
}

function emptyMessageNode() {
  return {
    id: '',
    name: '',
    nodeType: 'message',
    pageType: '首页',
    keyboardId: '',
    cards: [emptyCard()]
  };
}

function emptyCard() {
  return { image: '', title: '', subtitle: '', statusLine: '', descLine: '', progress: '', buttons: [] };
}

function emptyKeyboardNode() {
  return {
    id: '',
    name: '',
    nodeType: 'keyboard',
    pageType: '',
    keyboardId: '',
    cards: [],
    buttons: []
  };
}

function emptyButton() {
  return makeBtn('', '', 'open_node', { sort: 1 });
}

function persistDraftToStore() {
  if (isNew) {
    if (flowById(draft.id)) return false;
    DB.flows.push(draft);
    isNew = false;
  } else {
    const idx = DB.flows.findIndex(f => f.id === draft.id);
    if (idx < 0) DB.flows.push(draft);
    else DB.flows[idx] = draft;
  }
  draft.updatedAt = nowTs();
  saveStore();
  return true;
}

function canPublishDraft() {
  const hasFirst = !!draft.firstScreenNodeId && firstScreenCandidates(draft).some(n => n.id === draft.firstScreenNodeId);
  const hasMenu = !!draft.mainMenuKeyboardId && keyboardNodes(draft).some(n => n.id === draft.mainMenuKeyboardId);
  const hasVariant = (draft.variants || []).some(v => v.key === 'default');
  return hasFirst && hasMenu && hasVariant;
}

function renderEditor() {
  const firstOpts = firstScreenCandidates(draft).map(n => optionHtml(n.id, `${n.name} (${n.id})`, draft.firstScreenNodeId)).join('');
  const kbOpts = keyboardNodes(draft).map(n => optionHtml(n.id, `${n.name} (${n.id})`, draft.mainMenuKeyboardId)).join('');
  const idLocked = !isNew && !!draft.id;
  document.getElementById('content').innerHTML = `
    <div class="flow-editor-head">
      <h1>对话流编辑</h1>
      <div class="page-header-actions">
        <button class="btn btn-outline" type="button" onclick="goBack()">返回列表</button>
        <button class="btn btn-outline" type="button" onclick="saveFlow(false)">保存</button>
        <button class="btn btn-primary" type="button" onclick="saveFlow(true)">发布</button>
      </div>
    </div>
    <div class="flow-editor-grid">
      <section class="card">
        <h4 class="card-title">基本信息</h4>
        <div class="field">
          <label class="field-label">对话流 Id<span class="req">*</span></label>
          <input class="input" id="f-id" maxlength="30" ${idLocked ? 'disabled' : ''} placeholder="请输入对话流 Id,小写字母+下划线,创建后不可改" value="${esc(draft.id)}" />
          <div class="field-error" id="err-id"></div>
        </div>
        <div class="field">
          <label class="field-label">对话流名称<span class="req">*</span></label>
          <input class="input" id="f-name" maxlength="30" placeholder="请输入对话流名称" value="${esc(draft.name)}" />
          <div class="field-error" id="err-name"></div>
        </div>
        <div class="field">
          <label class="field-label">类型</label>
          <select class="select" id="f-type" disabled>
            <option>普通</option>
            <option disabled>系统保留</option>
          </select>
          <div class="field-hint">系统保留类型灰显不可选</div>
        </div>
        <div class="field">
          <label class="field-label">状态</label>
          <select class="select" id="f-status">
            ${optionHtml('draft', '草稿', draft.status)}
            ${optionHtml('published', '已发布', draft.status)}
            ${optionHtml('offline', '下线', draft.status)}
          </select>
        </div>
        <div class="field">
          <label class="field-label">首屏节点<span class="req">*</span></label>
          <select class="select" id="f-first">
            <option value="">请选择首屏节点</option>
            ${firstOpts}
          </select>
        </div>
        <div class="field">
          <label class="field-label">主菜单键盘<span class="req">*</span></label>
          <div style="display:flex;gap:8px">
            <select class="select" id="f-menu">
              <option value="">请选择主菜单键盘</option>
              ${kbOpts}
            </select>
            <button class="btn btn-outline" type="button" onclick="editMainMenu()">编辑</button>
          </div>
        </div>
        <div class="field">
          <label class="field-label">变体集<span class="req">*</span></label>
          <div class="variant-chip-list">
            ${(draft.variants || []).map(v => `
              <div class="variant-chip">
                <strong>${esc(v.key)}</strong>
                <span>${esc(v.name)}</span>
                ${v.key === 'default' ? '<span class="tag tag-success">必出</span>' : ''}
                <button class="link-btn" type="button" style="margin-left:auto" onclick="goVariants()">编辑</button>
              </div>`).join('')}
          </div>
          <button class="btn btn-outline btn-sm" type="button" style="margin-top:8px" onclick="goVariants()">
            <i data-lucide="plus"></i>新建变体
          </button>
        </div>
        <button class="btn btn-primary" type="button" onclick="openNodeEdit(null, 'message')">
          <i data-lucide="plus"></i>新建节点
        </button>
      </section>
      <section class="card">
        <h4 class="card-title">节点树预览</h4>
        <div class="node-tree">
          ${draft.nodes.length ? draft.nodes.map(n => `
            <div class="node-tree-item" onclick="openNodeEdit('${esc(n.id)}', '${esc(n.nodeType)}')">
              <i data-lucide="${n.nodeType === 'keyboard' ? 'keyboard' : 'message-square'}"></i>
              <span>${n.id === draft.firstScreenNodeId ? '首屏: ' : ''}${esc(n.name)}</span>
              <span class="muted">${esc(n.id)} · ${n.nodeType === 'keyboard' ? '键盘' : '消息'}</span>
            </div>`).join('') : '<div class="table-empty">暂无节点，请新建</div>'}
        </div>
        <button class="btn btn-outline" type="button" style="margin-top:12px" onclick="openNodeEdit(null, 'keyboard')">
          <i data-lucide="plus"></i>新建键盘节点
        </button>
      </section>
    </div>`;
  ['f-id', 'f-name', 'f-status', 'f-first', 'f-menu'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', pullBasic);
    document.getElementById(id)?.addEventListener('change', pullBasic);
  });
  refreshIcons();
}

function pullBasic() {
  if (!document.getElementById('f-id')) return;
  if (isNew) draft.id = (document.getElementById('f-id').value || '').trim();
  draft.name = (document.getElementById('f-name').value || '').trim();
  draft.status = document.getElementById('f-status').value;
  draft.firstScreenNodeId = document.getElementById('f-first').value;
  draft.mainMenuKeyboardId = document.getElementById('f-menu').value;
  dirty = true;
}

function goVariants() {
  pullBasic();
  if (!draft.id) {
    showToast('请先填写并保存对话流 Id', 'err');
    return;
  }
  if (!persistDraftToStore()) {
    showToast('该对话流 Id 已存在，请先保存', 'err');
    return;
  }
  location.href = `variants.html?flow=${encodeURIComponent(draft.id)}`;
}

async function goBack() {
  if (dirty) {
    const ok = await confirmModal({ title: '确认离开？', message: '有未保存的改动', confirmText: '确认离开', danger: false });
    if (!ok) return;
  }
  location.href = 'flows.html';
}

function saveFlow(publish) {
  pullBasic();
  fieldError('err-id', '');
  fieldError('err-name', '');
  if (!isIdToken(draft.id)) {
    fieldError('err-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-30');
    showToast('请检查对话流 Id', 'err');
    return;
  }
  if (isNew && flowById(draft.id)) {
    fieldError('err-id', '该对话流 Id 已存在');
    return;
  }
  if (!draft.name) {
    fieldError('err-name', '请输入对话流名称');
    return;
  }
  if (publish) {
    if (!canPublishDraft()) {
      showToast('发布前必须配置首屏节点、主菜单键盘、至少 1 个变体', 'err');
      return;
    }
    draft.status = 'published';
  }
  persistDraftToStore();
  dirty = false;
  showToast(publish ? '已发布' : '保存成功');
  history.replaceState(null, '', `flow-editor.html?id=${encodeURIComponent(draft.id)}`);
  renderEditor();
}

function editMainMenu() {
  pullBasic();
  if (draft.mainMenuKeyboardId) openNodeEdit(draft.mainMenuKeyboardId, 'keyboard');
  else openNodeEdit(null, 'keyboard');
}

function isFirstScreenNode(nodeId) {
  return draft.firstScreenNodeId === nodeId;
}

function openNodeEdit(id, type) {
  pullBasic();
  nodeMode = type || 'message';
  editingNodeId = id;
  const existing = id ? nodeById(draft, id) : null;
  const n = existing ? clone(existing) : (nodeMode === 'keyboard' ? emptyKeyboardNode() : emptyMessageNode());
  if (existing) nodeMode = existing.nodeType;
  const locked = !!id;
  const forceOneCard = isFirstScreenNode(n.id) || (!id && nodeMode === 'message' && !draft.firstScreenNodeId);
  document.getElementById('nodeDrawerTitle').textContent = nodeMode === 'keyboard' ? '键盘节点编辑' : '节点编辑';
  document.getElementById('nodeDrawerBody').innerHTML = renderNodeForm(n, locked, forceOneCard);
  document.getElementById('nodeDrawerBody').dataset.forceOne = forceOneCard ? '1' : '0';
  openDrawer('nodeDrawer');
  refreshIcons();
}

function renderNodeForm(n, locked, forceOneCard) {
  if (nodeMode === 'keyboard') {
    return `
      <div class="field">
        <label class="field-label">节点 Id<span class="req">*</span></label>
        <input class="input" id="n-id" maxlength="30" ${locked ? 'disabled' : ''} placeholder="请输入节点 Id" value="${esc(n.id)}" />
        <div class="field-error" id="err-nid"></div>
      </div>
      <div class="field">
        <label class="field-label">节点名称<span class="req">*</span></label>
        <input class="input" id="n-name" maxlength="30" placeholder="请输入节点名称" value="${esc(n.name)}" />
      </div>
      <div class="field">
        <label class="field-label">键盘按钮（≤ 6）</label>
        <div id="kb-btns">${renderBtnList(n.buttons || [], -1)}</div>
        <button class="btn btn-outline btn-sm" type="button" ${(n.buttons || []).length >= 6 ? 'disabled' : ''} onclick="addTempButton(-1)">+ 添加按钮</button>
      </div>
      <input type="hidden" id="n-json" value="${esc(JSON.stringify(n))}" />`;
  }
  const cards = n.cards || [];
  return `
    <div class="field">
      <label class="field-label">节点 Id<span class="req">*</span></label>
      <input class="input" id="n-id" maxlength="30" ${locked ? 'disabled' : ''} placeholder="请输入节点 Id,小写字母+下划线,创建后不可改" value="${esc(n.id)}" />
      <div class="field-error" id="err-nid"></div>
    </div>
    <div class="field">
      <label class="field-label">节点名称<span class="req">*</span></label>
      <input class="input" id="n-name" maxlength="30" placeholder="请输入节点名称" value="${esc(n.name)}" />
    </div>
    <div class="field">
      <label class="field-label">节点类型</label>
      <div class="radio-group">
        <label><input type="radio" checked> 消息节点</label>
        <label style="opacity:.5"><input type="radio" disabled> 动作节点</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">页面类型<span class="req">*</span></label>
      <select class="select" id="n-page">
        ${PAGE_TYPES.map(p => optionHtml(p, p, n.pageType)).join('')}
      </select>
    </div>
    <div class="field">
      <label class="field-label">消息组</label>
      <div id="card-list">
        ${cards.map((c, i) => renderCardEditor(c, i, forceOneCard)).join('')}
      </div>
      ${forceOneCard ? '<div class="field-hint">首屏节点的消息组只能 1 条卡片</div>' : `<button class="btn btn-outline btn-sm" type="button" onclick="addCard()">+ 添加消息卡片</button>`}
    </div>
    <div class="field">
      <label class="field-label">节点键盘</label>
      <select class="select" id="n-kb">
        <option value="">不使用</option>
        ${keyboardNodes(draft).map(k => optionHtml(k.id, `${k.name} (${k.id})`, n.keyboardId)).join('')}
      </select>
    </div>
    <div class="field">
      <button class="btn btn-outline btn-sm" type="button" ${isFirstScreenNode(n.id) ? 'disabled' : ''} onclick="deleteCurrentNode()">删除节点</button>
    </div>
    <input type="hidden" id="n-json" value="${esc(JSON.stringify(n))}" />`;
}

function renderCardEditor(c, i, forceOneCard) {
  const imgOpts = IMAGE_PRESETS.map(p => optionHtml(p.value, p.label, c.image)).join('');
  return `
    <div class="msg-card" data-card="${i}">
      <div class="msg-card-head">
        <span>卡片 ${i + 1}</span>
        ${forceOneCard ? '' : `<button class="link-btn link-btn-danger" type="button" onclick="removeCard(${i})">删除</button>`}
      </div>
      <div class="field">
        <label class="field-label">图片</label>
        <select class="select card-image">${imgOpts}</select>
      </div>
      <div class="field">
        <label class="field-label">标题<span class="req">*</span></label>
        <input class="input card-title" maxlength="40" placeholder="请输入标题" value="${esc(c.title)}" />
      </div>
      <div class="field">
        <label class="field-label">副标</label>
        <input class="input card-subtitle" maxlength="60" placeholder="请输入副标" value="${esc(c.subtitle)}" />
      </div>
      <div class="field">
        <label class="field-label">状态行</label>
        <input class="input card-status" maxlength="40" placeholder="请输入状态行" value="${esc(c.statusLine)}" />
      </div>
      <div class="field">
        <label class="field-label">说明行</label>
        <input class="input card-desc" maxlength="80" placeholder="请输入说明行" value="${esc(c.descLine)}" />
      </div>
      <div class="field">
        <label class="field-label">进度</label>
        <input class="input card-progress" type="number" min="0" max="100" placeholder="0-100" value="${esc(c.progress)}" />
      </div>
      <div class="field">
        <label class="field-label">卡片内按钮</label>
        ${renderBtnList(c.buttons || [], i)}
        <button class="btn btn-outline btn-sm" type="button" ${(c.buttons || []).length >= 2 ? 'disabled' : ''} onclick="addTempButton(${i})">+ 添加按钮</button>
      </div>
    </div>`;
}

function renderBtnList(buttons, cardIndex) {
  if (!buttons.length) return '<div class="cell-muted" style="margin-bottom:8px">暂无按钮</div>';
  return `<div class="btn-list">${buttons.map((b, i) => `
    <div class="btn-row">
      <span class="grow">${esc(b.text || '(未命名)')} · ${esc(eventLabel(b.event))}</span>
      <button class="link-btn" type="button" onclick="openButtonEdit(${cardIndex}, ${i})">编辑</button>
      <button class="link-btn link-btn-danger" type="button" onclick="removeTempButton(${cardIndex}, ${i})">删除</button>
    </div>`).join('')}</div>`;
}

function readNodeWorking() {
  const raw = document.getElementById('n-json');
  return raw ? JSON.parse(raw.value) : emptyMessageNode();
}

function writeNodeWorking(n) {
  document.getElementById('n-json').value = JSON.stringify(n);
}

function collectNodeFields(n) {
  n.id = (document.getElementById('n-id')?.value || n.id).trim();
  n.name = (document.getElementById('n-name')?.value || n.name).trim();
  if (nodeMode === 'message') {
    n.pageType = document.getElementById('n-page')?.value || n.pageType;
    n.keyboardId = document.getElementById('n-kb')?.value || '';
    const cards = [...document.querySelectorAll('#card-list .msg-card')];
    n.cards = cards.map((el, i) => {
      const prev = n.cards[i] || emptyCard();
      return {
        ...prev,
        image: el.querySelector('.card-image')?.value || '',
        title: el.querySelector('.card-title')?.value || '',
        subtitle: el.querySelector('.card-subtitle')?.value || '',
        statusLine: el.querySelector('.card-status')?.value || '',
        descLine: el.querySelector('.card-desc')?.value || '',
        progress: el.querySelector('.card-progress')?.value || ''
      };
    });
  }
  return n;
}

function refreshNodeForm() {
  const n = collectNodeFields(readNodeWorking());
  writeNodeWorking(n);
  const locked = !!editingNodeId;
  const forceOneCard = document.getElementById('nodeDrawerBody').dataset.forceOne === '1';
  document.getElementById('nodeDrawerBody').innerHTML = renderNodeForm(n, locked, forceOneCard);
  document.getElementById('nodeDrawerBody').dataset.forceOne = forceOneCard ? '1' : '0';
  refreshIcons();
}

function addCard() {
  const n = collectNodeFields(readNodeWorking());
  n.cards.push(emptyCard());
  writeNodeWorking(n);
  refreshNodeForm();
}

function removeCard(i) {
  const n = collectNodeFields(readNodeWorking());
  if ((n.cards || []).length <= 1) {
    showToast('至少保留一张卡片', 'err');
    return;
  }
  n.cards.splice(i, 1);
  writeNodeWorking(n);
  refreshNodeForm();
}

function addTempButton(cardIndex) {
  const n = collectNodeFields(readNodeWorking());
  if (cardIndex < 0) {
    n.buttons = n.buttons || [];
    if (n.buttons.length >= 6) return;
    const b = emptyButton();
    b.id = nextId('btn');
    b.sort = n.buttons.length + 1;
    n.buttons.push(b);
  } else {
    const card = n.cards[cardIndex];
    card.buttons = card.buttons || [];
    if (card.buttons.length >= 2) return;
    const b = emptyButton();
    b.id = nextId('btn');
    b.sort = card.buttons.length + 1;
    card.buttons.push(b);
  }
  writeNodeWorking(n);
  refreshNodeForm();
}

function removeTempButton(cardIndex, btnIndex) {
  const n = collectNodeFields(readNodeWorking());
  if (cardIndex < 0) n.buttons.splice(btnIndex, 1);
  else n.cards[cardIndex].buttons.splice(btnIndex, 1);
  writeNodeWorking(n);
  refreshNodeForm();
}

function openButtonEdit(cardIndex, btnIndex) {
  const n = collectNodeFields(readNodeWorking());
  writeNodeWorking(n);
  const btn = cardIndex < 0 ? n.buttons[btnIndex] : n.cards[cardIndex].buttons[btnIndex];
  btnCtx = { cardIndex, btnIndex };
  renderButtonForm(btn);
  openDrawer('buttonDrawer');
}

function renderButtonForm(b) {
  const eventOpts = BUTTON_EVENTS.map(e => optionHtml(e.value, e.label, b.event)).join('');
  const nodeOpts = messageNodes(draft).concat(keyboardNodes(draft)).map(n => optionHtml(n.id, `${n.name} (${n.id})`, b.paramNodeId)).join('');
  const flowOpts = publishedFlows().map(f => optionHtml(f.id, `${f.name} (${f.id})`, b.paramFlowId)).join('');
  const flow = flowById(b.paramFlowId);
  const varOpts = (flow?.variants || []).map(v => optionHtml(v.key, v.key, b.paramVariantKey)).join('');
  const ov = (b.variantOverrides || []).map((o, i) => `
    <div class="override-row">
      <select class="select ov-key">${(draft.variants || []).map(v => optionHtml(v.key, v.key, o.variantKey)).join('')}</select>
      <input class="input ov-text" maxlength="25" placeholder="请输入覆盖文案" value="${esc(o.text || '')}" />
      <button class="icon-btn" type="button" onclick="removeOverride(${i})"><i data-lucide="x"></i></button>
    </div>`).join('');
  document.getElementById('buttonDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">按钮文案<span class="req">*</span></label>
      <input class="input" id="b-text" maxlength="25" placeholder="请输入按钮文案" value="${esc(b.text)}" />
    </div>
    <div class="field">
      <label class="field-label">事件<span class="req">*</span></label>
      <select class="select" id="b-event" onchange="onEventChange()">${eventOpts}</select>
    </div>
    <div class="field event-params" id="b-params"></div>
    <div class="field">
      <label class="field-label">样式</label>
      <div class="radio-group">
        <label><input type="radio" name="b-style" value="primary"${b.style !== 'secondary' ? ' checked' : ''}> 主</label>
        <label><input type="radio" name="b-style" value="secondary"${b.style === 'secondary' ? ' checked' : ''}> 次</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">排序<span class="req">*</span></label>
      <input class="input" id="b-sort" type="number" min="1" max="9999" value="${esc(b.sort || 1)}" />
      <div class="field-error" id="err-bsort"></div>
    </div>
    <div class="field">
      <label class="field-label">变体覆盖</label>
      <div id="ov-list">${ov || '<div class="cell-muted">未配置</div>'}</div>
      <button class="btn btn-outline btn-sm" type="button" style="margin-top:8px" onclick="addOverride()">+ 添加变体覆盖</button>
    </div>`;
  window._btnExtra = { nodeOpts, flowOpts, varOpts, paramNodeId: b.paramNodeId, paramFlowId: b.paramFlowId, paramVariantKey: b.paramVariantKey, paramBpUrl: b.paramBpUrl };
  onEventChange();
  refreshIcons();
}

function onEventChange() {
  const ev = document.getElementById('b-event').value;
  const x = window._btnExtra || {};
  let html = '';
  if (ev === 'open_node') {
    html = `<label class="field-label">目标节点<span class="req">*</span></label>
      <select class="select" id="b-node"><option value="">请选择目标节点</option>${x.nodeOpts}</select>`;
  } else if (ev === 'open_flow') {
    html = `<label class="field-label">目标对话流<span class="req">*</span></label>
      <select class="select" id="b-flow" onchange="onBtnFlowChange()"><option value="">请选择目标对话流</option>${x.flowOpts}</select>
      <label class="field-label" style="margin-top:12px">目标变体</label>
      <select class="select" id="b-var"><option value="">沿用当前变体</option>${x.varOpts}</select>`;
  } else if (ev === 'open_bp') {
    html = `<label class="field-label">BP URL<span class="req">*</span></label>
      <input class="input" id="b-url" placeholder="请输入 BP URL,支持 {memberId} 占位" value="${esc(x.paramBpUrl || '')}" />
      <div class="field-error" id="err-url"></div>`;
  } else {
    html = `<div class="cell-muted">该事件无需参数</div>`;
  }
  document.getElementById('b-params').innerHTML = html;
}

function onBtnFlowChange() {
  const fid = document.getElementById('b-flow').value;
  const flow = flowById(fid);
  const sel = document.getElementById('b-var');
  if (sel) sel.innerHTML = `<option value="">沿用当前变体</option>${(flow?.variants || []).map(v => optionHtml(v.key, v.key, '')).join('')}`;
}

function addOverride() {
  const n = collectNodeFields(readNodeWorking());
  const btn = btnCtx.cardIndex < 0 ? n.buttons[btnCtx.btnIndex] : n.cards[btnCtx.cardIndex].buttons[btnCtx.btnIndex];
  Object.assign(btn, collectButtonFields(btn));
  btn.variantOverrides = btn.variantOverrides || [];
  btn.variantOverrides.push({ variantKey: draft.variants.find(v => v.key !== 'default')?.key || 'vip', text: '' });
  writeNodeWorking(n);
  renderButtonForm(btn);
}

function removeOverride(i) {
  const n = collectNodeFields(readNodeWorking());
  const btn = btnCtx.cardIndex < 0 ? n.buttons[btnCtx.btnIndex] : n.cards[btnCtx.cardIndex].buttons[btnCtx.btnIndex];
  Object.assign(btn, collectButtonFields(btn));
  btn.variantOverrides.splice(i, 1);
  writeNodeWorking(n);
  renderButtonForm(btn);
}

function collectButtonFields(prev = {}) {
  const ev = document.getElementById('b-event')?.value || prev.event;
  const overlays = [...document.querySelectorAll('#ov-list .override-row')].map(row => ({
    variantKey: row.querySelector('.ov-key')?.value || '',
    text: row.querySelector('.ov-text')?.value || ''
  }));
  return {
    text: (document.getElementById('b-text')?.value || '').trim(),
    event: ev,
    paramNodeId: document.getElementById('b-node')?.value || '',
    paramFlowId: document.getElementById('b-flow')?.value || '',
    paramVariantKey: document.getElementById('b-var')?.value || '',
    paramBpUrl: (document.getElementById('b-url')?.value || '').trim(),
    style: document.querySelector('input[name="b-style"]:checked')?.value || 'primary',
    sort: Number(document.getElementById('b-sort')?.value || 1),
    variantOverrides: overlays
  };
}

function saveButton() {
  const fields = collectButtonFields();
  if (!fields.text) {
    showToast('请输入按钮文案', 'err');
    return;
  }
  if (fields.event === 'open_node' && !fields.paramNodeId) {
    showToast('请选择目标节点', 'err');
    return;
  }
  if (fields.event === 'open_flow' && !fields.paramFlowId) {
    showToast('请选择目标对话流', 'err');
    return;
  }
  if (fields.event === 'open_bp') {
    if (!fields.paramBpUrl.startsWith('https://')) {
      fieldError('err-url', '须以 https:// 开头');
      return;
    }
  }
  const n = collectNodeFields(readNodeWorking());
  const list = btnCtx.cardIndex < 0 ? n.buttons : n.cards[btnCtx.cardIndex].buttons;
  const dup = list.some((b, i) => i !== btnCtx.btnIndex && Number(b.sort) === fields.sort);
  if (dup) {
    fieldError('err-bsort', '同组排序须唯一');
    return;
  }
  Object.assign(list[btnCtx.btnIndex], fields);
  if (!list[btnCtx.btnIndex].id) list[btnCtx.btnIndex].id = nextId('btn');
  writeNodeWorking(n);
  closeDrawer('buttonDrawer');
  refreshNodeForm();
  showToast('按钮已保存');
}

function saveNode() {
  const n = collectNodeFields(readNodeWorking());
  fieldError('err-nid', '');
  if (!isIdToken(n.id)) {
    fieldError('err-nid', '必须以字母开头，同对话流内不能重复');
    return;
  }
  const dup = draft.nodes.some(x => x.id === n.id && x.id !== editingNodeId);
  if (dup) {
    fieldError('err-nid', '该节点 Id 已存在');
    return;
  }
  if (!n.name) {
    showToast('请输入节点名称', 'err');
    return;
  }
  if (nodeMode === 'message') {
    if (!(n.cards || []).length || n.cards.some(c => !c.title)) {
      showToast('每张卡片须填写标题', 'err');
      return;
    }
    n.cards.forEach(c => {
      if (c.progress !== '' && c.progress != null) {
        const p = Number(c.progress);
        if (Number.isNaN(p) || p < 0 || p > 100) {
          showToast('进度须为 0-100', 'err');
        }
      }
    });
  }
  if (editingNodeId) {
    const idx = draft.nodes.findIndex(x => x.id === editingNodeId);
    draft.nodes[idx] = n;
  } else {
    draft.nodes.push(n);
  }
  if (nodeMode === 'keyboard' && !draft.mainMenuKeyboardId) draft.mainMenuKeyboardId = n.id;
  if (nodeMode === 'message' && !draft.firstScreenNodeId) draft.firstScreenNodeId = n.id;
  dirty = true;
  closeDrawer('nodeDrawer');
  showToast('保存成功');
  renderEditor();
}

async function deleteCurrentNode() {
  if (!editingNodeId) return;
  if (isFirstScreenNode(editingNodeId)) {
    showToast('首屏节点不可删', 'err');
    return;
  }
  const ok = await confirmModal({ title: '确认删除该节点？', confirmText: '确认删除' });
  if (!ok) return;
  draft.nodes = draft.nodes.filter(n => n.id !== editingNodeId);
  if (draft.mainMenuKeyboardId === editingNodeId) draft.mainMenuKeyboardId = '';
  dirty = true;
  closeDrawer('nodeDrawer');
  renderEditor();
  showToast('已删除');
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('flow-editor');
  const id = qs('id');
  if (id) {
    const f = flowById(id);
    if (!f || f.type === 'system') {
      showToast('未找到可编辑的对话流', 'err');
      draft = emptyFlow();
      isNew = true;
    } else {
      draft = clone(f);
      isNew = false;
    }
  } else {
    draft = emptyFlow();
    isNew = true;
  }
  bindDrawerClose();
  document.getElementById('nodeSaveBtn').addEventListener('click', saveNode);
  document.getElementById('nodeCancelBtn').addEventListener('click', () => closeDrawer('nodeDrawer'));
  document.getElementById('buttonSaveBtn').addEventListener('click', saveButton);
  document.getElementById('buttonCancelBtn').addEventListener('click', () => closeDrawer('buttonDrawer'));
  renderEditor();
});

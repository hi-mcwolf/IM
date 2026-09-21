/* 对话流编辑器：默认主菜单 + 多页面 + 自动跳转关系 */

let draft = null;
let isNew = false;
let dirty = false;
let pageDraft = null;
let pageIsNew = false;
let pageDirty = false;
let menuDraft = null;
let menuIsNew = false;
let menuDirty = false;
let btnCtx = null;
let btnDraft = null;
let btnDirty = false;
let previewPageId = '';

function emptyFlow(pl, bot, type, platform) {
  const plat = platform || defaultPlatform();
  const menus = menusByScope(pl, bot, plat);
  const t = type === 'fallback' ? 'fallback' : 'normal';
  return {
    id: '',
    name: t === 'normal' ? '' : fixedFlowLabel(t),
    productLineId: pl || defaultProductLine(),
    platform: plat,
    botId: bot || defaultBot(pl, plat),
    type: t,
    status: 'draft',
    purpose: t === 'fallback' ? '所有策略都没匹配上时显示' : '',
    mainMenuId: menus[0]?.id || '',
    firstPageId: '',
    remark: t === 'fallback' ? '用于所有策略都没匹配上' : '',
    updatedAt: nowTs(),
    pages: []
  };
}

function emptyPage(order) {
  return makePage('', '', '首页', { order: order || 0, status: 'active' });
}

function emptyMenu(pl, bot, platform) {
  return {
    id: '',
    name: '',
    productLineId: pl,
    platform: platform || draft?.platform || defaultPlatform(),
    botId: bot,
    status: 'active',
    buttons: []
  };
}

function emptyButton(style = 'primary', sort = 1) {
  return makeBtn('', '', 'Page', { style, sort });
}

function sortedPages(flow) {
  return [...(flow?.pages || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));
}

function persistDraftToStore() {
  draft.updatedAt = nowTs();
  if (isNew) {
    if (flowById(draft.id)) return false;
    DB.flows.push(clone(draft));
    isNew = false;
  } else {
    const idx = DB.flows.findIndex(f => f.id === draft.id);
    if (idx < 0) DB.flows.push(clone(draft));
    else DB.flows[idx] = clone(draft);
  }
  saveStore();
  return true;
}

function canPublishDraft() {
  const pages = sortedPages(draft);
  const hasPage = pages.length >= 1;
  const menu = menuById(draft.mainMenuId);
  const hasMenuBtn = (menu?.buttons || []).length >= 1;
  const hasFirst = !!draft.firstPageId && pages.some(p => p.id === draft.firstPageId);
  return hasPage && hasMenuBtn && hasFirst;
}

function jumpTargetLabel(btn) {
  if (btn.event === 'Page') {
    const p = pageById(draft, btn.pageId);
    return p ? p.name : (btn.pageId || '页面');
  }
  if (btn.event === 'Url') return 'URL';
  if (btn.event === 'Flow') {
    const f = flowById(btn.flowId);
    return f ? f.name : (btn.flowId || '对话流');
  }
  if (btn.event === 'Event') return builtinEventLabel(btn.eventType) || '事件';
  if (btn.event === 'Home') return '回主菜单';
  return eventLabel(btn.event);
}

function collectJumps() {
  const jumps = [];
  sortedPages(draft).forEach(p => {
    (p.cardButtons || []).slice().sort((a, b) => a.sort - b.sort).forEach((b, i) => {
      jumps.push(`${p.name || p.id} → ${jumpTargetLabel(b)}（卡片按钮${i + 1}）`);
    });
    const menu = menuById(p.mainMenuOverrideId || draft.mainMenuId);
    (menu?.buttons || []).slice().sort((a, b) => a.sort - b.sort).forEach((b, i) => {
      jumps.push(`${p.name || p.id} → ${jumpTargetLabel(b)}（菜单按钮${i + 1}）`);
    });
  });
  return jumps;
}

function pageMeta(p) {
  const n = (p.cardButtons || []).length;
  const menu = menuById(p.mainMenuOverrideId || draft.mainMenuId);
  const parts = [n ? `${n} 个卡片按钮` : '无卡片按钮'];
  if (p.image) parts.push('含图');
  if (p.mainMenuOverrideId) parts.push(`覆盖菜单：${menu ? menu.name : p.mainMenuOverrideId}`);
  return parts.join(' · ');
}

function botDisplayName() {
  return DB.bots.find(b => b.id === draft.botId)?.botName || 'Bot';
}

function interpolatePreview(text) {
  return String(text || '')
    .replace(/\{nickname\}/g, 'Marvin')
    .replace(/\{memberId\}/g, '10001');
}

function imagePresetLabel(url) {
  return IMAGE_PRESETS.find(i => i.value === url)?.label || '图片';
}

function ensurePreviewPage() {
  const pages = sortedPages(draft);
  if (!pages.some(p => p.id === previewPageId)) {
    previewPageId = draft.firstPageId || pages[0]?.id || '';
  }
}

function resolvePreviewMenu(page) {
  if (menuDraft && document.getElementById('menuDrawer')?.classList.contains('open')) return menuDraft;
  return menuById(page?.mainMenuOverrideId || draft.mainMenuId);
}

function viberPreviewHtml(page, menu) {
  const botName = botDisplayName();
  const kb = menu || resolvePreviewMenu(page);
  const kbBtns = (kb?.buttons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const primary = kbBtns.filter(b => (b.style || 'primary') === 'primary');
  const secondary = kbBtns.filter(b => b.style === 'secondary');
  const cards = (page?.cardButtons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const text = interpolatePreview(page?.text || '');
  const imgLabel = page?.image ? imagePresetLabel(page.image) : '';
  const pageName = page?.name || page?.id || '未命名页面';

  const kbHtml = [...primary, ...secondary].length
    ? `<div class="viber-keyboard">
        ${primary.length ? `<div class="viber-kb-row${primary.length === 1 ? ' single' : ''}">${primary.map(b => viberKbBtn(b, true)).join('')}</div>` : ''}
        ${chunkButtons(secondary, 2).map(row => `<div class="viber-kb-row${row.length === 1 ? ' single' : ''}">${row.map(b => viberKbBtn(b, false)).join('')}</div>`).join('')}
      </div>`
    : '';

  return `
    <div class="viber-chat">
      <div class="viber-chat-head">
        <span class="avatar">${esc((botName || 'B').slice(0, 1).toUpperCase())}</span>
        <div class="meta">
          <div class="name">${esc(botName)}</div>
          <div class="sub">${esc(page ? pageName : '未选择页面')}</div>
        </div>
      </div>
      <div class="viber-chat-body">
        ${page ? `
          <div class="viber-msg">
            <div class="viber-bubble">
              ${page.image ? `<div class="viber-img"><img src="${esc(page.image)}" alt="" onerror="this.style.display='none'"><span>${esc(imgLabel)}</span></div>` : ''}
              <div class="viber-text${text ? '' : ' empty'}">${esc(text || '（暂无文本）')}</div>
              ${cards.length ? `<div class="viber-card-btns">${cards.map(b => viberCardBtn(b)).join('')}</div>` : ''}
            </div>
          </div>` : '<div class="viber-empty">选择或添加页面后在此预览 Viber 效果</div>'}
      </div>
      ${kbHtml}
    </div>`;
}

function viberCardBtn(b) {
  const jump = b.event === 'Page' && b.pageId ? `onclick="previewGoPage('${esc(b.pageId)}')"` : '';
  return `<button class="viber-card-btn" type="button" ${jump}>${esc(b.text || '按钮')}</button>`;
}

function viberKbBtn(b, primary) {
  const jump = b.event === 'Page' && b.pageId ? `onclick="previewGoPage('${esc(b.pageId)}')"` : '';
  return `<button class="viber-kb-btn${primary ? ' primary' : ''}" type="button" ${jump}>${esc(b.text || '按钮')}</button>`;
}

function chunkButtons(list, size) {
  const rows = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

function previewGoPage(pageId) {
  if (!pageById(draft, pageId)) return;
  previewPageId = pageId;
  refreshMainPreview();
  document.querySelectorAll('.page-list-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.pageId === pageId);
  });
}

function selectPreviewPage(id) {
  previewPageId = id;
  refreshMainPreview();
  document.querySelectorAll('.page-list-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.pageId === id);
  });
}

function refreshMainPreview() {
  const host = document.getElementById('flow-preview-host');
  if (!host) return;
  ensurePreviewPage();
  host.innerHTML = viberPreviewHtml(pageById(draft, previewPageId));
}

function refreshPagePreview() {
  if (pageDraft) syncPageForm();
  const host = document.getElementById('page-preview-host');
  if (host) host.innerHTML = viberPreviewHtml(pageDraft);
}

function refreshMenuPreview() {
  if (menuDraft) syncMenuForm();
  const host = document.getElementById('menu-preview-host');
  if (!host) return;
  const page = pageById(draft, previewPageId) || sortedPages(draft)[0] || emptyPage(0);
  host.innerHTML = viberPreviewHtml(page, menuDraft);
}

function syncHeaderFields() {
  if (!draft) return;
  if (isNew) draft.id = (document.getElementById('f-id')?.value || '').trim();
  draft.name = (document.getElementById('f-name')?.value || '').trim();
  draft.platform = document.getElementById('f-platform')?.value || draft.platform || defaultPlatform();
  draft.botId = document.getElementById('f-bot')?.value || draft.botId;
  draft.mainMenuId = document.getElementById('f-menu')?.value || '';
  draft.firstPageId = document.getElementById('f-first')?.value || '';
  draft.remark = (document.getElementById('f-remark')?.value || '').trim();
}

function onEditorBotChange() {
  dirty = true;
  draft.botId = document.getElementById('f-bot').value;
  const menus = menusByScope(draft.productLineId, draft.botId, draft.platform);
  if (!menus.some(m => m.id === draft.mainMenuId)) draft.mainMenuId = menus[0]?.id || '';
  renderEditor();
}

function onEditorPlatformChange() {
  dirty = true;
  draft.platform = document.getElementById('f-platform').value;
  draft.botId = defaultBot(draft.productLineId, draft.platform);
  const menus = menusByScope(draft.productLineId, draft.botId, draft.platform);
  draft.mainMenuId = menus[0]?.id || '';
  renderEditor();
}

function renderEditor() {
  const idLocked = !isNew && !!draft.id;
  const pages = sortedPages(draft);
  const jumps = collectJumps();
  const firstOpts = pages.map(p => optionHtml(p.id, `${p.name} (${p.id})`, draft.firstPageId)).join('');
  ensurePreviewPage();
  document.getElementById('content').innerHTML = `
    <div class="flow-editor-head">
      <div>
        <h1>${isFixedFlow(draft) ? fixedPinHtml() : ''}对话流编辑${draft.name ? ` · ${esc(draft.name)}` : ''}</h1>
        <p class="page-desc" style="margin:4px 0 0">${statusTag(draft.status)} ${statusTag(draft.type)}${isFixedFlow(draft) ? ' · 所有策略都没匹配上时显示' : ''}</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-outline" type="button" onclick="goBack()">返回列表</button>
        <button class="btn btn-outline" type="button" onclick="saveFlow(false)">保存</button>
        <button class="btn btn-primary" type="button" onclick="saveFlow(true)">启用</button>
      </div>
    </div>
    <div class="flow-editor-grid">
      <aside class="viber-preview-col">
        <div class="viber-preview-caption">Viber 预览</div>
        <div id="flow-preview-host">${viberPreviewHtml(pageById(draft, previewPageId))}</div>
      </aside>
      <div class="flow-editor-main">
    <section class="card">
      <h4 class="card-title">基本信息</h4>
      <div class="field">
        <label class="field-label">平台<span class="req">*</span></label>
        <select class="select" id="f-platform" ${isFixedFlow(draft) ? 'disabled' : ''} onchange="onEditorPlatformChange()">${platformOptions(draft.platform || defaultPlatform())}</select>
      </div>
      <div class="field">
        <label class="field-label">Bot<span class="req">*</span></label>
        <select class="select" id="f-bot" ${isFixedFlow(draft) ? 'disabled' : ''} onchange="onEditorBotChange()">${botOptions(draft.productLineId, draft.botId, draft.platform)}</select>
      </div>
      <div class="field">
        <label class="field-label">对话流 ID<span class="req">*</span></label>
        <input class="input" id="f-id" maxlength="50" ${idLocked ? 'disabled' : ''} placeholder="请输入对话流 ID" value="${esc(draft.id)}" />
        <div class="field-error" id="err-id"></div>
      </div>
      <div class="field">
        <label class="field-label">对话流名称<span class="req">*</span></label>
        <input class="input" id="f-name" maxlength="30" placeholder="请输入对话流名称" value="${esc(draft.name)}" />
      </div>
      <div class="field">
        <label class="field-label">首屏页面<span class="req">*</span></label>
        <select class="select" id="f-first">
          <option value="">请选择首屏页面</option>
          ${firstOpts}
        </select>
        <div class="field-hint">启用前须指定首屏；默认可取第一页</div>
      </div>
      <div class="field">
        <label class="field-label">备注</label>
        <textarea class="textarea" id="f-remark" maxlength="500" placeholder="请输入备注">${esc(draft.remark || '')}</textarea>
      </div>
    </section>
    <section class="card">
      <div class="section-toolbar">
        <h4 class="card-title" style="margin:0">默认主菜单</h4>
      </div>
      <div class="menu-toolbar">
        <select class="select" id="f-menu">
          <option value="">请选择默认主菜单</option>
          ${menuOptions(draft.productLineId, draft.botId, draft.mainMenuId, draft.platform)}
        </select>
        <button class="btn btn-outline" type="button" onclick="openMenuEdit(null)">新建菜单</button>
        <button class="btn btn-outline" type="button" onclick="editCurrentMenu()">编辑当前菜单</button>
      </div>
    </section>
    <section class="card">
      <div class="section-toolbar">
        <h4 class="card-title" style="margin:0">页面列表</h4>
        <button class="btn btn-primary" type="button" onclick="openPageEdit(null)">
          <i data-lucide="plus"></i>添加页面
        </button>
      </div>
      <div class="page-list">
        ${pages.length ? pages.map((p, idx) => `
          <div class="page-list-item${p.id === previewPageId ? ' selected' : ''}" data-page-id="${esc(p.id)}" onclick="selectPreviewPage('${esc(p.id)}')">
            <div class="grow">
              <div class="title">${p.id === draft.firstPageId ? '<span class="tag tag-primary">首屏</span> ' : ''}${esc(p.name || p.id)} <span class="tag tag-gray">${esc(p.id)}</span></div>
              <div class="meta">${esc(pageMeta(p))}</div>
            </div>
            <div class="page-list-ops" onclick="event.stopPropagation()">
              <button class="link-btn" type="button" ${idx <= 0 ? 'disabled' : ''} onclick="movePage('${esc(p.id)}',-1)">上移</button>
              <button class="link-btn" type="button" ${idx >= pages.length - 1 ? 'disabled' : ''} onclick="movePage('${esc(p.id)}',1)">下移</button>
              <button class="link-btn" type="button" onclick="openPageEdit('${esc(p.id)}')">编辑</button>
              <button class="link-btn" type="button" onclick="copyPage('${esc(p.id)}')">复制</button>
              <button class="link-btn link-btn-danger" type="button" ${pages.length <= 1 ? 'disabled' : ''} onclick="deletePage('${esc(p.id)}')">删除</button>
            </div>
          </div>`).join('') : '<div class="table-empty">暂无页面，请添加</div>'}
      </div>
    </section>
    <section class="card">
      <h4 class="card-title">页面跳转关系（自动生成）</h4>
      ${jumps.length ? `<ul class="jump-list">${jumps.map(j => `<li>${esc(j)}</li>`).join('')}</ul>` : '<div class="table-empty">配置页面按钮或主菜单后自动生成</div>'}
    </section>
      </div>
    </div>`;
  bindEditorDirty();
  refreshIcons();
}

function bindEditorDirty() {
  const root = document.getElementById('content');
  if (!root) return;
  root.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => { dirty = true; });
    el.addEventListener('change', () => { dirty = true; syncHeaderFields(); refreshMainPreview(); });
  });
}

function saveFlow(publish) {
  syncHeaderFields();
  fieldError('err-id', '');
  if (!draft.id || !isIdToken(draft.id)) {
    fieldError('err-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-50');
    showToast('请填写合法的对话流 ID', 'err');
    return;
  }
  if (!draft.name) {
    showToast('请填写对话流名称', 'err');
    return;
  }
  if (!draft.botId) {
    showToast('请选择 Bot', 'err');
    return;
  }
  if (isFixedFlow(draft)) {
    const dup = findFixedFlow(draft.productLineId, draft.botId, draft.type, draft.platform);
    if (dup && dup.id !== draft.id) {
      showToast(`当前 Bot 已有${fixedFlowLabel(draft.type)}`, 'err');
      return;
    }
  }
  if (isNew && flowById(draft.id)) {
    fieldError('err-id', '该对话流 ID 已存在');
    return;
  }
  if (publish) {
    if (!draft.firstPageId && sortedPages(draft)[0]) draft.firstPageId = sortedPages(draft)[0].id;
    if (!canPublishDraft()) {
      showToast('启用前需至少 1 个页面、1 个主菜单按钮，并指定首屏', 'err');
      return;
    }
    draft.status = 'published';
  }
  if (!persistDraftToStore()) {
    fieldError('err-id', '该对话流 ID 已存在');
    return;
  }
  dirty = false;
  if (isNew) isNew = false;
  showToast(publish ? '已启用' : '保存成功');
  if (publish) location.href = 'flows.html';
  else {
    history.replaceState(null, '', `flow-editor.html?id=${encodeURIComponent(draft.id)}`);
    renderEditor();
  }
}

async function goBack() {
  syncHeaderFields();
  if (dirty) {
    const ok = await confirmModal({ title: '确认离开？', message: '有未保存的改动', confirmText: '确认离开', danger: false });
    if (!ok) return;
  }
  location.href = 'flows.html';
}

function movePage(id, dir) {
  const pages = sortedPages(draft);
  const idx = pages.findIndex(p => p.id === id);
  const swap = pages[idx + dir];
  if (!swap) return;
  const tmp = pages[idx].order;
  pages[idx].order = swap.order;
  swap.order = tmp;
  dirty = true;
  renderEditor();
}

function copyPage(id) {
  const src = pageById(draft, id);
  if (!src) return;
  const copy = clone(src);
  let newId = `${src.id}_copy`;
  let n = 2;
  while (pageById(draft, newId)) {
    newId = `${src.id}_copy${n}`;
    n += 1;
  }
  copy.id = newId;
  copy.name = `${src.name} 副本`;
  copy.order = Math.max(0, ...sortedPages(draft).map(p => p.order || 0)) + 1;
  copy.cardButtons = (copy.cardButtons || []).map((b, i) => ({ ...b, id: nextId('cb') || `cb_${Date.now()}_${i}` }));
  draft.pages.push(copy);
  dirty = true;
  renderEditor();
  showToast('已复制页面');
}

async function deletePage(id) {
  if (sortedPages(draft).length <= 1) {
    showToast('至少保留 1 个页面', 'err');
    return;
  }
  const p = pageById(draft, id);
  const ok = await confirmModal({ title: `确认删除页面 ${p?.name || id}？`, confirmText: '确认删除' });
  if (!ok) return;
  draft.pages = draft.pages.filter(x => x.id !== id);
  if (draft.firstPageId === id) draft.firstPageId = sortedPages(draft)[0]?.id || '';
  dirty = true;
  renderEditor();
}

function openPageEdit(id) {
  syncHeaderFields();
  pageIsNew = !id;
  pageDirty = false;
  pageDraft = id ? clone(pageById(draft, id)) : emptyPage(Math.max(-1, ...sortedPages(draft).map(p => p.order || 0)) + 1);
  if (id) previewPageId = id;
  document.getElementById('pageDrawerTitle').textContent = id ? '编辑页面' : '添加页面';
  renderPageDrawer();
  openDrawer('pageDrawer');
}

function renderPageDrawer() {
  const p = pageDraft;
  const locked = !pageIsNew && !!p.id;
  const body = document.getElementById('pageDrawerBody');
  body.className = 'drawer-body drawer-body--split';
  body.innerHTML = `
    <div class="detail-preview viber-preview-pane">
      <div class="viber-preview-caption">Viber 预览</div>
      <div id="page-preview-host">${viberPreviewHtml(p)}</div>
    </div>
    <div class="detail-main" id="page-form-host">
    <div class="field">
      <label class="field-label">Bot</label>
      <input class="input" disabled value="${esc(DB.bots.find(b => b.id === draft.botId)?.botName || draft.botId || '-')}" />
    </div>
    <div class="field">
      <label class="field-label">页面 ID<span class="req">*</span></label>
      <input class="input" id="pg-id" maxlength="50" ${locked ? 'disabled' : ''} placeholder="请输入页面 ID" value="${esc(p.id)}" />
      <div class="field-error" id="err-pg-id"></div>
    </div>
    <div class="field">
      <label class="field-label">页面名称<span class="req">*</span></label>
      <input class="input" id="pg-name" maxlength="30" placeholder="请输入页面名称" value="${esc(p.name)}" />
    </div>
    <div class="field">
      <label class="field-label">对话流</label>
      <input class="input" disabled value="${esc(draft.name || draft.id || '当前对话流')}" />
    </div>
    <div class="field">
      <label class="field-label">图片</label>
      <select class="select" id="pg-image">
        ${IMAGE_PRESETS.map(img => optionHtml(img.value, img.label, p.image)).join('')}
      </select>
      <div class="field-hint">原型使用预设图，实际上传 JPEG/PNG ≤500KB</div>
    </div>
    <div class="field">
      <label class="field-label">文本</label>
      <textarea class="textarea" id="pg-text" maxlength="2000" placeholder="请输入页面文本内容，支持 {nickname} 等占位符">${esc(p.text || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label">卡片按钮（≤2）</label>
      <div class="btn-list" id="pg-cards">${renderCardRows()}</div>
      <button class="btn btn-outline" type="button" ${(p.cardButtons || []).length >= 2 ? 'disabled' : ''} onclick="addCardButton()">添加卡片按钮</button>
    </div>
    <div class="field">
      <label class="field-label">主菜单覆盖</label>
      <select class="select" id="pg-menu">
        <option value="">使用对话流默认主菜单</option>
        ${menuOptions(draft.productLineId, draft.botId, p.mainMenuOverrideId, draft.platform)}
      </select>
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="pg-status" value="active"${p.status !== 'disabled' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="pg-status" value="disabled"${p.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>
    </div>`;
  const form = document.getElementById('page-form-host');
  if (form) {
    form.oninput = () => { pageDirty = true; refreshPagePreview(); };
    form.onchange = () => { pageDirty = true; refreshPagePreview(); };
  }
  refreshIcons();
}

function renderCardRows() {
  const list = (pageDraft.cardButtons || []).slice().sort((a, b) => a.sort - b.sort);
  if (!list.length) return '<div class="table-empty" style="padding:12px">暂无卡片按钮</div>';
  return list.map((b, i) => `
    <div class="btn-row">
      <div class="grow">${esc(b.text || '未命名')} · ${esc(eventLabel(b.event))}${b.event === 'Event' ? ' / ' + esc(builtinEventLabel(b.eventType)) : ''}</div>
      <button class="link-btn" type="button" onclick="openButtonEdit('card', ${i})">编辑</button>
      <button class="link-btn link-btn-danger" type="button" onclick="deleteCardButton(${i})">删除</button>
    </div>`).join('');
}

function syncPageForm() {
  if (!pageDraft) return;
  if (pageIsNew) pageDraft.id = (document.getElementById('pg-id')?.value || '').trim();
  pageDraft.name = (document.getElementById('pg-name')?.value || '').trim();
  pageDraft.pageType = pageDraft.pageType || '首页';
  pageDraft.image = document.getElementById('pg-image')?.value || '';
  pageDraft.text = document.getElementById('pg-text')?.value || '';
  pageDraft.mainMenuOverrideId = document.getElementById('pg-menu')?.value || '';
  pageDraft.status = document.querySelector('input[name="pg-status"]:checked')?.value || 'active';
}

function addCardButton() {
  syncPageForm();
  if ((pageDraft.cardButtons || []).length >= 2) {
    showToast('卡片按钮最多 2 个', 'err');
    return;
  }
  pageDraft.cardButtons = pageDraft.cardButtons || [];
  openButtonEdit('card', null);
}

async function deleteCardButton(i) {
  const ok = await confirmModal({ title: '确认删除该卡片按钮？', confirmText: '确认删除' });
  if (!ok) return;
  syncPageForm();
  pageDraft.cardButtons.splice(i, 1);
  pageDirty = true;
  renderPageDrawer();
}

function savePage() {
  syncPageForm();
  fieldError('err-pg-id', '');
  if (!pageDraft.id || !isIdToken(pageDraft.id)) {
    fieldError('err-pg-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-50');
    return;
  }
  if (!pageDraft.name) {
    showToast('请填写页面名称', 'err');
    return;
  }
  const dup = (draft.pages || []).find(p => p.id === pageDraft.id);
  if (pageIsNew && dup) {
    fieldError('err-pg-id', '该页面 ID 已存在');
    return;
  }
  if (pageIsNew) {
    draft.pages.push(clone(pageDraft));
    if (!draft.firstPageId) draft.firstPageId = pageDraft.id;
  } else {
    const idx = draft.pages.findIndex(p => p.id === pageDraft.id);
    if (idx >= 0) draft.pages[idx] = clone(pageDraft);
  }
  previewPageId = pageDraft.id;
  pageDirty = false;
  dirty = true;
  closeDrawer('pageDrawer');
  renderEditor();
  showToast('页面已保存到草稿');
}

async function maybeClosePage() {
  if (document.getElementById('buttonDrawer')?.classList.contains('open')) return false;
  if (!pageDirty) return true;
  return confirmModal({ title: '确认取消？', message: '页面有未保存的改动', confirmText: '确认离开', danger: false });
}

function editCurrentMenu() {
  syncHeaderFields();
  const id = document.getElementById('f-menu')?.value || draft.mainMenuId;
  if (!id) {
    showToast('请先选择默认主菜单', 'err');
    return;
  }
  openMenuEdit(id);
}

function openMenuEdit(id) {
  syncHeaderFields();
  menuIsNew = !id;
  menuDirty = false;
  menuDraft = id ? clone(menuById(id)) : emptyMenu(draft.productLineId, draft.botId, draft.platform);
  if (!menuDraft) {
    showToast('未找到该主菜单', 'err');
    return;
  }
  document.getElementById('menuDrawerTitle').textContent = id ? '编辑主菜单' : '新建主菜单';
  renderMenuDrawer();
  openDrawer('menuDrawer');
}

function menuButtons(style) {
  return (menuDraft.buttons || []).filter(b => (b.style || 'primary') === style).sort((a, b) => a.sort - b.sort);
}

function renderMenuDrawer() {
  const m = menuDraft;
  const locked = !menuIsNew && !!m.id;
  const prim = menuButtons('primary');
  const sec = menuButtons('secondary');
  const page = pageById(draft, previewPageId) || sortedPages(draft)[0] || emptyPage(0);
  const body = document.getElementById('menuDrawerBody');
  body.className = 'drawer-body drawer-body--split';
  body.innerHTML = `
    <div class="detail-preview viber-preview-pane">
      <div class="viber-preview-caption">Viber 预览</div>
      <div id="menu-preview-host">${viberPreviewHtml(page, m)}</div>
    </div>
    <div class="detail-main" id="menu-form-host">
    <div class="field">
      <label class="field-label">Bot<span class="req">*</span></label>
      <select class="select" id="mn-bot">${botOptions(m.productLineId || draft.productLineId, m.botId, m.platform || draft.platform)}</select>
    </div>
    <div class="field">
      <label class="field-label">主菜单 ID<span class="req">*</span></label>
      <input class="input" id="mn-id" maxlength="50" ${locked ? 'disabled' : ''} placeholder="请输入主菜单 ID" value="${esc(m.id)}" />
      <div class="field-error" id="err-mn-id"></div>
    </div>
    <div class="field">
      <label class="field-label">主菜单名称<span class="req">*</span></label>
      <input class="input" id="mn-name" maxlength="30" placeholder="请输入主菜单名称" value="${esc(m.name)}" />
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="mn-status" value="active"${m.status !== 'disabled' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="mn-status" value="disabled"${m.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">主按钮（≤2）</label>
      <div class="btn-list">${renderMenuRows('primary')}</div>
      <button class="btn btn-outline" type="button" ${prim.length >= 2 ? 'disabled' : ''} onclick="addMenuButton('primary')">添加主按钮</button>
    </div>
    <div class="field">
      <label class="field-label">次按钮（≤4）</label>
      <div class="btn-list">${renderMenuRows('secondary')}</div>
      <button class="btn btn-outline" type="button" ${sec.length >= 4 ? 'disabled' : ''} onclick="addMenuButton('secondary')">添加次按钮</button>
    </div>
    </div>`;
  const form = document.getElementById('menu-form-host');
  if (form) {
    form.oninput = () => { menuDirty = true; refreshMenuPreview(); };
    form.onchange = () => { menuDirty = true; refreshMenuPreview(); };
  }
  refreshIcons();
}

function renderMenuRows(style) {
  const list = menuButtons(style);
  if (!list.length) return '<div class="table-empty" style="padding:12px">暂无按钮</div>';
  return list.map(b => {
    const idx = menuDraft.buttons.indexOf(b);
    return `<div class="btn-row">
      <div class="grow">${esc(b.text || '未命名')} · ${esc(eventLabel(b.event))}${b.event === 'Event' ? ' / ' + esc(builtinEventLabel(b.eventType)) : ''}</div>
      <button class="link-btn" type="button" onclick="openButtonEdit('menu', ${idx})">编辑</button>
      <button class="link-btn link-btn-danger" type="button" onclick="deleteMenuButton(${idx})">删除</button>
    </div>`;
  }).join('');
}

function syncMenuForm() {
  if (!menuDraft) return;
  if (menuIsNew) menuDraft.id = (document.getElementById('mn-id')?.value || '').trim();
  menuDraft.name = (document.getElementById('mn-name')?.value || '').trim();
  menuDraft.productLineId = menuDraft.productLineId || draft.productLineId;
  menuDraft.platform = menuDraft.platform || draft.platform || defaultPlatform();
  menuDraft.botId = document.getElementById('mn-bot')?.value || menuDraft.botId;
  menuDraft.status = document.querySelector('input[name="mn-status"]:checked')?.value || 'active';
}

function addMenuButton(style) {
  syncMenuForm();
  const limit = style === 'primary' ? 2 : 4;
  if (menuButtons(style).length >= limit) {
    showToast(style === 'primary' ? '主按钮最多 2 个' : '次按钮最多 4 个', 'err');
    return;
  }
  if ((menuDraft.buttons || []).length >= 6) {
    showToast('菜单按钮最多 6 个', 'err');
    return;
  }
  menuDraft.buttons = menuDraft.buttons || [];
  openButtonEdit('menu', null, style);
}

async function deleteMenuButton(i) {
  const ok = await confirmModal({ title: '确认删除该菜单按钮？', confirmText: '确认删除' });
  if (!ok) return;
  syncMenuForm();
  menuDraft.buttons.splice(i, 1);
  menuDirty = true;
  renderMenuDrawer();
}

function saveMenu() {
  syncMenuForm();
  fieldError('err-mn-id', '');
  if (!menuDraft.id || !isIdToken(menuDraft.id)) {
    fieldError('err-mn-id', '必须以字母开头，仅小写字母/数字/下划线，长度 1-50');
    return;
  }
  if (!menuDraft.name) {
    showToast('请填写主菜单名称', 'err');
    return;
  }
  const prim = menuButtons('primary').length;
  const sec = menuButtons('secondary').length;
  if (prim > 2 || sec > 4 || (menuDraft.buttons || []).length > 6) {
    showToast('主按钮 ≤2、次按钮 ≤4、合计 ≤6', 'err');
    return;
  }
  if (menuIsNew && menuById(menuDraft.id)) {
    fieldError('err-mn-id', '该主菜单 ID 已存在');
    return;
  }
  if (menuIsNew) DB.menus.push(clone(menuDraft));
  else {
    const idx = DB.menus.findIndex(x => x.id === menuDraft.id);
    if (idx >= 0) DB.menus[idx] = clone(menuDraft);
    else DB.menus.push(clone(menuDraft));
  }
  saveStore();
  draft.mainMenuId = menuDraft.id;
  menuDirty = false;
  dirty = true;
  closeDrawer('menuDrawer');
  renderEditor();
  showToast('主菜单已保存');
}

async function maybeCloseMenu() {
  if (document.getElementById('buttonDrawer')?.classList.contains('open')) return false;
  if (!menuDirty) return true;
  return confirmModal({ title: '确认取消？', message: '主菜单有未保存的改动', confirmText: '确认离开', danger: false });
}

function openButtonEdit(source, index, newStyle) {
  if (source === 'card') syncPageForm();
  if (source === 'menu') syncMenuForm();
  btnCtx = { source, index };
  btnDirty = false;
  const list = source === 'card' ? (pageDraft.cardButtons || []) : (menuDraft.buttons || []);
  const fallbackStyle = source === 'card' ? 'primary' : (newStyle || 'primary');
  btnDraft = index == null ? emptyButton(fallbackStyle, list.length + 1) : clone(list[index]);
  if (source === 'card') btnDraft.style = 'primary';
  document.getElementById('buttonDrawerTitle').textContent = '按钮编辑';
  renderButtonDrawer();
  openDrawer('buttonDrawer');
}

function renderButtonDrawer() {
  const b = btnDraft;
  const isMenu = btnCtx.source === 'menu';
  document.getElementById('buttonDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">按钮文案<span class="req">*</span></label>
      <input class="input" id="bt-text" maxlength="25" placeholder="请输入按钮文案" value="${esc(b.text)}" />
    </div>
    <div class="field">
      <label class="field-label">事件类型<span class="req">*</span></label>
      <select class="select" id="bt-event" onchange="onBtnEventChange()">
        ${BUTTON_EVENTS.map(e => optionHtml(e.value, e.label, b.event)).join('')}
      </select>
    </div>
    <div class="event-params" id="bt-params">${renderEventParams(b.event)}</div>
    ${isMenu ? `<div class="field">
      <label class="field-label">样式<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="bt-style" value="primary"${b.style !== 'secondary' ? ' checked' : ''}> 主</label>
        <label><input type="radio" name="bt-style" value="secondary"${b.style === 'secondary' ? ' checked' : ''}> 次</label>
      </div>
    </div>` : ''}
    <div class="field">
      <label class="field-label">排序<span class="req">*</span></label>
      <input class="input" id="bt-sort" type="number" min="0" max="99" value="${esc(b.sort || 1)}" />
    </div>`;
  document.getElementById('buttonDrawerBody').oninput = () => { btnDirty = true; };
  document.getElementById('buttonDrawerBody').onchange = () => { btnDirty = true; };
}

function renderEventParams(ev) {
  const b = btnDraft;
  if (ev === 'Page') {
    const pages = sortedPages(draft).filter(p => p.id && (!pageDraft || p.id !== pageDraft.id));
    return `<div class="field" style="margin:0">
      <label class="field-label">跳转页面<span class="req">*</span></label>
      <select class="select" id="bt-page">
        <option value="">请选择页面</option>
        ${pages.map(p => optionHtml(p.id, `${p.name} (${p.id})`, b.pageId)).join('')}
      </select>
    </div>`;
  }
  if (ev === 'Url') {
    return `<div class="field">
      <label class="field-label">URL<span class="req">*</span></label>
      <input class="input" id="bt-url" placeholder="请输入 URL" value="${esc(b.url)}" />
    </div>
    <div class="field" style="margin:0">
      <label class="field-label">自动登录</label>
      <div class="radio-group">
        <label><input type="radio" name="bt-al" value="1"${b.autoLogin ? ' checked' : ''}> 是</label>
        <label><input type="radio" name="bt-al" value="0"${b.autoLogin ? '' : ' checked'}> 否</label>
      </div>
    </div>`;
  }
  if (ev === 'Flow') {
    return `<div class="field" style="margin:0">
      <label class="field-label">对话流<span class="req">*</span></label>
      <select class="select" id="bt-flow">
        <option value="">请选择对话流</option>
        ${publishedFlowOptions(draft.productLineId, draft.botId, b.flowId, draft.platform)}
      </select>
    </div>`;
  }
  if (ev === 'Event') {
    return `<div class="field" style="margin:0">
      <label class="field-label">内置事件<span class="req">*</span></label>
      <select class="select" id="bt-builtin">
        <option value="">请选择事件</option>
        ${BUILTIN_EVENTS.map(e => optionHtml(e.value, e.label, b.eventType)).join('')}
      </select>
    </div>`;
  }
  return '<div class="field-hint">回主菜单无需额外参数</div>';
}

function onBtnEventChange() {
  btnDirty = true;
  btnDraft.event = document.getElementById('bt-event').value;
  document.getElementById('bt-params').innerHTML = renderEventParams(btnDraft.event);
}

function readButtonForm() {
  const ev = document.getElementById('bt-event')?.value || 'Page';
  const style = document.querySelector('input[name="bt-style"]:checked')?.value
    || (btnCtx.source === 'card' ? 'primary' : (btnDraft.style || 'primary'));
  return {
    id: btnDraft.id || nextId('btn'),
    text: (document.getElementById('bt-text')?.value || '').trim(),
    event: ev,
    pageId: document.getElementById('bt-page')?.value || '',
    url: (document.getElementById('bt-url')?.value || '').trim(),
    autoLogin: document.querySelector('input[name="bt-al"]:checked')?.value === '1',
    flowId: document.getElementById('bt-flow')?.value || '',
    eventType: document.getElementById('bt-builtin')?.value || '',
    style,
    sort: Number(document.getElementById('bt-sort')?.value || 1)
  };
}

function saveButton() {
  const b = readButtonForm();
  if (!b.text) {
    showToast('请填写按钮文案', 'err');
    return;
  }
  if (!b.event) {
    showToast('请选择事件类型', 'err');
    return;
  }
  if (b.event === 'Page' && !b.pageId) {
    showToast('请选择跳转页面', 'err');
    return;
  }
  if (b.event === 'Url' && !b.url) {
    showToast('请填写 URL', 'err');
    return;
  }
  if (b.event === 'Flow' && !b.flowId) {
    showToast('请选择对话流', 'err');
    return;
  }
  if (b.event === 'Event' && !b.eventType) {
    showToast('请选择内置事件', 'err');
    return;
  }
  if (!Number.isInteger(b.sort) || b.sort < 0 || b.sort > 99) {
    showToast('排序须为 0-99 的整数', 'err');
    return;
  }
  if (btnCtx.source === 'menu') {
    const others = (menuDraft.buttons || []).filter((_, i) => i !== btnCtx.index);
    const prim = others.filter(x => (x.style || 'primary') === 'primary').length + (b.style === 'primary' ? 1 : 0);
    const sec = others.filter(x => x.style === 'secondary').length + (b.style === 'secondary' ? 1 : 0);
    if (prim > 2 || sec > 4) {
      showToast('主按钮 ≤2、次按钮 ≤4', 'err');
      return;
    }
    if (btnCtx.index == null) menuDraft.buttons.push(b);
    else menuDraft.buttons[btnCtx.index] = b;
    menuDirty = true;
    renderMenuDrawer();
  } else {
    if (btnCtx.index == null) pageDraft.cardButtons.push(b);
    else pageDraft.cardButtons[btnCtx.index] = b;
    pageDirty = true;
    renderPageDrawer();
  }
  btnDirty = false;
  closeDrawer('buttonDrawer');
}

async function maybeCloseButton() {
  if (!btnDirty) return true;
  return confirmModal({ title: '确认取消？', message: '按钮有未保存的改动', confirmText: '确认离开', danger: false });
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('flow-editor');
  const id = qs('id');
  if (id) {
    const f = flowById(id);
    if (!f) {
      document.getElementById('content').innerHTML = '<div class="empty-page">对话流不存在</div>';
      return;
    }
    draft = clone(f);
    isNew = false;
  } else {
    const pl = qs('pl') || defaultProductLine();
    const platform = qs('platform') || defaultPlatform();
    const bot = qs('bot') || defaultBot(pl, platform);
    const type = qs('type') === 'fallback' ? 'fallback' : 'normal';
    if (type === 'fallback' && findFixedFlow(pl, bot, type, platform)) {
      showToast(`当前 Bot 已有${fixedFlowLabel(type)}`, 'err');
      location.href = 'flows.html';
      return;
    }
    draft = emptyFlow(pl, bot, type, platform);
    isNew = true;
  }
  if (!draft.platform) draft.platform = defaultPlatform();
  previewPageId = draft.firstPageId || sortedPages(draft)[0]?.id || '';
  bindDrawerClose({
    beforeClose: async drawerId => {
      if (drawerId === 'buttonDrawer') return maybeCloseButton();
      if (drawerId === 'pageDrawer') return maybeClosePage();
      if (drawerId === 'menuDrawer') return maybeCloseMenu();
      return true;
    }
  });
  document.getElementById('pageSaveBtn').addEventListener('click', savePage);
  document.getElementById('pageCancelBtn').addEventListener('click', async () => {
    if (await maybeClosePage()) closeDrawer('pageDrawer');
  });
  document.getElementById('menuSaveBtn').addEventListener('click', saveMenu);
  document.getElementById('menuCancelBtn').addEventListener('click', async () => {
    if (await maybeCloseMenu()) closeDrawer('menuDrawer');
  });
  document.getElementById('buttonSaveBtn').addEventListener('click', saveButton);
  document.getElementById('buttonCancelBtn').addEventListener('click', async () => {
    if (await maybeCloseButton()) closeDrawer('buttonDrawer');
  });
  renderEditor();
});

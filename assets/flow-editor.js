/* 对话流编辑器：默认主菜单列表 + 多页面 + 点击后操作 */

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

function emptyFlow(pl, bot, platform) {
  const plat = platform || defaultPlatform();
  const menus = menusByScope(pl, bot, plat);
  return {
    id: '',
    name: '',
    productLineId: pl || defaultProductLine(),
    platform: plat,
    botId: bot || defaultBot(pl, plat),
    type: 'normal',
    status: 'draft',
    purpose: '',
    mainMenuId: menus[0]?.id || '',
    firstPageId: '',
    remark: '',
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
  return makeBtn(nextId('btn'), '', 'Page', { style, sort });
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
  if (btn.event === 'Event') {
    const ev = builtinEventLabel(btn.eventType) || '事件';
    if (btn.eventType === 'SharePhone' && btn.shareAfter) {
      return `${ev} → ${btn.shareAfter === 'Flow' ? jumpTargetLabel({ event: 'Flow', flowId: btn.flowId }) : jumpTargetLabel({ event: 'Page', pageId: btn.pageId })}`;
    }
    return ev;
  }
  if (btn.event === 'Home') return '回主菜单';
  return eventLabel(btn.event);
}

function collectJumps() {
  const jumps = [];
  sortedPages(draft).forEach(p => {
    (p.cardButtons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach((b, i) => {
      jumps.push(`${p.name || p.id} → ${jumpTargetLabel(b)}（卡片按钮${i + 1}）`);
    });
    const menu = menuById(p.mainMenuOverrideId || draft.mainMenuId);
    (menu?.buttons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach((b, i) => {
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
  if (p.mainMenuOverrideId) parts.push(`底部菜单：${menu ? menu.name : p.mainMenuOverrideId}`);
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
  return IMAGE_PRESETS.find(i => i.value === url)?.label || (url ? '图片' : '');
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
  const cards = (page?.cardButtons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const text = interpolatePreview(page?.text || '');
  const imgLabel = page?.image ? imagePresetLabel(page.image) : '';
  const pageName = page?.name || page?.id || '未命名页面';

  const kbHtml = kbBtns.length
    ? `<div class="viber-keyboard">
        ${chunkButtons(kbBtns, 2).map(row => `<div class="viber-kb-row${row.length === 1 ? ' single' : ''}">${row.map(b => viberKbBtn(b)).join('')}</div>`).join('')}
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
  const isPrimary = (b.style || 'primary') === 'primary';
  const jump = b.event === 'Page' && b.pageId ? `onclick="previewGoPage('${esc(b.pageId)}')"` : '';
  return `<button class="viber-card-btn ${isPrimary ? 'primary' : 'secondary'}" type="button" ${jump}>${esc(b.text || '按钮')}</button>`;
}

function viberKbBtn(b) {
  const jump = b.event === 'Page' && b.pageId ? `onclick="previewGoPage('${esc(b.pageId)}')"` : '';
  if (b.image) {
    return `<button class="viber-kb-btn" type="button" ${jump}><span class="viber-kb-icon"><img src="${esc(b.image)}" alt="" onerror="this.style.display='none'"><span>图</span></span></button>`;
  }
  return `<button class="viber-kb-btn" type="button" ${jump}><span>${esc(b.text || '按钮')}</span></button>`;
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

function scopedMenus() {
  return menusByScope(draft.productLineId, draft.botId, draft.platform);
}

function setMainMenu(id) {
  syncHeaderFields();
  draft.mainMenuId = id;
  dirty = true;
  renderEditor();
}

function setFirstPage(id) {
  syncHeaderFields();
  if (!pageById(draft, id)) return;
  draft.firstPageId = id;
  dirty = true;
  renderEditor();
}

function bindSortableList(containerSel, itemSel, onReorder) {
  const container = document.querySelector(containerSel);
  if (!container) return;
  let dragEl = null;
  container.querySelectorAll(itemSel).forEach(el => {
    el.draggable = true;
    el.addEventListener('dragstart', e => {
      if (e.target.closest('button, a, input, select, textarea')) {
        e.preventDefault();
        return;
      }
      dragEl = el;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.id || '');
    });
    el.addEventListener('dragend', () => {
      if (dragEl) dragEl.classList.remove('dragging');
      const ids = [...container.querySelectorAll(itemSel)].map(x => x.dataset.id).filter(Boolean);
      dragEl = null;
      if (typeof onReorder === 'function') onReorder(ids);
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      const over = e.currentTarget;
      if (!dragEl || over === dragEl) return;
      const rect = over.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      over.parentNode.insertBefore(dragEl, before ? over : over.nextSibling);
    });
    el.addEventListener('drop', e => e.preventDefault());
  });
}

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function reorderMenuButtons(ids) {
  const current = menuButtons().map(b => b.id);
  if (sameIds(ids, current)) return;
  const map = Object.fromEntries((menuDraft.buttons || []).map(b => [b.id, b]));
  menuDraft.buttons = ids.map((id, i) => {
    const b = map[id];
    if (b) b.sort = i + 1;
    return b;
  }).filter(Boolean);
  menuDirty = true;
  renderMenuDrawer();
}

function uploadFieldHtml(inputId, value) {
  const has = !!value;
  return `<div class="upload-field">
    <input type="file" id="${inputId}" accept="image/jpeg,image/png" hidden onchange="onImageFileChange('${inputId}')" />
    <button type="button" class="upload-preview${has ? ' has-file' : ''}" onclick="document.getElementById('${inputId}').click()">
      ${has ? `<img src="${esc(value)}" alt="">` : '<span>点击上传 JPEG/PNG ≤500KB</span>'}
    </button>
    ${has ? `<button type="button" class="link-btn" onclick="clearUploadedImage('${inputId}')">移除</button>` : ''}
  </div>`;
}

function readImageFile(file, done) {
  if (!file) return;
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    showToast('仅支持 JPEG/PNG', 'err');
    return;
  }
  if (file.size > 500 * 1024) {
    showToast('图片需 ≤500KB', 'err');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => done(reader.result);
  reader.readAsDataURL(file);
}

function onImageFileChange(inputId) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  readImageFile(file, dataUrl => {
    if (inputId === 'pg-image') {
      pageDraft.image = dataUrl;
      pageDirty = true;
      renderPageDrawer();
    } else if (inputId === 'bt-image') {
      btnDraft.image = dataUrl;
      btnDraft.text = '';
      btnDirty = true;
      renderButtonDrawer();
    }
  });
}

function clearUploadedImage(inputId) {
  if (inputId === 'pg-image') {
    pageDraft.image = '';
    pageDirty = true;
    renderPageDrawer();
  } else if (inputId === 'bt-image') {
    btnDraft.image = '';
    btnDirty = true;
    renderButtonDrawer();
  }
}

function renderEditor() {
  const idLocked = !isNew && !!draft.id;
  const pages = sortedPages(draft);
  const jumps = collectJumps();
  const menus = scopedMenus();
  const firstOpts = pages.map(p => optionHtml(p.id, `${p.name} (${p.id})`, draft.firstPageId)).join('');
  ensurePreviewPage();
  document.getElementById('content').innerHTML = `
    <div class="flow-editor-head">
      <div>
        <h1>对话流编辑${draft.name ? ` · ${esc(draft.name)}` : ''}</h1>
        <p class="page-desc" style="margin:4px 0 0">${statusTag(draft.status)}</p>
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
        <select class="select" id="f-platform" onchange="onEditorPlatformChange()">${platformOptions(draft.platform || defaultPlatform())}</select>
      </div>
      <div class="field">
        <label class="field-label">Bot<span class="req">*</span></label>
        <select class="select" id="f-bot" onchange="onEditorBotChange()">${botOptions(draft.productLineId, draft.botId, draft.platform)}</select>
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
        <h4 class="card-title" style="margin:0">底部菜单</h4>
        <button class="btn btn-outline" type="button" onclick="openMenuEdit(null)">
          <i data-lucide="plus"></i>新建底部菜单
        </button>
      </div>
      <div class="table-scroll">
        <table class="table table-nowrap menu-pick-table">
          <thead>
            <tr>
              <th>菜单名称</th>
              <th>编辑</th>
              <th>设为主菜单</th>
            </tr>
          </thead>
          <tbody>
            ${menus.length ? menus.map(m => {
              const isMain = m.id === draft.mainMenuId;
              return `<tr>
                <td>${esc(m.name || m.id)}${isMain ? '<span class="main-menu-mark" title="当前主菜单"><i data-lucide="house"></i></span>' : ''}</td>
                <td><button class="link-btn" type="button" onclick="openMenuEdit('${esc(m.id)}')">编辑</button></td>
                <td><button class="link-btn" type="button" ${isMain ? 'disabled' : ''} onclick="setMainMenu('${esc(m.id)}')">设为主菜单</button></td>
              </tr>`;
            }).join('') : `<tr><td colspan="3"><div class="table-empty">暂无底部菜单</div></td></tr>`}
          </tbody>
        </table>
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
        ${pages.length ? pages.map(p => `
          <div class="page-list-item${p.id === previewPageId ? ' selected' : ''}" data-page-id="${esc(p.id)}" onclick="selectPreviewPage('${esc(p.id)}')">
            <div class="grow">
              <div class="title">${p.id === draft.firstPageId ? '<span class="tag tag-primary">首屏</span> ' : ''}${esc(p.name || p.id)} <span class="tag tag-gray">${esc(p.id)}</span></div>
              <div class="meta">${esc(pageMeta(p))}</div>
            </div>
            <div class="page-list-ops" onclick="event.stopPropagation()">
              <button class="link-btn" type="button" onclick="openPageEdit('${esc(p.id)}')">编辑</button>
              <button class="link-btn" type="button" ${p.id === draft.firstPageId ? 'disabled' : ''} onclick="setFirstPage('${esc(p.id)}')">设为首屏</button>
              <button class="link-btn" type="button" onclick="copyPage('${esc(p.id)}')">复制</button>
              <button class="link-btn link-btn-danger" type="button" ${pages.length <= 1 ? 'disabled' : ''} onclick="deletePage('${esc(p.id)}')">删除</button>
            </div>
          </div>`).join('') : '<div class="table-empty">暂无页面，请添加</div>'}
      </div>
    </section>
    <section class="card">
      <h4 class="card-title">页面跳转关系（自动生成）</h4>
      ${jumps.length ? `<ul class="jump-list">${jumps.map(j => `<li>${esc(j)}</li>`).join('')}</ul>` : '<div class="table-empty">配置页面按钮或底部菜单后自动生成</div>'}
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
  copy.order = Math.max(-1, ...sortedPages(draft).map(p => p.order || 0)) + 1;
  copy.cardButtons = (copy.cardButtons || []).map((b, i) => ({ ...b, id: nextId('cb') || `cb_${Date.now()}_${i}` }));
  draft.pages.push(copy);
  dirty = true;
  previewPageId = copy.id;
  renderEditor();
  showToast('页面已复制到草稿');
}

async function deletePage(id) {
  if (sortedPages(draft).length <= 1) {
    showToast('至少保留 1 个页面', 'err');
    return;
  }
  const ok = await confirmModal({ title: '确认删除该页面？', confirmText: '确认删除' });
  if (!ok) return;
  draft.pages = draft.pages.filter(p => p.id !== id);
  if (draft.firstPageId === id) draft.firstPageId = sortedPages(draft)[0]?.id || '';
  if (previewPageId === id) previewPageId = draft.firstPageId;
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
      ${uploadFieldHtml('pg-image', p.image)}
    </div>
    <div class="field">
      <label class="field-label">文本</label>
      <textarea class="textarea" id="pg-text" maxlength="2000" placeholder="请输入页面文本内容，支持 {nickname} 等占位符">${esc(p.text || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label">卡片按钮（≤2，文案 / 主次 / 点击后操作）</label>
      <div class="btn-list" id="pg-cards">${renderCardRows()}</div>
      <button class="btn btn-outline" type="button" ${(p.cardButtons || []).length >= 2 ? 'disabled' : ''} onclick="addCardButton()">添加卡片按钮</button>
    </div>
    <div class="field">
      <label class="field-label">底部菜单</label>
      <select class="select" id="pg-menu">
        <option value="">使用对话流默认底部菜单</option>
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

function cardStyleLabel(style) {
  return style === 'secondary' ? '次' : '主';
}

function renderCardRows() {
  const list = (pageDraft.cardButtons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  if (!list.length) return '<div class="table-empty" style="padding:12px">暂无卡片按钮</div>';
  return list.map(b => {
    const idx = pageDraft.cardButtons.indexOf(b);
    return `
    <div class="btn-row">
      <div class="grow">${esc(b.text || '未命名')} · ${esc(cardStyleLabel(b.style))} · ${esc(eventLabel(b.event))}</div>
      <button class="link-btn" type="button" onclick="openButtonEdit('card', ${idx})">编辑</button>
      <button class="link-btn link-btn-danger" type="button" onclick="deleteCardButton(${idx})">删除</button>
    </div>`;
  }).join('');
}

function syncPageForm() {
  if (!pageDraft) return;
  if (pageIsNew) pageDraft.id = (document.getElementById('pg-id')?.value || '').trim();
  pageDraft.name = (document.getElementById('pg-name')?.value || '').trim();
  pageDraft.pageType = pageDraft.pageType || '首页';
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

function openMenuEdit(id) {
  syncHeaderFields();
  menuIsNew = !id;
  menuDirty = false;
  menuDraft = id ? clone(menuById(id)) : emptyMenu(draft.productLineId, draft.botId, draft.platform);
  if (!menuDraft) {
    showToast('未找到该底部菜单', 'err');
    return;
  }
  document.getElementById('menuDrawerTitle').textContent = id ? '编辑底部菜单' : '新建底部菜单';
  renderMenuDrawer();
  openDrawer('menuDrawer');
}

function menuButtons() {
  return (menuDraft.buttons || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

function renderMenuDrawer() {
  const m = menuDraft;
  const btns = menuButtons();
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
      <label class="field-label">底部菜单名称<span class="req">*</span></label>
      <input class="input" id="mn-name" maxlength="30" placeholder="请输入底部菜单名称" value="${esc(m.name)}" />
    </div>
    <div class="field">
      <label class="field-label">状态<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="mn-status" value="active"${m.status !== 'disabled' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="mn-status" value="disabled"${m.status === 'disabled' ? ' checked' : ''}> 停用</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">菜单按钮（≤6，文案或图片）</label>
      <div class="btn-list" id="menu-btn-sort-list">${renderMenuRows()}</div>
      <button class="btn btn-outline" type="button" ${btns.length >= 6 ? 'disabled' : ''} onclick="addMenuButton()">添加菜单按钮</button>
    </div>
    </div>`;
  const form = document.getElementById('menu-form-host');
  if (form) {
    form.oninput = () => { menuDirty = true; refreshMenuPreview(); };
    form.onchange = () => { menuDirty = true; refreshMenuPreview(); };
  }
  bindSortableList('#menu-btn-sort-list', '.btn-row[data-id]', reorderMenuButtons);
  refreshIcons();
}

function renderMenuRows() {
  const list = menuButtons();
  if (!list.length) return '<div class="table-empty" style="padding:12px">暂无按钮</div>';
  return list.map(b => {
    const idx = menuDraft.buttons.indexOf(b);
    const show = b.image ? '图片' : (b.text || '未命名');
    return `<div class="btn-row" data-id="${esc(b.id)}">
      <span class="drag-handle" title="拖动排序"><i data-lucide="grip-vertical"></i></span>
      <div class="grow">${esc(show)} · ${esc(eventLabel(b.event))}${b.event === 'Event' ? ' / ' + esc(builtinEventLabel(b.eventType)) : ''}</div>
      <button class="link-btn" type="button" onclick="openButtonEdit('menu', ${idx})">编辑</button>
      <button class="link-btn link-btn-danger" type="button" onclick="deleteMenuButton(${idx})">删除</button>
    </div>`;
  }).join('');
}

function syncMenuForm() {
  if (!menuDraft) return;
  menuDraft.name = (document.getElementById('mn-name')?.value || '').trim();
  menuDraft.productLineId = menuDraft.productLineId || draft.productLineId;
  menuDraft.platform = menuDraft.platform || draft.platform || defaultPlatform();
  menuDraft.botId = document.getElementById('mn-bot')?.value || menuDraft.botId;
  menuDraft.status = document.querySelector('input[name="mn-status"]:checked')?.value || 'active';
}

function addMenuButton() {
  syncMenuForm();
  if ((menuDraft.buttons || []).length >= 6) {
    showToast('菜单按钮最多 6 个', 'err');
    return;
  }
  menuDraft.buttons = menuDraft.buttons || [];
  openButtonEdit('menu', null);
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
  if (!menuDraft.name) {
    showToast('请填写底部菜单名称', 'err');
    return;
  }
  if ((menuDraft.buttons || []).length > 6) {
    showToast('菜单按钮最多 6 个', 'err');
    return;
  }
  if (menuIsNew) {
    menuDraft.id = nextId('menu');
    DB.menus.push(clone(menuDraft));
    if (!draft.mainMenuId) draft.mainMenuId = menuDraft.id;
  } else {
    const idx = DB.menus.findIndex(x => x.id === menuDraft.id);
    if (idx >= 0) DB.menus[idx] = clone(menuDraft);
    else DB.menus.push(clone(menuDraft));
  }
  saveStore();
  menuDirty = false;
  dirty = true;
  closeDrawer('menuDrawer');
  renderEditor();
  showToast('底部菜单已保存');
}

async function maybeCloseMenu() {
  if (document.getElementById('buttonDrawer')?.classList.contains('open')) return false;
  if (!menuDirty) return true;
  return confirmModal({ title: '确认取消？', message: '底部菜单有未保存的改动', confirmText: '确认离开', danger: false });
}

function openButtonEdit(source, index) {
  if (source === 'card') syncPageForm();
  if (source === 'menu') syncMenuForm();
  btnCtx = { source, index };
  btnDirty = false;
  const list = source === 'card' ? (pageDraft.cardButtons || []) : (menuDraft.buttons || []);
  const fallbackStyle = source === 'card' && list.every(x => (x.style || 'primary') === 'primary')
    ? (list.length ? 'secondary' : 'primary')
    : 'primary';
  btnDraft = index == null ? emptyButton(fallbackStyle, list.length + 1) : clone(list[index]);
  if (source === 'card') btnDraft.image = '';
  if (!btnDraft.browser && btnDraft.autoLogin) btnDraft.browser = 'internal';
  document.getElementById('buttonDrawerTitle').textContent = source === 'card' ? '卡片按钮' : '菜单按钮';
  renderButtonDrawer();
  openDrawer('buttonDrawer');
}

function actionFieldsHtml(b) {
  return `
    <div class="field">
      <label class="field-label">点击后操作<span class="req">*</span></label>
      <select class="select" id="bt-event" onchange="onBtnEventChange()">
        ${BUTTON_EVENTS.map(e => optionHtml(e.value, e.label, b.event)).join('')}
      </select>
    </div>
    <div class="event-params" id="bt-params">${renderEventParams(b.event)}</div>`;
}

function renderButtonDrawer() {
  const b = btnDraft;
  const isMenu = btnCtx.source === 'menu';
  const display = b.image ? 'image' : 'text';
  const cardFields = `
    <div class="field">
      <label class="field-label">按钮文案<span class="req">*</span></label>
      <input class="input" id="bt-text" maxlength="25" placeholder="请输入按钮文案" value="${esc(b.text)}" />
    </div>
    <div class="field">
      <label class="field-label">样式<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="bt-style" value="primary"${b.style !== 'secondary' ? ' checked' : ''}> 主</label>
        <label><input type="radio" name="bt-style" value="secondary"${b.style === 'secondary' ? ' checked' : ''}> 次</label>
      </div>
    </div>
    ${actionFieldsHtml(b)}`;
  const menuFields = `
    <div class="field">
      <label class="field-label">展示方式<span class="req">*</span></label>
      <div class="radio-group">
        <label><input type="radio" name="bt-display" value="text"${display !== 'image' ? ' checked' : ''} onchange="onBtnDisplayChange()"> 文案</label>
        <label><input type="radio" name="bt-display" value="image"${display === 'image' ? ' checked' : ''} onchange="onBtnDisplayChange()"> 图片</label>
      </div>
    </div>
    ${display === 'image' ? `<div class="field">
      <label class="field-label">图片<span class="req">*</span></label>
      ${uploadFieldHtml('bt-image', b.image)}
    </div>` : `<div class="field">
      <label class="field-label">按钮文案<span class="req">*</span></label>
      <input class="input" id="bt-text" maxlength="25" placeholder="请输入按钮文案" value="${esc(b.text)}" />
    </div>`}
    ${actionFieldsHtml(b)}`;
  document.getElementById('buttonDrawerBody').innerHTML = isMenu ? menuFields : cardFields;
  document.getElementById('buttonDrawerBody').oninput = () => { btnDirty = true; };
  document.getElementById('buttonDrawerBody').onchange = () => { btnDirty = true; };
}

function renderEventParams(ev) {
  const b = btnDraft;
  if (ev === 'Page') {
    const pages = sortedPages(draft).filter(p => p.id);
    return `<div class="field" style="margin:0">
      <label class="field-label">跳转页面<span class="req">*</span></label>
      <select class="select" id="bt-page">
        <option value="">请选择页面</option>
        ${pages.map(p => optionHtml(p.id, `${p.name} (${p.id})`, b.pageId)).join('')}
      </select>
    </div>`;
  }
  if (ev === 'Url') {
    const browser = b.browser || (b.autoLogin ? 'internal' : 'external');
    return `<div class="field">
      <label class="field-label">URL<span class="req">*</span></label>
      <input class="input" id="bt-url" placeholder="请输入 URL" value="${esc(b.url)}" />
    </div>
    <div class="field" style="margin:0">
      <label class="field-label">浏览器<span class="req">*</span></label>
      <div class="radio-group">
        ${BROWSER_TARGETS.map(t => `<label><input type="radio" name="bt-browser" value="${t.value}"${browser === t.value ? ' checked' : ''}> ${t.label}</label>`).join('')}
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
    return `<div class="field">
      <label class="field-label">事件<span class="req">*</span></label>
      <select class="select" id="bt-builtin" onchange="onBuiltinChange()">
        <option value="">请选择事件</option>
        ${BUILTIN_EVENTS.map(e => optionHtml(e.value, e.label, b.eventType)).join('')}
      </select>
    </div>${b.eventType === 'SharePhone' ? renderShareAfter(b) : ''}`;
  }
  return '<div class="field-hint">回主菜单无需额外参数</div>';
}

function renderShareAfter(b) {
  const after = b.shareAfter || '';
  const pages = sortedPages(draft).filter(p => p.id);
  return `<div class="field">
      <label class="field-label">分享后操作<span class="req">*</span></label>
      <select class="select" id="bt-share-after" onchange="onShareAfterChange()">
        <option value="">请选择</option>
        ${SHARE_AFTER_ACTIONS.map(e => optionHtml(e.value, e.label, after)).join('')}
      </select>
    </div>
    ${after === 'Page' ? `<div class="field" style="margin:0">
      <label class="field-label">页面<span class="req">*</span></label>
      <select class="select" id="bt-page">
        <option value="">请选择页面</option>
        ${pages.map(p => optionHtml(p.id, `${p.name} (${p.id})`, b.pageId)).join('')}
      </select>
    </div>` : ''}
    ${after === 'Flow' ? `<div class="field" style="margin:0">
      <label class="field-label">对话流<span class="req">*</span></label>
      <select class="select" id="bt-flow">
        <option value="">请选择对话流</option>
        ${publishedFlowOptions(draft.productLineId, draft.botId, b.flowId, draft.platform)}
      </select>
    </div>` : ''}`;
}

function onBtnDisplayChange() {
  const mode = document.querySelector('input[name="bt-display"]:checked')?.value || 'text';
  syncBtnDraftFromForm();
  if (mode === 'text') btnDraft.image = '';
  else btnDraft.text = '';
  btnDirty = true;
  renderButtonDrawer();
}

function onBtnEventChange() {
  syncBtnDraftFromForm();
  btnDraft.event = document.getElementById('bt-event').value;
  btnDirty = true;
  const host = document.getElementById('bt-params');
  if (host) host.innerHTML = renderEventParams(btnDraft.event);
}

function onBuiltinChange() {
  syncBtnDraftFromForm();
  btnDraft.eventType = document.getElementById('bt-builtin')?.value || '';
  btnDirty = true;
  const host = document.getElementById('bt-params');
  if (host) host.innerHTML = renderEventParams(btnDraft.event);
}

function onShareAfterChange() {
  syncBtnDraftFromForm();
  btnDraft.shareAfter = document.getElementById('bt-share-after')?.value || '';
  btnDirty = true;
  const host = document.getElementById('bt-params');
  if (host) host.innerHTML = renderEventParams(btnDraft.event);
}

function syncBtnDraftFromForm() {
  if (!btnDraft) return;
  const textEl = document.getElementById('bt-text');
  if (textEl) btnDraft.text = textEl.value.trim();
  const ev = document.getElementById('bt-event')?.value;
  if (ev) btnDraft.event = ev;
  if (document.getElementById('bt-page')) btnDraft.pageId = document.getElementById('bt-page').value || '';
  if (document.getElementById('bt-url')) btnDraft.url = document.getElementById('bt-url').value.trim();
  const browser = document.querySelector('input[name="bt-browser"]:checked')?.value;
  if (browser) btnDraft.browser = browser;
  if (document.getElementById('bt-flow')) btnDraft.flowId = document.getElementById('bt-flow').value || '';
  if (document.getElementById('bt-builtin')) btnDraft.eventType = document.getElementById('bt-builtin').value || '';
  if (document.getElementById('bt-share-after')) btnDraft.shareAfter = document.getElementById('bt-share-after').value || '';
  const style = document.querySelector('input[name="bt-style"]:checked')?.value;
  if (style) btnDraft.style = style;
}

function readButtonForm() {
  syncBtnDraftFromForm();
  const isMenu = btnCtx.source === 'menu';
  const display = isMenu
    ? (document.querySelector('input[name="bt-display"]:checked')?.value || (btnDraft.image ? 'image' : 'text'))
    : 'text';
  const ev = btnDraft.event || 'Page';
  return {
    id: btnDraft.id || nextId('btn'),
    text: display === 'image' ? '' : (btnDraft.text || '').trim(),
    event: ev,
    pageId: ev === 'Page' || (ev === 'Event' && btnDraft.eventType === 'SharePhone' && btnDraft.shareAfter === 'Page')
      ? (btnDraft.pageId || '')
      : '',
    url: ev === 'Url' ? (btnDraft.url || '').trim() : '',
    browser: ev === 'Url' ? (btnDraft.browser || 'external') : '',
    flowId: ev === 'Flow' || (ev === 'Event' && btnDraft.eventType === 'SharePhone' && btnDraft.shareAfter === 'Flow')
      ? (btnDraft.flowId || '')
      : '',
    eventType: ev === 'Event' ? (btnDraft.eventType || '') : '',
    shareAfter: ev === 'Event' && btnDraft.eventType === 'SharePhone' ? (btnDraft.shareAfter || '') : '',
    style: btnCtx.source === 'card'
      ? (document.querySelector('input[name="bt-style"]:checked')?.value || 'primary')
      : (btnDraft.style || 'primary'),
    image: isMenu && display === 'image' ? (btnDraft.image || '') : '',
    sort: Number(btnDraft.sort || 1)
  };
}

function validateButtonAction(b) {
  if (!b.event) {
    showToast('请选择点击后操作', 'err');
    return false;
  }
  if (b.event === 'Page' && !b.pageId) {
    showToast('请选择跳转页面', 'err');
    return false;
  }
  if (b.event === 'Url' && !b.url) {
    showToast('请填写 URL', 'err');
    return false;
  }
  if (b.event === 'Flow' && !b.flowId) {
    showToast('请选择对话流', 'err');
    return false;
  }
  if (b.event === 'Event' && !b.eventType) {
    showToast('请选择事件', 'err');
    return false;
  }
  if (b.event === 'Event' && b.eventType === 'SharePhone') {
    if (!b.shareAfter) {
      showToast('请选择分享后操作', 'err');
      return false;
    }
    if (b.shareAfter === 'Page' && !b.pageId) {
      showToast('请选择分享后页面', 'err');
      return false;
    }
    if (b.shareAfter === 'Flow' && !b.flowId) {
      showToast('请选择分享后对话流', 'err');
      return false;
    }
  }
  return true;
}

function saveButton() {
  const b = readButtonForm();
  if (btnCtx.source === 'menu') {
    if (!b.image && !b.text) {
      showToast('请填写按钮文案或上传图片', 'err');
      return;
    }
    if (b.image && b.text) {
      showToast('文案与图片只能选其一', 'err');
      return;
    }
    if (!validateButtonAction(b)) return;
    if (btnCtx.index == null && (menuDraft.buttons || []).length >= 6) {
      showToast('菜单按钮最多 6 个', 'err');
      return;
    }
    if (btnCtx.index == null) menuDraft.buttons.push(b);
    else menuDraft.buttons[btnCtx.index] = b;
    menuDirty = true;
    renderMenuDrawer();
  } else {
    if (!b.text) {
      showToast('请填写按钮文案', 'err');
      return;
    }
    if (!validateButtonAction(b)) return;
    if (btnCtx.index == null && (pageDraft.cardButtons || []).length >= 2) {
      showToast('卡片按钮最多 2 个', 'err');
      return;
    }
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
    draft = emptyFlow(pl, bot, platform);
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

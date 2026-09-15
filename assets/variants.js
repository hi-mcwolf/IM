/* 变体管理 / 编辑 */

let flow = null;
let editingKey = null;
let dirty = false;
let overrideNodeId = null;

function ensureFlow() {
  const id = qs('flow');
  flow = flowById(id);
  if (!flow || flow.type === 'system') {
    document.getElementById('content').innerHTML = `<div class="empty-page">未找到对话流，请从对话流编辑器进入</div>`;
    return false;
  }
  return true;
}

function render() {
  if (!ensureFlow()) return;
  const list = [...(flow.variants || [])].sort((a, b) => (a.key === 'default' ? -1 : 0) - (b.key === 'default' ? -1 : 0) || b.key.localeCompare(a.key));
  const atCap = list.length >= 2;
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">变体管理 · ${esc(flow.id)}</h1>
        <p class="page-desc">同一对话流可按人群挂多套内容。一期最多 default + 1 个分组变体，缺失时回退 default</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-outline" type="button" onclick="location.href='flow-editor.html?id=${encodeURIComponent(flow.id)}'">返回编辑器</button>
        <button class="btn btn-primary" type="button" ${atCap ? 'disabled title="已达变体数量上限"' : ''} onclick="openVariant(null)">
          <i data-lucide="plus"></i>新建变体
        </button>
      </div>
    </div>
    <section class="card table-card">
      <h4 class="card-title">变体列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>变体 Key</th>
              <th>名称</th>
              <th>内容覆盖</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(v => {
              const refs = variantRefCount(flow.id, v.key);
              const canDel = v.key !== 'default' && refs === 0;
              return `<tr>
                <td>${esc(v.key)}</td>
                <td>${esc(v.name)}</td>
                <td>${overrideCount(v)}</td>
                <td>${v.status === 'offline' ? statusTag('offline') : statusTag('active')}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openVariant('${esc(v.key)}')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" ${canDel ? '' : 'disabled'} onclick="deleteVariant('${esc(v.key)}')">删除</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
  refreshIcons();
}

function variantByKey(key) {
  return (flow.variants || []).find(v => v.key === key);
}

function openVariant(key) {
  if (!key && (flow.variants || []).length >= 2) {
    showToast('已达变体数量上限', 'err');
    return;
  }
  editingKey = key;
  dirty = false;
  const v = key ? clone(variantByKey(key)) : { key: '', name: '', status: 'active', nodeOverrides: {} };
  document.getElementById('variantDrawerTitle').textContent = key ? `变体编辑 · ${flow.id} · ${key}` : `新建变体 · ${flow.id}`;
  renderVariantForm(v);
  openDrawer('variantDrawer');
}

function renderVariantForm(v) {
  const nodes = messageNodes(flow);
  document.getElementById('variantDrawerBody').innerHTML = `
    <div class="field">
      <label class="field-label">变体 Key<span class="req">*</span></label>
      <input class="input" id="v-key" maxlength="20" ${editingKey ? 'disabled' : ''} placeholder="请输入变体 Key,小写字母+下划线,创建后不可改" value="${esc(v.key)}" />
      <div class="field-error" id="err-vkey"></div>
    </div>
    <div class="field">
      <label class="field-label">名称<span class="req">*</span></label>
      <input class="input" id="v-name" maxlength="30" placeholder="请输入变体名称" value="${esc(v.name)}" />
    </div>
    <div class="field">
      <label class="field-label">状态</label>
      <div class="radio-group">
        <label><input type="radio" name="v-status" value="active"${v.status !== 'offline' ? ' checked' : ''}> 启用</label>
        <label><input type="radio" name="v-status" value="offline"${v.status === 'offline' ? ' checked' : ''}> 下线</label>
      </div>
    </div>
    <div class="field">
      <label class="field-label">内容覆盖（按节点配置）</label>
      <div class="node-tree">
        ${nodes.length ? nodes.map(n => {
          const ov = v.nodeOverrides?.[n.id];
          const count = ov ? overrideCount({ nodeOverrides: { [n.id]: ov } }) : 0;
          return `<div class="node-tree-item">
            <span>节点 ${esc(n.id)}</span>
            <span class="muted">${count ? `已配置 ${count} 项` : '未配置'}</span>
            <button class="link-btn" type="button" onclick="openOverride('${esc(n.id)}')">编辑</button>
          </div>`;
        }).join('') : '<div class="cell-muted">请先在对话流中创建消息节点</div>'}
      </div>
    </div>
    <input type="hidden" id="v-json" value="${esc(JSON.stringify(v))}" />`;
  document.getElementById('variantDrawerBody').addEventListener('input', () => { dirty = true; });
  refreshIcons();
}

function readVariantWorking() {
  const v = JSON.parse(document.getElementById('v-json').value);
  v.key = (document.getElementById('v-key')?.value || v.key).trim();
  v.name = (document.getElementById('v-name')?.value || v.name).trim();
  v.status = document.querySelector('input[name="v-status"]:checked')?.value || 'active';
  return v;
}

function saveVariantMeta() {
  const v = readVariantWorking();
  fieldError('err-vkey', '');
  if (!editingKey) {
    if (!isIdToken(v.key, 20)) {
      fieldError('err-vkey', '必须以字母开头，长度 1-20');
      return;
    }
    if (variantByKey(v.key)) {
      fieldError('err-vkey', '该变体 Key 已存在');
      return;
    }
  }
  if (!v.name) {
    showToast('请输入变体名称', 'err');
    return;
  }
  if (editingKey) {
    const cur = variantByKey(editingKey);
    cur.name = v.name;
    cur.status = v.status;
    cur.nodeOverrides = v.nodeOverrides || {};
  } else {
    flow.variants.push({ key: v.key, name: v.name, status: v.status, nodeOverrides: v.nodeOverrides || {} });
  }
  flow.updatedAt = nowTs();
  saveStore();
  dirty = false;
  closeDrawer('variantDrawer');
  showToast('保存成功');
  render();
}

function openOverride(nodeId) {
  const v = readVariantWorking();
  document.getElementById('v-json').value = JSON.stringify(v);
  overrideNodeId = nodeId;
  const node = nodeById(flow, nodeId);
  const ov = clone(v.nodeOverrides?.[nodeId] || { cards: [] });
  document.getElementById('overrideDrawerTitle').textContent = `节点覆盖 · ${nodeId}`;
  document.getElementById('overrideDrawerBody').innerHTML = (node.cards || []).map((card, i) => {
    const oc = ov.cards?.[i] || {};
    const btnRows = (card.buttons || []).map(btn => {
      const ob = oc.buttons?.[btn.id] || {};
      return `<div class="field">
        <label class="field-label">按钮「${esc(btn.text)}」文案覆盖</label>
        <input class="input ov-btn-text" data-btn="${esc(btn.id)}" maxlength="25" placeholder="空则沿用 default" value="${esc(ob.text || '')}" />
        ${btn.event === 'open_bp' ? `<label class="field-label" style="margin-top:8px">按钮参数覆盖（BP URL）</label>
          <input class="input ov-btn-param" data-btn="${esc(btn.id)}" placeholder="空则沿用 default" value="${esc(ob.paramBpUrl || '')}" />` : ''}
      </div>`;
    }).join('');
    return `<div class="msg-card">
      <div class="msg-card-head">卡片 ${i + 1}（覆盖 default，空则回退）</div>
      <div class="field">
        <label class="field-label">图片覆盖</label>
        <select class="select ov-image">${IMAGE_PRESETS.map(p => optionHtml(p.value, p.value ? p.label : '不覆盖', oc.image || '')).join('')}</select>
      </div>
      <div class="field">
        <label class="field-label">标题覆盖</label>
        <input class="input ov-title" maxlength="40" placeholder="空则沿用 default" value="${esc(oc.title || '')}" />
      </div>
      <div class="field">
        <label class="field-label">副标覆盖</label>
        <input class="input ov-sub" maxlength="60" placeholder="空则沿用 default" value="${esc(oc.subtitle || '')}" />
      </div>
      ${btnRows}
    </div>`;
  }).join('') || '<div class="cell-muted">该节点无卡片</div>';
  openDrawer('overrideDrawer');
}

function saveOverride() {
  const v = readVariantWorking();
  const cards = [...document.querySelectorAll('#overrideDrawerBody .msg-card')].map(el => {
    const buttons = {};
    el.querySelectorAll('.ov-btn-text').forEach(inp => {
      const id = inp.dataset.btn;
      buttons[id] = buttons[id] || {};
      if (inp.value.trim()) buttons[id].text = inp.value.trim();
    });
    el.querySelectorAll('.ov-btn-param').forEach(inp => {
      const id = inp.dataset.btn;
      buttons[id] = buttons[id] || {};
      if (inp.value.trim()) buttons[id].paramBpUrl = inp.value.trim();
    });
    Object.keys(buttons).forEach(k => {
      if (!buttons[k].text && !buttons[k].paramBpUrl) delete buttons[k];
    });
    return {
      image: el.querySelector('.ov-image')?.value || '',
      title: el.querySelector('.ov-title')?.value.trim() || '',
      subtitle: el.querySelector('.ov-sub')?.value.trim() || '',
      buttons
    };
  });
  v.nodeOverrides = v.nodeOverrides || {};
  v.nodeOverrides[overrideNodeId] = { cards };
  document.getElementById('v-json').value = JSON.stringify(v);
  dirty = true;
  closeDrawer('overrideDrawer');
  renderVariantForm(v);
  showToast('覆盖已写入草稿，请点击保存生效');
}

async function maybeCloseVariant() {
  if (!dirty) return true;
  return confirmModal({ title: '确认取消？', message: '表单有未保存的改动', confirmText: '确认离开', danger: false });
}

async function deleteVariant(key) {
  if (key === 'default') {
    showToast('default 不可删', 'err');
    return;
  }
  const refs = variantRefCount(flow.id, key);
  if (refs > 0) {
    showToast('该变体被策略引用，请先解除引用', 'err');
    return;
  }
  const v = variantByKey(key);
  const ok = await confirmModal({ title: `确认删除变体 ${v?.name || key}？`, confirmText: '确认删除' });
  if (!ok) return;
  flow.variants = flow.variants.filter(x => x.key !== key);
  flow.updatedAt = nowTs();
  saveStore();
  showToast('删除成功');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('variants');
  bindDrawerClose({ beforeClose: id => id === 'variantDrawer' ? maybeCloseVariant() : true });
  document.getElementById('variantSaveBtn').addEventListener('click', saveVariantMeta);
  document.getElementById('variantCancelBtn').addEventListener('click', async () => {
    if (await maybeCloseVariant()) closeDrawer('variantDrawer');
  });
  document.getElementById('overrideSaveBtn').addEventListener('click', saveOverride);
  render();
  if (qs('new') === '1') openVariant(null);
});

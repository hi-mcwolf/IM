/* IM 后台公共逻辑：侧栏、顶栏、抽屉、Toast、确认框 */

const IM_NAV = [
  {
    key: 'bot',
    label: '系统管理',
    icon: 'bot',
    children: [
      { key: 'bots', label: '令牌集成', href: 'index.html' }
    ]
  },
  {
    key: 'takeover',
    label: 'Bot管理',
    icon: 'git-branch',
    children: [
      { key: 'scenes', label: '来源管理', href: 'scenes.html' },
      { key: 'strategies', label: '策略管理', href: 'strategies.html' },
      { key: 'flows', label: '对话流', href: 'flows.html' }
    ]
  }
];

const FLOW_NAV_KEYS = ['flows', 'flow-editor'];

function renderSidebar(activeKey) {
  const host = document.getElementById('sidebar');
  if (!host) return;
  host.className = 'sidebar';

  const menuHtml = IM_NAV.map(group => {
    const childActive = group.children.some(c => c.key === activeKey || (FLOW_NAV_KEYS.includes(activeKey) && c.key === 'flows'));
    const open = childActive ? ' open' : '';
    const items = group.children.map(item => {
      const on = item.key === activeKey || (FLOW_NAV_KEYS.includes(activeKey) && item.key === 'flows');
      return `<a class="sub-item${on ? ' active' : ''}" href="${item.href}">${item.label}</a>`;
    }).join('');
    return `
      <div class="menu-group${open}">
        <button class="sb-item${childActive ? ' active' : ''}" type="button" data-group="${group.key}">
          <i data-lucide="${group.icon}"></i>${group.label}
          <i data-lucide="chevron-down" class="chev"></i>
        </button>
        <div class="submenu">${items}</div>
      </div>`;
  }).join('');

  host.innerHTML = `
    <div class="sb-brand"><i data-lucide="bot"></i>Digiplus</div>
    <nav class="sb-menu">${menuHtml}</nav>
  `;

  host.querySelectorAll('[data-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.menu-group')?.classList.toggle('open');
    });
  });
}

function renderTopbar() {
  const host = document.getElementById('topbar');
  if (!host) return;
  host.className = 'topbar';
  host.innerHTML = `
    <nav class="topbar-menu">
      <a class="topbar-item active" href="index.html">IM管理</a>
    </nav>
    <div class="topbar-user"><span class="avatar">M</span>marvin@</div>
  `;
}

function initShell(activeKey) {
  renderSidebar(activeKey);
  renderTopbar();
  ensureModalHost();
  refreshIcons();
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function qs(name, fallback = '') {
  const v = new URLSearchParams(location.search).get(name);
  return v == null ? fallback : v;
}

/* ---- 抽屉 ---- */
function openDrawer(id) {
  const root = document.getElementById(id);
  if (!root) return;
  root.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer(id) {
  const root = document.getElementById(id);
  if (!root) return;
  root.classList.remove('open');
  if (!document.querySelector('.drawer-root.open')) {
    document.body.style.overflow = '';
  }
}

function bindDrawerClose(options = {}) {
  document.querySelectorAll('.drawer-root').forEach(root => {
    root.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', async () => {
        if (typeof options.beforeClose === 'function') {
          const ok = await options.beforeClose(root.id);
          if (!ok) return;
        }
        closeDrawer(root.id);
      });
    });
  });
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.modal-root.open')) return;
  const open = [...document.querySelectorAll('.drawer-root.open')];
  if (!open.length) return;
  closeDrawer(open[open.length - 1].id);
});

/* ---- Toast ---- */
let toastTimer = null;
function showToast(msg, type) {
  let el = document.querySelector('body > .toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.classList.toggle('err', type === 'err');
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---- 确认弹窗 ---- */
function ensureModalHost() {
  if (!document.getElementById('modal-host')) {
    const host = document.createElement('div');
    host.id = 'modal-host';
    document.body.appendChild(host);
  }
}

function confirmModal({ title, message = '', confirmText = '确认删除', danger = true } = {}) {
  ensureModalHost();
  return new Promise(resolve => {
    const host = document.getElementById('modal-host');
    const wrap = document.createElement('div');
    wrap.className = 'modal-root open';
    wrap.innerHTML = `
      <div class="modal-mask"></div>
      <div class="modal-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">${esc(title || '确认')}</h3>
        ${message ? `<p class="modal-message">${esc(message)}</p>` : ''}
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" data-act="cancel">取消</button>
          <button class="btn ${danger ? 'btn-primary' : 'btn-primary'}" type="button" data-act="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    host.appendChild(wrap);
    const finish = val => {
      wrap.remove();
      resolve(val);
    };
    wrap.querySelector('[data-act="ok"]').addEventListener('click', () => finish(true));
    wrap.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(false));
    wrap.querySelector('.modal-mask').addEventListener('click', () => finish(false));
    const onKey = ev => {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        finish(false);
      }
    };
    document.addEventListener('keydown', onKey);
  });
}

function statusTag(status) {
  const map = {
    active: { label: '启用', cls: 'tag-success' },
    enabled: { label: '启用', cls: 'tag-success' },
    disabled: { label: '停用', cls: 'tag-gray' },
    draft: { label: '草稿', cls: 'tag-info' },
    published: { label: '已发布', cls: 'tag-success' },
    offline: { label: '下线', cls: 'tag-gray' },
    SUCCESS: { label: 'SUCCESS', cls: 'tag-success' },
    normal: { label: '普通', cls: 'tag-info' },
    bind: { label: '绑定', cls: 'tag-warning' },
    fallback: { label: '兜底', cls: 'tag-warning' },
    system: { label: '系统保留', cls: 'tag-warning' }
  };
  const item = map[status] || { label: status || '-', cls: 'tag-gray' };
  return `<span class="tag ${item.cls}">${esc(item.label)}</span>`;
}

function renderPagination(total, page, pageSize, onClickName) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  let btns = `<button class="page-btn" type="button" ${p <= 1 ? 'disabled' : ''} onclick="${onClickName}(${p - 1})">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - p) > 2 && i !== 1 && i !== pages) {
      if (i === 2 || i === pages - 1) btns += `<span class="page-total">…</span>`;
      continue;
    }
    btns += `<button class="page-btn${i === p ? ' active' : ''}" type="button" onclick="${onClickName}(${i})">${i}</button>`;
  }
  btns += `<button class="page-btn" type="button" ${p >= pages ? 'disabled' : ''} onclick="${onClickName}(${p + 1})">›</button>`;
  return `<div class="table-footer"><span class="page-total">共 ${total} 条</span><div class="pagination">${btns}</div></div>`;
}

function fieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  const wrap = el.closest('.field') || el.closest('.cell-edit');
  if (wrap) wrap.classList.toggle('has-error', !!msg);
}

function fixedPinHtml() {
  return `<span class="fixed-mark" title="固定"><i data-lucide="pin"></i></span>`;
}

function optionHtml(value, label, selected) {
  return `<option value="${esc(value)}"${String(selected) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
}

function readQueryFilters(keys) {
  const sp = new URLSearchParams(location.search);
  const o = {};
  keys.forEach(k => { o[k] = sp.get(k) || ''; });
  return o;
}

function writeQueryFilters(obj) {
  const sp = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v) sp.set(k, v); });
  const q = sp.toString();
  history.replaceState(null, '', q ? `${location.pathname}?${q}` : location.pathname);
}

function boolLabel(v) {
  return v ? '是' : '否';
}

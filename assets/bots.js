/* 社交聊天机器人列表 + 自动登录配置 */

const botState = {
  filters: { pl: '', botName: '', botToken: '', botUsername: '', platform: '' },
  al: { open: false, botId: null, editingKey: null }
};

function getBot(id) {
  return DB.bots.find(b => b.id === id);
}

function platformLabel(key) {
  const map = { tg: 'Telegram', wa: 'WhatsApp', vb: 'Viber', ms: 'Messenger' };
  return map[key] || key;
}

function renderPlatformIcons(platforms) {
  return `<span class="platform-icons">${(platforms || []).map(p =>
    `<span class="platform-dot ${esc(p)}" title="${esc(platformLabel(p))}">${esc(p === 'tg' ? 'T' : p === 'wa' ? 'W' : p === 'vb' ? 'V' : 'M')}</span>`
  ).join('')}</span>`;
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function closeAutoLoginModal() {
  botState.al = { open: false, botId: null, editingKey: null };
  closeDrawer('al-drawer');
}

function onDrawerMaskClick() {
  if (botState.al.editingKey) {
    showToast('请先保存或取消当前编辑', 'err');
    return;
  }
  closeAutoLoginModal();
}

function openAutoLoginConfig(botId) {
  const bot = getBot(botId);
  if (!bot) {
    showToast('未找到该 Bot', 'err');
    return;
  }
  botState.al = { open: true, botId, editingKey: null };
  renderAutoLoginModal();
  openDrawer('al-drawer');
}

function renderAutoLoginModal() {
  const { botId, editingKey } = botState.al;
  const bot = getBot(botId);
  if (!bot) {
    closeAutoLoginModal();
    return;
  }

  const pages = bot.autoLoginPages || [];
  const isCreating = editingKey === '__new__';
  const isEditing = !!editingKey;

  const rowsHtml = pages.map(p => {
    if (editingKey === p.id) return renderEditRow(botId, p.id, p);
    return `
      <tr>
        <td>${esc(p.autoLoginUrl)}</td>
        <td class="col-ops">
          <button class="link-btn" type="button" ${isEditing ? 'disabled' : ''} onclick="startInlineEdit('${esc(botId)}','${esc(p.id)}')">编辑</button>
          <button class="link-btn link-btn-danger" type="button" ${isEditing ? 'disabled' : ''} onclick="deleteAutoLoginPage('${esc(botId)}','${esc(p.id)}')">删除</button>
        </td>
      </tr>`;
  }).join('');

  const emptyRow = !pages.length && !isCreating
    ? `<tr><td colspan="2"><div class="table-empty">暂无自动登录页面，请点击上方「新增」</div></td></tr>`
    : '';
  const newRow = isCreating ? renderEditRow(botId, '__new__', { autoLoginUrl: '' }) : '';

  document.getElementById('al-drawer-title').textContent = `自动登录配置 · ${bot.botName}`;
  document.getElementById('al-drawer-body').innerHTML = `
    <div class="al-toolbar">
      <button class="btn btn-primary" type="button" ${isEditing ? 'disabled' : ''} onclick="startInlineCreate('${esc(botId)}')">
        <i data-lucide="plus"></i>新增
      </button>
    </div>
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th style="min-width:260px;">自动登录URL<span class="req">*</span></th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}${emptyRow}${newRow}</tbody>
      </table>
    </div>`;
  refreshIcons();
  if (isEditing) {
    setTimeout(() => document.getElementById('al-inline-url')?.focus(), 0);
  }
}

function renderEditRow(botId, key, data) {
  return `
    <tr class="al-row-editing">
      <td>
        <div class="cell-edit" id="al-url-cell">
          <input class="input" id="al-inline-url" type="text" placeholder="请输入自动登录页面URL" value="${esc(data.autoLoginUrl || '')}" />
          <div class="field-error" id="al-url-error"></div>
        </div>
      </td>
      <td class="col-ops">
        <button class="link-btn" type="button" onclick="saveInlineRow('${esc(botId)}','${esc(key)}')">保存</button>
        <button class="link-btn" type="button" onclick="cancelInlineEdit()">取消</button>
      </td>
    </tr>`;
}

function startInlineCreate(botId) {
  if (botState.al.editingKey) {
    showToast('请先保存或取消当前编辑', 'err');
    return;
  }
  botState.al.botId = botId;
  botState.al.editingKey = '__new__';
  renderAutoLoginModal();
}

function startInlineEdit(botId, pageId) {
  if (botState.al.editingKey) {
    showToast('请先保存或取消当前编辑', 'err');
    return;
  }
  botState.al.botId = botId;
  botState.al.editingKey = pageId;
  renderAutoLoginModal();
}

function cancelInlineEdit() {
  botState.al.editingKey = null;
  renderAutoLoginModal();
}

function saveInlineRow(botId, editingKey) {
  const bot = getBot(botId);
  if (!bot) return;
  const autoLoginUrl = (document.getElementById('al-inline-url')?.value || '').trim();
  const err = document.getElementById('al-url-error');
  const cell = document.getElementById('al-url-cell');
  if (err) err.textContent = '';
  cell?.classList.remove('has-error');
  if (!autoLoginUrl) {
    cell?.classList.add('has-error');
    if (err) err.textContent = '请输入自动登录URL';
    return;
  }
  if (!isValidUrl(autoLoginUrl)) {
    cell?.classList.add('has-error');
    if (err) err.textContent = '请输入正确的URL地址';
    return;
  }
  if (!bot.autoLoginPages) bot.autoLoginPages = [];
  if (editingKey === '__new__') {
    bot.autoLoginPages.push({
      id: nextId('al'),
      autoLoginUrl,
      pageType: 'H5',
      palCode: nextId('PAL').toUpperCase()
    });
    showToast('自动登录页面已新增');
  } else {
    const page = bot.autoLoginPages.find(p => p.id === editingKey);
    if (!page) {
      showToast('未找到该自动登录页面', 'err');
      return;
    }
    page.autoLoginUrl = autoLoginUrl;
    showToast('自动登录页面已更新');
  }
  saveStore();
  botState.al.editingKey = null;
  renderAutoLoginModal();
}

async function deleteAutoLoginPage(botId, pageId) {
  if (botState.al.editingKey) {
    showToast('请先保存或取消当前编辑', 'err');
    return;
  }
  const bot = getBot(botId);
  if (!bot) return;
  const idx = (bot.autoLoginPages || []).findIndex(p => p.id === pageId);
  if (idx < 0) return;
  const ok = await confirmModal({ title: '确认删除该自动登录页面？', confirmText: '确认删除' });
  if (!ok) return;
  bot.autoLoginPages.splice(idx, 1);
  saveStore();
  renderAutoLoginModal();
  showToast('已删除');
}

function applyFilters() {
  botState.filters.pl = document.getElementById('f-pl')?.value || '';
  botState.filters.botName = (document.getElementById('f-bot-name')?.value || '').trim();
  botState.filters.botToken = (document.getElementById('f-bot-token')?.value || '').trim();
  botState.filters.botUsername = (document.getElementById('f-bot-username')?.value || '').trim();
  botState.filters.platform = document.getElementById('f-platform')?.value || '';
  renderBotList();
}

function resetFilters() {
  botState.filters = { pl: '', botName: '', botToken: '', botUsername: '', platform: '' };
  renderBotList();
}

function filterBots() {
  const f = botState.filters;
  return DB.bots.filter(b => {
    if (f.pl && b.productLineId !== f.pl) return false;
    if (f.botName && !b.botName.toLowerCase().includes(f.botName.toLowerCase())) return false;
    if (f.botToken && !b.botToken.toLowerCase().includes(f.botToken.toLowerCase())) return false;
    if (f.botUsername && !b.botUsername.toLowerCase().includes(f.botUsername.toLowerCase())) return false;
    if (f.platform && !(b.platforms || []).includes(f.platform)) return false;
    return true;
  });
}

function renderBotList() {
  const list = filterBots();
  const f = botState.filters;
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">令牌集成</h1>
        <p class="page-desc">管理各平台 Bot 的接入信息，并为 Bot 配置自动登录页面</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" type="button" onclick="showToast('原型未接创建','err')">
          <i data-lucide="plus"></i>创建
        </button>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <select class="select" id="f-pl">
            <option value="">全部</option>
            ${productLineOptions(f.pl)}
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot Name</span>
          <input class="input" id="f-bot-name" type="text" placeholder="请输入Bot Name" value="${esc(f.botName)}" />
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot Token</span>
          <input class="input" id="f-bot-token" type="text" placeholder="请输入Bot Token" value="${esc(f.botToken)}" />
        </div>
        <div class="filter-item">
          <span class="filter-label">Bot Username</span>
          <input class="input" id="f-bot-username" type="text" placeholder="请输入Bot Username" value="${esc(f.botUsername)}" />
        </div>
        <div class="filter-item">
          <span class="filter-label">Platform</span>
          <select class="select" id="f-platform">
            <option value="">全部</option>
            <option value="tg"${f.platform === 'tg' ? ' selected' : ''}>Telegram</option>
            <option value="wa"${f.platform === 'wa' ? ' selected' : ''}>WhatsApp</option>
            <option value="vb"${f.platform === 'vb' ? ' selected' : ''}>Viber</option>
            <option value="ms"${f.platform === 'ms' ? ' selected' : ''}>Messenger</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="button" onclick="applyFilters()">搜索</button>
          <button class="btn btn-outline" type="button" onclick="resetFilters()">重置</button>
        </div>
      </div>
    </section>
    <section class="card table-card">
      <h4 class="card-title">Bot 列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>产品线</th>
              <th>Bot Name</th>
              <th>Bot Token</th>
              <th>Bot Username</th>
              <th>Platform</th>
              <th>Status</th>
              <th>Create Time</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(b => `
              <tr>
                <td>${esc(productLineById(b.productLineId)?.name || b.productLineId || '-')}</td>
                <td>${esc(b.botName)}</td>
                <td>${esc(b.botToken)}</td>
                <td>${esc(b.botUsername)}</td>
                <td>${renderPlatformIcons(b.platforms)}</td>
                <td>${statusTag(b.status)}</td>
                <td>${esc(b.createTime)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openAutoLoginConfig('${esc(b.id)}')">自动登录</button>
                  <button class="link-btn" type="button" onclick="showToast('原型未接 Bot 编辑','err')">编辑</button>
                  <button class="link-btn link-btn-danger" type="button" onclick="showToast('原型未接 Bot 删除','err')">删除</button>
                </td>
              </tr>`).join('') : `<tr><td colspan="8"><div class="table-empty">暂无数据</div></td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderPagination(list.length, 1, 20, 'noopPage')}
    </section>`;
  refreshIcons();
}

function noopPage() { /* single page mock */ }

document.addEventListener('DOMContentLoaded', () => {
  initShell('bots');
  renderBotList();
});

/* 对话流列表 */

const PAGE_SIZE = 20;
let page = 1;
let filters = { keyword: '', type: '', status: '' };

function filteredFlows() {
  const kw = filters.keyword.toLowerCase();
  return normalFlows()
    .filter(f => {
      if (kw && !f.id.toLowerCase().includes(kw) && !f.name.toLowerCase().includes(kw)) return false;
      if (filters.type && f.type !== filters.type) return false;
      if (filters.status && f.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function applyQuery() {
  filters.keyword = (document.getElementById('f-kw')?.value || '').trim();
  filters.type = document.getElementById('f-type')?.value || '';
  filters.status = document.getElementById('f-status')?.value || '';
  page = 1;
  render();
}

function resetQuery() {
  filters = { keyword: '', type: '', status: '' };
  page = 1;
  render();
}

function gotoPage(p) {
  page = p;
  render();
}

function canPublish(flow) {
  const hasFirst = !!flow.firstScreenNodeId && firstScreenCandidates(flow).some(n => n.id === flow.firstScreenNodeId);
  const hasMenu = !!flow.mainMenuKeyboardId && keyboardNodes(flow).some(n => n.id === flow.mainMenuKeyboardId);
  const hasVariant = (flow.variants || []).some(v => v.key === 'default');
  return hasFirst && hasMenu && hasVariant;
}

function render() {
  const all = filteredFlows();
  const start = (page - 1) * PAGE_SIZE;
  const list = all.slice(start, start + PAGE_SIZE);
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">对话流（新）</h1>
        <p class="page-desc">配置 Bot 承接结构：首屏、节点、按钮、主菜单键盘与变体</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" type="button" onclick="location.href='flow-editor.html'">
          <i data-lucide="plus"></i>新建对话流
        </button>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">搜索</span>
          <input class="input" id="f-kw" maxlength="30" placeholder="请输入对话流名称或 Id" value="${esc(filters.keyword)}" />
        </div>
        <div class="filter-item">
          <span class="filter-label">类型</span>
          <select class="select" id="f-type">
            <option value="">全部</option>
            <option value="normal"${filters.type === 'normal' ? ' selected' : ''}>普通</option>
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <select class="select" id="f-status">
            <option value="">全部</option>
            <option value="draft"${filters.status === 'draft' ? ' selected' : ''}>草稿</option>
            <option value="published"${filters.status === 'published' ? ' selected' : ''}>已发布</option>
            <option value="offline"${filters.status === 'offline' ? ' selected' : ''}>下线</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" type="button" onclick="applyQuery()">查询</button>
          <button class="btn btn-outline" type="button" onclick="resetQuery()">重置</button>
        </div>
      </div>
    </section>
    <section class="card table-card">
      <h4 class="card-title">对话流列表</h4>
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>Id</th>
              <th>名称</th>
              <th>类型</th>
              <th>首屏节点</th>
              <th>节点</th>
              <th>变体</th>
              <th>状态</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(f => {
              const refs = flowRefCount(f.id);
              const published = f.status === 'published';
              const canDel = !published && refs === 0;
              const canOffline = published && refs === 0;
              const canPub = (f.status === 'draft' || f.status === 'offline') && canPublish(f);
              const nodeCount = messageNodes(f).length;
              return `<tr>
                <td>${esc(f.id)}</td>
                <td>${esc(f.name)}</td>
                <td>${statusTag(f.type)}</td>
                <td>${esc(f.firstScreenNodeId || '-')}</td>
                <td>${nodeCount}</td>
                <td>${(f.variants || []).length}</td>
                <td>${statusTag(f.status)}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="location.href='flow-editor.html?id=${encodeURIComponent(f.id)}'">编辑</button>
                  <button class="link-btn" type="button" onclick="copyFlow('${esc(f.id)}')">复制</button>
                  ${f.status !== 'published' ? `<button class="link-btn" type="button" ${canPub ? '' : 'disabled'} onclick="publishFlow('${esc(f.id)}')">发布</button>` : ''}
                  ${published ? `<button class="link-btn" type="button" ${canOffline ? '' : `disabled title="该对话流被 ${refs} 条策略引用,请先解除引用"`} onclick="offlineFlow('${esc(f.id)}')">下线</button>` : ''}
                  <button class="link-btn link-btn-danger" type="button" ${canDel ? '' : 'disabled'} onclick="deleteFlow('${esc(f.id)}')">删除</button>
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

async function copyFlow(id) {
  const f = flowById(id);
  if (!f || f.type === 'system') {
    showToast('系统保留类型不可复制', 'err');
    return;
  }
  const ok = await confirmModal({ title: `确认复制对话流 ${f.name}？`, confirmText: '确认复制', danger: false });
  if (!ok) return;
  let newId = `${f.id}_copy`;
  let n = 2;
  while (flowById(newId)) {
    newId = `${f.id}_copy${n}`;
    n += 1;
  }
  const copy = clone(f);
  copy.id = newId;
  copy.name = `${f.name} 副本`;
  copy.status = 'draft';
  copy.type = 'normal';
  copy.updatedAt = nowTs();
  DB.flows.push(copy);
  saveStore();
  showToast('已创建副本');
  render();
}

function publishFlow(id) {
  const f = flowById(id);
  if (!f) return;
  if (!canPublish(f)) {
    showToast('发布前必须配置首屏节点、主菜单键盘、至少 1 个变体', 'err');
    return;
  }
  f.status = 'published';
  f.updatedAt = nowTs();
  saveStore();
  showToast('已发布');
  render();
}

async function offlineFlow(id) {
  const f = flowById(id);
  if (!f) return;
  const refs = flowRefCount(id);
  if (refs > 0) {
    showToast(`该对话流被 ${refs} 条策略引用,请先解除引用`, 'err');
    return;
  }
  const ok = await confirmModal({ title: `确认下线对话流 ${f.name}？`, confirmText: '确认下线', danger: false });
  if (!ok) return;
  f.status = 'offline';
  f.updatedAt = nowTs();
  saveStore();
  showToast('已下线');
  render();
}

async function deleteFlow(id) {
  const f = flowById(id);
  if (!f) return;
  if (f.type === 'system' || f.status === 'published' || flowRefCount(id) > 0) {
    showToast('系统保留 / 被引用 / 已发布状态下不可删除', 'err');
    return;
  }
  const ok = await confirmModal({ title: `确认删除对话流 ${f.name}？`, confirmText: '确认删除' });
  if (!ok) return;
  DB.flows = DB.flows.filter(x => x.id !== id);
  saveStore();
  showToast('删除成功');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initShell('flows');
  render();
});

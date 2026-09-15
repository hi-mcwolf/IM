/* 老对话流：只读列表 + 预览 */

function btnSummary(b) {
  const extra = b.event === 'open_node' ? b.paramNodeId
    : b.event === 'open_flow' ? `${b.paramFlowId}${b.paramVariantKey ? '+' + b.paramVariantKey : ''}`
    : b.event === 'open_bp' ? b.paramBpUrl
    : '';
  return `${b.text} · ${eventLabel(b.event)}${extra ? ' → ' + extra : ''}`;
}

function render() {
  const list = systemFlows();
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">对话流</h1>
        <p class="page-desc">原系统硬编码对话流，后台只读，不可新增 / 编辑 / 删除 / 下线</p>
      </div>
    </div>
    <section class="card table-card">
      <div class="table-scroll">
        <table class="table table-nowrap">
          <thead>
            <tr>
              <th>对话流 Id</th>
              <th>名称</th>
              <th>用途</th>
              <th class="col-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(f => `
              <tr>
                <td>${esc(f.id)}</td>
                <td>${esc(f.name)}</td>
                <td>${esc(f.purpose || '')}</td>
                <td class="col-ops">
                  <button class="link-btn" type="button" onclick="openPreview('${esc(f.id)}')">查看</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
  refreshIcons();
}

function openPreview(id) {
  const f = flowById(id);
  if (!f) return;
  const first = nodeById(f, f.firstScreenNodeId);
  const menu = nodeById(f, f.mainMenuKeyboardId);
  const nodes = messageNodes(f);
  const host = document.getElementById('preview-host');
  host.innerHTML = `
    <div class="modal-root open preview-modal" id="sysPreview">
      <div class="modal-mask" data-close-preview></div>
      <div class="modal-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">预览 · ${esc(f.name)}</h3>
        <div class="preview-block">
          <h4>基本信息</h4>
          <dl class="preview-kv">
            <dt>对话流 Id</dt><dd>${esc(f.id)}</dd>
            <dt>用途</dt><dd>${esc(f.purpose || '')}</dd>
            <dt>状态</dt><dd>只读 / 已发布</dd>
          </dl>
        </div>
        <div class="preview-block">
          <h4>首屏节点</h4>
          <dl class="preview-kv">
            <dt>节点</dt><dd>${esc(first ? `${first.name} (${first.id})` : '-')}</dd>
            <dt>标题</dt><dd>${esc(first?.cards?.[0]?.title || '-')}</dd>
            <dt>按钮</dt><dd>${esc((first?.cards?.[0]?.buttons || []).map(btnSummary).join('；') || '-')}</dd>
          </dl>
        </div>
        <div class="preview-block">
          <h4>主菜单键盘</h4>
          <dl class="preview-kv">
            <dt>键盘</dt><dd>${esc(menu ? `${menu.name} (${menu.id})` : '-')}</dd>
            <dt>按钮事件</dt><dd>${esc((menu?.buttons || []).map(btnSummary).join('；') || '-')}</dd>
          </dl>
        </div>
        <div class="preview-block">
          <h4>普通节点</h4>
          <dl class="preview-kv">
            ${nodes.map(n => `<dt>${esc(n.id)}</dt><dd>${esc(n.name)} · ${(n.cards || []).length} 张卡片</dd>`).join('') || '<dt>-</dt><dd>无</dd>'}
          </dl>
        </div>
        <div class="preview-block">
          <h4>变体集</h4>
          <dl class="preview-kv">
            ${(f.variants || []).map(v => `<dt>${esc(v.key)}</dt><dd>${esc(v.name)}</dd>`).join('')}
          </dl>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" type="button" data-close-preview>关闭</button>
        </div>
      </div>
    </div>`;
  host.querySelectorAll('[data-close-preview]').forEach(el => el.addEventListener('click', closePreview));
}

function closePreview() {
  const host = document.getElementById('preview-host');
  host.innerHTML = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePreview();
});

document.addEventListener('DOMContentLoaded', () => {
  initShell('sys-flows');
  render();
});

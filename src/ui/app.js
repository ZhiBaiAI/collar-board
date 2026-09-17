// 应用装配：侧边栏项目管理、视图切换、抽屉明细、刷新与授权恢复。

import { collectFiles } from '../fs/collect.js';
import { buildModel, inspectProject } from '../parse/model.js';
import {
  checkPermission,
  listProjects,
  projectIdFor,
  removeProject,
  saveProject,
} from '../fs/registry.js';
import { el, escapeHtml } from './format.js';
import { renderOverview } from './views/overview.js';
import { renderMap, renderModuleDetail } from './views/map.js';
import { renderDecisions, renderDecisionDetail } from './views/decisions.js';
import { renderTimeline } from './views/timeline.js';
import { renderFindings } from './views/findings.js';
import { renderInflight } from './views/inflight.js';
import { renderRunbook } from './views/runbook.js';

const TABS = [
  { id: 'overview', label: '总览' },
  { id: 'map', label: '业务地图' },
  { id: 'inflight', label: '在途变更' },
  { id: 'decisions', label: '决策脉络' },
  { id: 'runbook', label: '架构与排障' },
  { id: 'timeline', label: '变更时间线' },
  { id: 'findings', label: '结构事实' },
];

const state = {
  projects: [],
  activeId: null,
  models: new Map(), // id → 已解析的模型（内存缓存，避免每次切页重扫）
  tab: 'overview',
  scanning: false,
};

const dom = {};

/* ------------------------------------------------------------------ */
/* 侧边栏                                                              */
/* ------------------------------------------------------------------ */

function projectHealth(record) {
  const model = state.models.get(record.id);
  if (!model) return 'idle';
  if (model.findings.counts.high > 0) return 'danger';
  if (model.findings.counts.medium > 0) return 'warn';
  return 'ok';
}

function renderSidebar() {
  const list = dom.projectList;
  list.innerHTML = '';

  if (!state.projects.length) {
    list.innerHTML = `<div class="hint" style="padding:10px 12px;line-height:1.7">
      还没有导入项目。<br />点击下方按钮选择规范项目的根目录。
    </div>`;
    return;
  }

  for (const record of state.projects) {
    const model = state.models.get(record.id);
    const health = projectHealth(record);
    const item = el(`
      <button class="project-item ${record.id === state.activeId ? 'active' : ''}" data-project="${escapeHtml(record.id)}">
        <span class="pname">
          <span class="dot ${health}"></span>
          ${escapeHtml(record.name)}
        </span>
        <span class="pmeta">${
          model
            ? `${model.stats.modules} 个功能点 · ${model.stats.adrs} 条决策`
            : record.summary || '尚未读取'
        }</span>
      </button>`);

    const remove = el('<button class="ghost" title="从列表移除" style="position:absolute;top:6px;right:6px">✕</button>');
    remove.addEventListener('click', async (event) => {
      event.stopPropagation();
      state.models.delete(record.id);
      await removeProject(record.id);
      state.projects = state.projects.filter((p) => p.id !== record.id);
      if (state.activeId === record.id) {
        state.activeId = state.projects[0]?.id || null;
        renderAll();
      } else {
        renderSidebar();
      }
    });
    item.style.position = 'relative';
    item.appendChild(remove);

    item.addEventListener('click', () => activateProject(record.id));
    list.appendChild(item);
  }
}

/* ------------------------------------------------------------------ */
/* 扫描                                                                */
/* ------------------------------------------------------------------ */

function showScan(text, path = '') {
  const mask = el(`
    <div class="scan-mask">
      <div class="scan-box">
        <h3><span class="spinner"></span>${escapeHtml(text)}</h3>
        <div class="hint" style="margin:0">正在读取规范文档，只读操作，不会修改任何文件。</div>
        <div class="scan-path">${escapeHtml(path)}</div>
      </div>
    </div>`);
  document.body.appendChild(mask);
  return {
    update: (p) => {
      const node = mask.querySelector('.scan-path');
      if (node) node.textContent = p;
    },
    close: () => mask.remove(),
  };
}

async function scanProject(record, { silent = false } = {}) {
  if (state.scanning) return;
  state.scanning = true;
  const progress = silent ? { update() {}, close() {} } : showScan(`正在读取「${record.name}」`);

  try {
    const handle = record.handle;
    const files = await collectFiles(handle, { onProgress: (p) => progress.update(p) });
    progress.close();

    const compliance = inspectProject(files);
    const model = buildModel(files);
    model.compliance = compliance;

    state.models.set(record.id, model);
    const updated = {
      ...record,
      lastOpened: Date.now(),
      summary: `${model.stats.modules} 个功能点 · ${model.stats.adrs} 条决策`,
      compliance,
    };
    // 存储失败不应让看板不可用：本次会话照常展示，只是下次打开要重新导入
    try {
      await saveProject(updated);
      state.projects = state.projects.map((p) => (p.id === updated.id ? updated : p));
    } catch {
      state.projects = state.projects.map((p) =>
        p.id === updated.id ? { ...updated, handle: undefined } : p,
      );
      dom.notices.appendChild(
        el(`<div class="notice warn">
          <b>无法把这个项目记入浏览器存储。</b>
          本次会话仍可正常查看，但下次打开需要重新导入。
        </div>`),
      );
    }

    renderAll();
  } catch (err) {
    progress.close();
    showNotice('danger', `读取失败：${err.message}`);
  } finally {
    state.scanning = false;
  }
}

/* ------------------------------------------------------------------ */
/* 导入与激活                                                          */
/* ------------------------------------------------------------------ */

async function importProject() {
  clearNotices();
  if (!window.showDirectoryPicker) {
    showNotice(
      'danger',
      '当前浏览器不支持「选择文件夹」能力。该能力目前只在 Chrome、Edge 等 Chromium 内核浏览器中可用。',
    );
    return;
  }

  let handle;
  try {
    handle = await window.showDirectoryPicker({ mode: 'read' });
  } catch (err) {
    if (err.name !== 'AbortError') showNotice('danger', `无法打开目录：${err.message}`);
    return;
  }

  const id = projectIdFor(handle.name);
  const existing = state.projects.find((p) => p.id === id);
  const record = existing
    ? { ...existing, handle, lastOpened: Date.now() }
    : { id, name: handle.name, handle, lastOpened: Date.now() };

  if (!existing) state.projects.unshift(record);
  state.activeId = id;

  // 持久化交给 scanProject 统一处理，避免同一处失败弹两次提示
  await scanProject(record);

  const model = state.models.get(id);
  if (model && !model.compliance.isCompliant) {
    showNotice(
      'warn',
      `「${handle.name}」缺少部分规范结构，已按现有文件尽力展示。`,
      model.compliance.missing.map((m) => `${m.path}（${m.label}）`),
    );
  }
}

async function activateProject(id) {
  clearNotices();
  state.activeId = id;
  state.tab = state.tab || 'overview';

  // 已有内存缓存：直接展示
  if (state.models.has(id)) {
    renderAll();
    return;
  }

  const record = state.projects.find((p) => p.id === id);
  if (!record) return;

  // 恢复授权：浏览器要求由用户手势触发，因此这里必须是点击引发
  const permission = await checkPermission(record.handle, { request: true });
  if (permission !== 'granted') {
    showNotice(
      'warn',
      `需要重新授权才能读取「${record.name}」。浏览器在页面重新打开后会收回访问权限，请再次点击该项目并确认。`,
    );
    renderAll();
    return;
  }

  await scanProject(record);
}

/* ------------------------------------------------------------------ */
/* 主区域                                                              */
/* ------------------------------------------------------------------ */

function activeModel() {
  return state.activeId ? state.models.get(state.activeId) : null;
}

function showNotice(kind, message, items = []) {
  dom.notices.appendChild(
    el(`<div class="notice ${kind}">
      <b>${escapeHtml(message)}</b>
      ${items.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
    </div>`),
  );
}

/** 提示条只在用户发起新动作时清空，避免被重绘顺手抹掉。 */
function clearNotices() {
  dom.notices.innerHTML = '';
}

function renderTopbar(model) {
  const record = state.projects.find((p) => p.id === state.activeId);
  const meta = model
    ? `${model.stats.totalFiles} 个文档 · 读取于 ${new Date(model.generatedAt).toLocaleTimeString('zh-CN')}`
    : '';

  dom.topbar.innerHTML = `
    <div>
      <h2>${escapeHtml(record?.name || '未选择项目')}</h2>
      <div class="sub">${escapeHtml(meta)}</div>
    </div>
    <div class="spacer"></div>
    ${
      model
        ? `<button id="refresh-btn" title="重新读取项目文档">重新读取</button>`
        : ''
    }`;

  const refresh = dom.topbar.querySelector('#refresh-btn');
  if (refresh) {
    refresh.addEventListener('click', async () => {
      clearNotices();
      const rec = state.projects.find((p) => p.id === state.activeId);
      if (!rec) return;
      const permission = await checkPermission(rec.handle, { request: true });
      if (permission !== 'granted') {
        showNotice('warn', '需要授权才能重新读取。');
        return;
      }
      state.models.delete(rec.id);
      await scanProject(rec);
    });
  }
}

function renderTabs(model) {
  dom.tabs.innerHTML = TABS.map(
    (tab) => `<button class="tab ${tab.id === state.tab ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>`,
  ).join('');

  for (const button of dom.tabs.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => {
      state.tab = button.dataset.tab;
      renderTabs(model);
      renderView(model);
    });
  }
}

function renderView(model) {
  const view = dom.view;
  view.innerHTML = '';

  if (!model) {
    view.appendChild(
      el(`<div class="empty">
        <h2>选一个项目开始</h2>
        <p>看板只读取规范文档，不写入任何内容。</p>
        <ol>
          <li>点击左下角「导入项目」</li>
          <li>在系统弹窗中选择规范项目的<strong>根目录</strong></li>
          <li>看板自动读取并生成视图</li>
        </ol>
        <p style="margin-top:18px;font-size:12.5px">
          页面重新打开后，浏览器会收回目录访问权限，需要再次点击项目并确认一次，这是浏览器的安全机制。
        </p>
      </div>`),
    );
    return;
  }

  const container = el('<div></div>');
  const render = {
    overview: () => renderOverview(model),
    map: () => renderMap(model),
    inflight: () => renderInflight(model),
    decisions: () => renderDecisions(model),
    runbook: () => renderRunbook(model),
    timeline: () => renderTimeline(model),
    findings: () => renderFindings(model),
  }[state.tab];

  container.innerHTML = render();
  view.appendChild(container);

  wireViewEvents(container, model);
}

function wireViewEvents(container, model) {
  // 业务地图：功能点明细
  for (const card of container.querySelectorAll('[data-module]')) {
    card.addEventListener('click', () => {
      const detail = renderModuleDetail(model, card.dataset.module);
      if (detail) openDrawer(detail.title, detail.subtitle, detail.html);
    });
  }

  // 决策：ADR 明细
  for (const card of container.querySelectorAll('[data-adr]')) {
    card.addEventListener('click', () => {
      const detail = renderDecisionDetail(model, card.dataset.adr);
      if (detail) openDrawer(detail.title, detail.subtitle, detail.html);
    });
  }

  // 决策：状态筛选
  const adrFilters = container.querySelector('#adr-filters');
  if (adrFilters) {
    const cards = [...container.querySelectorAll('[data-adr]')];
    for (const chip of adrFilters.querySelectorAll('[data-adr-filter]')) {
      chip.addEventListener('click', () => {
        adrFilters.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.adrFilter;
        for (const card of cards) {
          const adr = model.decisions.adrs.find((a) => a.id === card.dataset.adr);
          const kind = adr ? adrFilterKind(adr) : 'other';
          card.style.display = filter === 'all' || kind === filter ? '' : 'none';
        }
      });
    }
  }

  // 结构事实：严重度筛选
  const findingFilters = container.querySelector('#finding-filters');
  if (findingFilters) {
    const rows = [...container.querySelectorAll('[data-severity]')];
    for (const chip of findingFilters.querySelectorAll('[data-finding-filter]')) {
      chip.addEventListener('click', () => {
        findingFilters.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.findingFilter;
        for (const row of rows) {
          row.style.display = filter === 'all' || row.dataset.severity === filter ? '' : 'none';
        }
      });
    }
  }

  // 排障剧本：症状关键词筛选
  const pbFilters = container.querySelector('#pb-filters');
  if (pbFilters) {
    const rows = [...container.querySelectorAll('[data-pb]')];
    for (const chip of pbFilters.querySelectorAll('[data-pb-filter]')) {
      chip.addEventListener('click', () => {
        pbFilters.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.pbFilter;
        for (const row of rows) {
          row.style.display =
            filter === 'all' || (row.dataset.pbKw || '').split(' ').includes(filter) ? '' : 'none';
        }
      });
    }
  }

  // 变更时间线：类型/破坏性筛选
  const tlFilters = container.querySelector('#tl-filters');
  if (tlFilters) {
    const rows = [...container.querySelectorAll('[data-tl-tag]')];
    const apply = (filter) => {
      for (const row of rows) {
        const match =
          filter === 'all' ||
          (filter === 'breaking' && row.dataset.tlBreaking === '1') ||
          row.dataset.tlTag === filter;
        row.style.display = match ? '' : 'none';
      }
      // 分组容器在其全部条目隐藏时跟着隐藏
      for (const month of container.querySelectorAll('.timeline-month')) {
        const visible = [...month.querySelectorAll('[data-tl-tag]')].some((r) => r.style.display !== 'none');
        month.style.display = visible ? '' : 'none';
      }
    };
    for (const chip of tlFilters.querySelectorAll('[data-tl-filter]')) {
      chip.addEventListener('click', () => {
        tlFilters.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        apply(chip.dataset.tlFilter);
      });
    }
  }

  // 在途变更：类型筛选
  const flFilters = container.querySelector('#fl-filters');
  if (flFilters) {
    const rows = [...container.querySelectorAll('[data-fl-kind]')];
    for (const chip of flFilters.querySelectorAll('[data-fl-filter]')) {
      chip.addEventListener('click', () => {
        flFilters.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.flFilter;
        for (const row of rows) {
          row.style.display = filter === 'all' || row.dataset.flKind === filter ? '' : 'none';
        }
      });
    }
  }

  // 业务地图：按业务域筛选
  const dmFilters = container.querySelector('#dm-filters');
  if (dmFilters) {
    const blocks = [...container.querySelectorAll('[data-domain]')];
    for (const chip of dmFilters.querySelectorAll('[data-dm-filter]')) {
      chip.addEventListener('click', () => {
        dmFilters.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.dmFilter;
        for (const block of blocks) {
          block.style.display = filter === 'all' || block.dataset.domain === filter ? '' : 'none';
        }
      });
    }
  }
}

function adrFilterKind(adr) {
  if (adr.supersededBy) return 'retired';
  const s = adr.statusKind.toLowerCase();
  if (s.includes('proposed')) return 'proposed';
  if (s.includes('rejected')) return 'rejected';
  if (s.includes('deprecated')) return 'retired';
  if (s.includes('accepted')) return 'accepted';
  return 'other';
}

/* ------------------------------------------------------------------ */
/* 抽屉                                                                */
/* ------------------------------------------------------------------ */

function openDrawer(title, subtitle, html) {
  closeDrawer();
  const backdrop = el('<div class="drawer-backdrop"></div>');
  const drawer = el(`
    <div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head">
        <div style="flex:1">
          <h3>${escapeHtml(title)}</h3>
          <div class="dpath">${escapeHtml(subtitle)}</div>
        </div>
        <button class="ghost" id="drawer-close" aria-label="关闭">✕</button>
      </div>
      <div class="drawer-body">${html}</div>
    </div>`);

  backdrop.addEventListener('click', closeDrawer);
  document.body.append(backdrop, drawer);
  drawer.querySelector('#drawer-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', onDrawerKey);
}

function onDrawerKey(event) {
  if (event.key === 'Escape') closeDrawer();
}

function closeDrawer() {
  document.querySelectorAll('.drawer, .drawer-backdrop').forEach((n) => n.remove());
  document.removeEventListener('keydown', onDrawerKey);
}

/* ------------------------------------------------------------------ */
/* 总装配                                                              */
/* ------------------------------------------------------------------ */

function renderAll() {
  renderSidebar();
  const model = activeModel();
  renderTopbar(model);
  renderTabs(model);
  renderView(model);
}

async function boot() {
  dom.projectList = document.getElementById('project-list');
  dom.notices = document.getElementById('notices');
  dom.topbar = document.getElementById('topbar');
  dom.tabs = document.getElementById('tabs');
  dom.view = document.getElementById('view');

  document.getElementById('import-btn').addEventListener('click', importProject);

  try {
    state.projects = await listProjects();
  } catch {
    state.projects = [];
  }

  renderAll();
  // 启动完成后标记：此后的运行期错误不应再替换整个界面
  dom.view.dataset.booted = '1';
}

boot().catch((err) => {
  dom.view.innerHTML = `<div class="empty"><h2>看板启动失败</h2>
    <p class="mono" style="word-break:break-all">${escapeHtml(err?.message || String(err))}</p></div>`;
});

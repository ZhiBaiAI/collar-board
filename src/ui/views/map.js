// 业务地图：业务域 → 功能点，每个功能点当前的状态、补丁数、对齐情况。
// 不做进度百分比——文档里没有可支撑它的数据。

import { content, dash, escapeHtml, statusTone, summarize } from '../format.js';

function moduleCard(domain, mod) {
  const spec = mod.spec;
  const status = spec?.status || '';
  const acCount = (spec?.acs.length || 0) + mod.patches.reduce((n, p) => n + p.acs.length, 0);
  const tcCount = mod.tests ? mod.tests.testCases.length : 0;
  const gapCount =
    mod.alignment.uncoveredMain.length + mod.alignment.uncoveredPatch.length + mod.alignment.danglingMain.length;

  const flags = [];
  if (!spec) flags.push('<span class="badge danger">缺技术方案</span>');
  if (spec && !mod.tests) flags.push('<span class="badge danger">缺测试文档</span>');
  if (gapCount > 0) flags.push(`<span class="badge danger">${gapCount} 项未对齐</span>`);
  if (mod.patches.length) flags.push(`<span class="badge patch">${mod.patches.length} 个补丁</span>`);
  if (mod.sunsets.length) flags.push(`<span class="badge retired">${mod.sunsets.length} 项日落</span>`);
  if (spec && !gapCount && mod.tests) flags.push('<span class="badge ok">验收已对齐</span>');

  return `
    <div class="module-card" data-module="${escapeHtml(mod.path)}" role="button" tabindex="0">
      <div class="mhead">
        <span class="mname">${escapeHtml(mod.name)}</span>
        ${status ? `<span class="badge ${statusTone(status)}">${escapeHtml(status)}</span>` : ''}
      </div>
      <div class="mpath">${escapeHtml(mod.path)}</div>
      <div class="mstats">
        <span>验收标准 <b>${acCount}</b></span>
        <span>测试点 <b>${tcCount || '—'}</b></span>
        ${spec?.owner ? `<span>负责人 ${dash(spec.owner)}</span>` : ''}
      </div>
      <div class="mflags">${flags.join('')}</div>
    </div>`;
}

export function renderMap(model) {
  if (!model.domains.length) {
    return `
      <div class="empty">
        <h2>没有读到业务地图</h2>
        <p>规范的业务地图位于 <span class="mono">docs/specs/NN_[业务地图]XX域/NN_功能/spec.md</span>。</p>
        <p>确认该目录下已按模板建立业务域与功能点。</p>
      </div>`;
  }

  const blocks = model.domains
    .map(
      (domain) => `
      <div class="domain-block">
        <div class="domain-head">
          <h3>${escapeHtml(domain.name)}</h3>
          <span class="path">${escapeHtml(domain.dir)}</span>
          <span class="badge">${domain.modules.length} 个功能点</span>
        </div>
        <div class="module-grid">
          ${domain.modules.map((m) => moduleCard(domain, m)).join('')}
        </div>
      </div>`,
    )
    .join('');

  return `
    <div class="footnote" style="margin:0 0 16px">
      点击任意功能点可展开明细。状态取值来自技术方案的元数据表，未做任何换算。
    </div>
    ${blocks}`;
}

/** 功能点明细抽屉。 */
export function renderModuleDetail(model, modulePath) {
  let found = null;
  let domainName = '';
  for (const domain of model.domains) {
    const mod = domain.modules.find((m) => m.path === modulePath);
    if (mod) {
      found = mod;
      domainName = domain.name;
      break;
    }
  }
  if (!found) return null;
  const mod = found;
  const spec = mod.spec;

  const acRows = [];
  if (spec) {
    for (const ac of spec.acs) {
      acRows.push({ id: ac.id, text: ac.text, from: '技术方案' });
    }
  }
  for (const patch of mod.patches) {
    for (const ac of patch.acs) {
      acRows.push({ id: ac.id, text: ac.text, from: patch.id });
    }
  }

  const testRefs = new Set();
  if (mod.tests) {
    for (const tc of mod.tests.testCases) {
      for (const token of String(tc.ac).match(/AC-(?:P\d{3}-)?\d+/g) || []) testRefs.add(token);
    }
  }

  const acTable = acRows.length
    ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>编号</th><th>验收标准</th><th>来源</th><th>测试点</th></tr></thead>
        <tbody>
          ${acRows
            .map(
              (ac) => `<tr>
                <td class="mono">${escapeHtml(ac.id)}</td>
                <td>${content(ac.text)}</td>
                <td class="mono">${escapeHtml(ac.from)}</td>
                <td>${
                  testRefs.has(ac.id)
                    ? '<span class="badge ok">已覆盖</span>'
                    : '<span class="badge danger">无测试点</span>'
                }</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>`
    : '<div class="hint">技术方案中未列出验收标准。</div>';

  const tcTable = mod.tests?.testCases.length
    ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>编号</th><th>层级</th><th>测什么</th><th>对应标准</th><th>状态</th></tr></thead>
        <tbody>
          ${mod.tests.testCases
            .map(
              (tc) => `<tr>
                <td class="mono">${escapeHtml(tc.id)}</td>
                <td>${content(tc.level)}</td>
                <td>${content(tc.what)}</td>
                <td class="mono">${content(tc.ac)}</td>
                <td>${content(tc.status)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>`
    : '<div class="hint">没有测试文档，或测试文档中没有测试点。</div>';

  const patchList = mod.patches.length
    ? `<ul class="plain-list">${mod.patches
        .map(
          (p) => `<li>
            <span class="mono">${escapeHtml(p.id)}</span>
            ${escapeHtml(p.title.replace(/^PATCH-\d+\s*[—–-]\s*/, ''))}
            ${p.breaking ? '<span class="badge breaking">破坏性</span>' : ''}
            ${p.status ? `<span class="badge ${statusTone(p.status)}">${escapeHtml(p.status)}</span>` : ''}
            <div class="hint" style="margin:3px 0 0">${dash(p.before)} → ${dash(p.after)}</div>
          </li>`,
        )
        .join('')}</ul>`
    : '<div class="hint">没有补丁记录。</div>';

  const sunsetList = mod.sunsets.length
    ? `<ul class="plain-list">${mod.sunsets
        .map(
          (s) => `<li>
            <span class="mono">${escapeHtml(s.id)}</span> ${escapeHtml(s.title.replace(/^SUNSET-\d+\s*[—–-]\s*/, ''))}
            <div class="hint" style="margin:3px 0 0">目标：${dash(s.target)}　替代：${dash(s.replacement)}</div>
          </li>`,
        )
        .join('')}</ul>`
    : '<div class="hint">没有日落记录。</div>';

  const gapList = mod.tests?.gaps.length
    ? `<ul class="plain-list">${mod.tests.gaps
        .map((g) => `<li>${content(g.item)} —— ${content(g.reason)}</li>`)
        .join('')}</ul>`
    : '<div class="hint">测试文档中未登记已知缺口。</div>';

  const issues = model.findings.items.filter((f) => f.path === mod.path);

  return {
    title: mod.name,
    subtitle: mod.path,
    html: `
      <h4>基本情况</h4>
      <dl class="kv">
        <dt>业务域</dt><dd>${escapeHtml(domainName)}</dd>
        <dt>状态</dt><dd>${spec?.status ? `<span class="badge ${statusTone(spec.status)}">${escapeHtml(spec.status)}</span>` : '—'}</dd>
        <dt>负责人</dt><dd>${dash(spec?.owner)}</dd>
        <dt>前台路由</dt><dd class="mono">${dash(spec?.route)}</dd>
        <dt>后台接口</dt><dd class="mono">${dash(spec?.api)}</dd>
        <dt>创建 / 更新</dt><dd class="mono">${dash(spec?.dates?.created)} / ${dash(spec?.dates?.updated)}</dd>
      </dl>

      ${issues.length ? `<h4>本功能点的结构问题</h4>
        ${issues
          .map(
            (f) => `<div class="finding">
              <div class="sev ${f.severity}">${f.severity === 'high' ? '需处理' : '建议核对'}</div>
              <div><div class="ftitle">${escapeHtml(f.title)}</div>
              <div class="fdetail">${escapeHtml(f.detail)}</div></div>
            </div>`,
          )
          .join('')}` : ''}

      <h4>验收标准与覆盖</h4>
      ${acTable}

      <h4>测试点</h4>
      ${tcTable}

      <h4>已知测试缺口</h4>
      ${gapList}

      <h4>补丁</h4>
      ${patchList}

      <h4>日落记录</h4>
      ${sunsetList}

      <h4>文件</h4>
      <ul class="plain-list mono">
        ${spec ? `<li>${escapeHtml(spec.file)}</li>` : ''}
        ${mod.tests ? `<li>${escapeHtml(mod.tests.file)}</li>` : ''}
        ${mod.patches.map((p) => `<li>${escapeHtml(p.file)}</li>`).join('')}
        ${mod.sunsets.map((s) => `<li>${escapeHtml(s.file)}</li>`).join('')}
      </ul>`,
  };
}

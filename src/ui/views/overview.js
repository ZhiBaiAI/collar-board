// 总览：项目是什么、边界是什么、有几件事需要处理。

import { dash, escapeHtml, severityLabel, statusTone, tagLabel, tagTone } from '../format.js';

function metricCard({ value, label, note, tone = '' }) {
  return `
    <div class="metric ${tone}">
      <div class="value">${escapeHtml(value)}</div>
      <div class="label">${escapeHtml(label)}</div>
      ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}
    </div>`;
}

function boundaryList(title, items, emptyText) {
  const list = items.length
    ? `<ul class="plain-list mono">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    : `<div class="hint">${escapeHtml(emptyText)}</div>`;
  return `<h4>${escapeHtml(title)}</h4>${list}`;
}

export function renderOverview(model) {
  const { stats, collar, findings } = model;

  const highCount = findings.counts.high;
  const findingTone = highCount > 0 ? 'alert' : findings.counts.medium > 0 ? 'attention' : 'calm';

  const metrics = [
    metricCard({
      value: stats.modules,
      label: '功能点',
      note: `分布在 ${stats.domains} 个业务域`,
    }),
    metricCard({
      value: stats.adrs,
      label: '架构决策',
      note: stats.principles ? `另有 ${stats.principles} 条工程原则` : '',
    }),
    metricCard({
      value: stats.timelineEntries,
      label: '变更记录',
      note: stats.breakingChanges ? `其中 ${stats.breakingChanges} 条有破坏性` : '无破坏性变更',
    }),
    metricCard({
      value: highCount,
      label: '需处理的结构问题',
      note: `另有 ${findings.counts.medium} 条建议核对`,
      tone: findingTone,
    }),
  ];

  // 验收标准与测试点的对齐实况
  const coverageRows = [];
  for (const domain of model.domains) {
    for (const mod of domain.modules) {
      const specAcs = mod.spec ? mod.spec.acs.length : 0;
      const patchAcs = mod.patches.reduce((n, p) => n + p.acs.length, 0);
      const tcs = mod.tests ? mod.tests.testCases.length : 0;
      const gaps =
        mod.alignment.uncoveredMain.length +
        mod.alignment.uncoveredPatch.length +
        mod.alignment.danglingMain.length +
        (mod.alignment.danglingDeltaRefs || []).length;
      coverageRows.push({
        domain: domain.name,
        module: mod.name,
        specAcs,
        patchAcs,
        tcs,
        gaps,
        hasTests: Boolean(mod.tests),
      });
    }
  }

  const coverageTable = coverageRows.length
    ? `
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>业务域</th><th>功能点</th>
              <th class="num">验收标准</th><th class="num">补丁标准</th>
              <th class="num">测试点</th><th>对齐情况</th>
            </tr>
          </thead>
          <tbody>
            ${coverageRows
              .map(
                (r) => `
              <tr>
                <td>${escapeHtml(r.domain)}</td>
                <td>${escapeHtml(r.module)}</td>
                <td class="num">${r.specAcs}</td>
                <td class="num">${r.patchAcs}</td>
                <td class="num">${r.hasTests ? r.tcs : '—'}</td>
                <td>${
                  !r.hasTests
                    ? '<span class="badge danger">缺测试文档</span>'
                    : r.gaps > 0
                      ? `<span class="badge danger">${r.gaps} 项未对齐</span>`
                      : '<span class="badge ok">全部对齐</span>'
                }</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : '<div class="hint">尚未建立任何功能点。</div>';

  // 最近变更
  const recent = model.timeline.entries.slice(0, 6);
  const recentHtml = recent.length
    ? recent
        .map(
          (e) => `
        <div class="entry">
          <div class="edate">${escapeHtml(e.date)}</div>
          <div>
            <div class="etitle">
              <span class="badge ${tagTone(e.tag)}">${escapeHtml(tagLabel(e.tag))}</span>
              ${e.breaking ? '<span class="badge breaking">破坏性</span>' : ''}
              <span>${escapeHtml(e.title)}</span>
            </div>
          </div>
        </div>`,
        )
        .join('')
    : '<div class="hint">暂无变更记录。</div>';

  // 需要处理的问题（只列前几条，完整清单在「结构事实」）
  const topFindings = findings.items.filter((f) => f.severity === 'high' || f.severity === 'medium').slice(0, 5);
  const findingsHtml = topFindings.length
    ? topFindings
        .map(
          (f) => `
        <div class="finding">
          <div class="sev ${f.severity}">${escapeHtml(severityLabel(f.severity))}</div>
          <div>
            <div class="ftitle">${escapeHtml(f.title)}</div>
            <div class="fdetail">${escapeHtml(f.detail)}</div>
            <div class="fev">${escapeHtml(f.evidence)}</div>
          </div>
        </div>`,
        )
        .join('')
    : '<div class="hint">没有需要处理的结构问题。</div>';

  const identity = collar?.identity || {};
  const boundary = collar?.boundary || {};

  return `
    <div class="grid cols-4">${metrics.join('')}</div>

    ${
      stats.placeholders > 0 || stats.demoDomains.length
        ? `<div class="notice warn" style="margin-top:16px">
            <b>这份项目里还留着模板自身的内容。</b>
            ${
              stats.demoDomains.length
                ? `存在 ${stats.demoDomains.length} 个示范业务域（${escapeHtml(stats.demoDomains.join('、'))}），模板落地清单要求删除。`
                : ''
            }
            ${stats.placeholders > 0 ? `另有 ${stats.placeholders} 处未替换的占位符，这些字段不能当作事实读取。` : ''}
          </div>`
        : ''
    }

    <div class="section-title">需要关注</div>
    <div class="card">${findingsHtml}</div>

    <div class="section-title">验收标准与测试点对齐</div>
    ${coverageTable}
    <div class="footnote">
      对齐规则来自仓库结构门禁：技术方案声明的每条验收标准（<span class="mono">AC-N</span>）都应有测试点回指，
      补丁引入的标准（<span class="mono">AC-P⟨编号⟩-N</span>）同理。此表只做机械核对，不评价测试质量。
    </div>

    <div class="section-title">最近变更</div>
    <div class="card">${recentHtml}</div>

    <div class="section-title">行为边界</div>
    <div class="grid cols-2">
      <div class="card">
        <h3>这个项目是什么</h3>
        <dl class="kv">
          <dt>角色</dt><dd>${dash(identity.role)}</dd>
          <dt>入口地图</dt><dd class="mono">${dash(identity.entry)}</dd>
          <dt>知识库</dt><dd class="mono">${dash(identity.knowledgeBase)}</dd>
          <dt>默认策略</dt><dd>${dash(boundary.default)}</dd>
          <dt>模板版本</dt><dd class="mono">${dash(stats.templateVersion)}</dd>
        </dl>
        ${
          identity.mustRead?.length
            ? `<h4>每次会话必读</h4><ul class="plain-list mono">${identity.mustRead
                .map((i) => `<li>${escapeHtml(i)}</li>`)
                .join('')}</ul>`
            : ''
        }
      </div>
      <div class="card">
        <h3>能改什么、不能改什么</h3>
        ${boundaryList('允许写入', boundary.allowWrite || [], '未声明')}
        ${boundaryList('禁止写入', boundary.denyWrite || [], '未声明')}
        ${boundaryList('禁止命令', boundary.denyCommand || [], '未声明')}
      </div>
    </div>

    ${
      collar?.validation?.gates?.length
        ? `<div class="section-title">提交门禁</div>
           <div class="table-wrap">
             <table class="data">
               <thead><tr><th>门禁</th><th>规则</th><th>负责方</th></tr></thead>
               <tbody>
                 ${collar.validation.gates
                   .map(
                     (g) => `<tr>
                       <td class="mono">${escapeHtml(g.name || '')}</td>
                       <td>${dash(g.rule || g.cmd)}</td>
                       <td class="mono">${dash(g.owner)}</td>
                     </tr>`,
                   )
                   .join('')}
               </tbody>
             </table>
           </div>`
        : ''
    }
  `;
}

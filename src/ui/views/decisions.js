// 决策脉络：架构决策记录（ADR）、工程原则、预研蓝图。
// ADR 只增不改，因此这里呈现的是「当前生效的决策集合 + 各自的复审条件」。

import { dash, escapeHtml, maturityLabel, statusTone, summarize } from '../format.js';

const ADR_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'accepted', label: '生效中' },
  { id: 'proposed', label: '提议中' },
  { id: 'rejected', label: '已否决' },
  { id: 'retired', label: '已归档' },
];

function adrStatusKind(adr) {
  if (adr.supersededBy) return 'superseded';
  const s = adr.statusKind.toLowerCase();
  if (s.includes('proposed')) return 'proposed';
  if (s.includes('rejected')) return 'rejected';
  if (s.includes('deprecated')) return 'retired';
  if (s.includes('accepted')) return 'accepted';
  return 'other';
}

function adrCard(adr) {
  const kind = adrStatusKind(adr);
  const revisitCount = adr.revisit.length;
  return `
    <div class="card" data-adr="${escapeHtml(adr.id)}" role="button" tabindex="0" style="cursor:pointer">
      <div class="tag-row" style="margin-bottom:8px">
        <span class="badge">ADR-${escapeHtml(adr.id)}</span>
        <span class="badge ${statusTone(adr.status)}">${escapeHtml(adr.status || '未标注')}</span>
        ${adr.date ? `<span class="badge">${escapeHtml(adr.date)}</span>` : ''}
      </div>
      <div style="font-weight:600;margin-bottom:6px">${escapeHtml(adr.title)}</div>
      ${adr.chosen ? `<div class="hint" style="margin:0 0 8px">选定方案：${escapeHtml(adr.chosen)}</div>` : ''}
      ${revisitCount ? `<div class="hint" style="margin:0">登记了 ${revisitCount} 条复审触发条件</div>` : ''}
    </div>`;
}

export function renderDecisions(model) {
  const { adrs, principles } = model.decisions;

  const byKind = {
    accepted: adrs.filter((a) => adrStatusKind(a) === 'accepted').length,
    proposed: adrs.filter((a) => adrStatusKind(a) === 'proposed').length,
    rejected: adrs.filter((a) => adrStatusKind(a) === 'rejected').length,
    retired: adrs.filter((a) => adrStatusKind(a) === 'retired' || adrStatusKind(a) === 'superseded').length,
  };

  const adrHtml = adrs.length
    ? `<div class="grid cols-3">${adrs.map(adrCard).join('')}</div>`
    : `<div class="empty"><h2>还没有架构决策记录</h2>
        <p>决策记录位于 <span class="mono">docs/architecture/ADR/NNNN-简述.md</span>。</p>
        <p>规范建议只记录不可逆或代价高昂的决策——未来有人问「为什么不用另一种方案」时能拿出来回答的那种。</p>
      </div>`;

  const principleRows = principles.length
    ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>编号</th><th>原则</th><th>状态</th><th>适用范围</th><th>最后确认</th></tr></thead>
        <tbody>
          ${principles
            .map(
              (p) => `<tr>
                <td class="mono">P-${escapeHtml(String(p.id))}</td>
                <td>
                  <div style="font-weight:500">${escapeHtml(p.title)}</div>
                  ${p.statement ? `<div class="hint" style="margin:3px 0 0">${escapeHtml(summarize(p.statement, 110))}</div>` : ''}
                </td>
                <td><span class="badge ${statusTone(p.status)}">${escapeHtml(p.status || '未标注')}</span></td>
                <td>${dash(p.scope)}</td>
                <td class="mono">${dash(p.lastConfirmed)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>`
    : '<div class="hint">还没有登记工程原则。</div>';

  const bpHtml = model.blueprints.length
    ? `<div class="grid cols-3">${model.blueprints
        .map(
          (bp) => `
        <div class="card">
          <div class="tag-row" style="margin-bottom:8px">
            <span class="badge progress">${escapeHtml(maturityLabel(bp.maturity))}</span>
            ${bp.notGraduating ? '<span class="badge">暂不毕业</span>' : ''}
          </div>
          <div style="font-weight:600;margin-bottom:6px">${escapeHtml(bp.title.replace(/^\[[^\]]+\]\s*/, ''))}</div>
          ${bp.owner ? `<div class="hint" style="margin:0 0 4px">负责人：${dash(bp.owner)}</div>` : ''}
          ${
            bp.openQuestions.length
              ? `<div class="hint" style="margin:0">${bp.openQuestions.length} 个待决问题</div>`
              : ''
          }
        </div>`,
        )
        .join('')}</div>`
    : '<div class="hint">还没有预研蓝图。尚未定型的方案放在 <span class="mono">docs/wiki/blue-print/</span>。</div>';

  return `
    <div class="grid cols-4">
      <div class="metric"><div class="value">${byKind.accepted}</div><div class="label">生效中的决策</div></div>
      <div class="metric ${byKind.proposed ? 'attention' : ''}"><div class="value">${byKind.proposed}</div><div class="label">提议中</div><div class="note">尚未拍板</div></div>
      <div class="metric"><div class="value">${byKind.rejected}</div><div class="label">已否决</div><div class="note">否决理由保留，避免重复提议</div></div>
      <div class="metric"><div class="value">${byKind.retired}</div><div class="label">已归档或已被取代</div></div>
    </div>

    <div class="section-title">架构决策记录</div>
    <div class="chips" style="margin-bottom:14px" id="adr-filters">
      ${ADR_FILTERS.map(
        (f, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-adr-filter="${f.id}">${f.label}</button>`,
      ).join('')}
    </div>
    ${adrHtml}

    <div class="section-title">工程原则</div>
    <div class="footnote" style="margin:0 0 12px">
      原则回答「这类问题永远怎么处理」，与决策记录的分工是：原则是决策的上游，冲突时先改原则再改实现。
    </div>
    ${principleRows}

    <div class="section-title">预研蓝图</div>
    <div class="footnote" style="margin:0 0 12px">
      成熟度由文件名前缀表达：调研 → 讨论稿 → 技术方案，定型后毕业进入正式规格层。
    </div>
    ${bpHtml}`;
}

/** 决策明细抽屉。 */
export function renderDecisionDetail(model, adrId) {
  const adr = model.decisions.adrs.find((a) => a.id === adrId);
  if (!adr) return null;

  const revisitHtml = adr.revisit.length
    ? `<ul class="plain-list">${adr.revisit.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
    : '<div class="hint">未登记复审条件。</div>';

  const consequenceHtml = adr.consequences.length
    ? `<ul class="plain-list">${adr.consequences
        .map((c) => `<li>${escapeHtml(c.replace(/^[-*]\s*/, ''))}</li>`)
        .join('')}</ul>`
    : '<div class="hint">未记录后果。</div>';

  const supersededHtml = adr.supersededBy
    ? `<div class="notice warn">这条决策已被 ADR-${escapeHtml(adr.supersededBy)} 取代，仅作历史上下文保留。</div>`
    : '';

  return {
    title: `ADR-${adr.id}　${adr.title}`,
    subtitle: adr.file,
    html: `
      ${supersededHtml}
      <h4>基本情况</h4>
      <dl class="kv">
        <dt>状态</dt><dd><span class="badge ${statusTone(adr.status)}">${escapeHtml(adr.status)}</span></dd>
        <dt>日期</dt><dd class="mono">${dash(adr.date)}</dd>
        <dt>决策者</dt><dd>${dash(adr.deciders)}</dd>
        <dt>来源</dt><dd>${dash(adr.source)}</dd>
        <dt>最后确认</dt><dd class="mono">${dash(adr.lastConfirmed)}</dd>
        ${adr.chosen ? `<dt>选定方案</dt><dd>${escapeHtml(adr.chosen)}</dd>` : ''}
      </dl>

      <h4>后果</h4>
      ${consequenceHtml}

      <h4>复审触发条件</h4>
      <div class="footnote" style="margin:0 0 8px">
        规范要求每条决策写清「什么情况下该推翻它」。条件满足时，这条决策应被重新评估。
      </div>
      ${revisitHtml}
    `,
  };
}

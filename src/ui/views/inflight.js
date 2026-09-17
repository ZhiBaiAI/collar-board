// 在途变更：collar-status.sh 的可视化版本——
// 未收敛 patch / 待审阅提案 / 在途 sunset / 结构缺口，聚合在一页并给出下一步建议。

import { escapeHtml, statusTone, isUnfilled } from '../format.js';

function inflightRow({ badge, badgeClass, title, meta, next, warn }) {
  return `
    <div class="entry">
      <div>
        <span class="badge ${badgeClass}">${escapeHtml(badge)}</span>
        ${warn ? '<span class="badge danger">⚠ 已超收敛观察期</span>' : ''}
      </div>
      <div>
        <div class="etitle">${escapeHtml(title)}</div>
        <div class="dpath">${escapeHtml(meta)}</div>
        ${next ? `<div class="hint">Next: ${escapeHtml(next)}</div>` : ''}
      </div>
    </div>`;
}

function patchNext(patch) {
  const undone = patch.tasks.filter((t) => !t.done).length;
  if (/已验证/.test(patch.status)) return '评估执行 sh scripts/collar-converge.sh 合入主文档';
  if (patch.tasks.length && !undone) return '任务已全勾——标「已验证」后评估收敛';
  if (patch.tasks.length) return `还剩 ${undone} 项实施任务未勾`;
  return '推进实施并回填状态';
}

export function renderInflight(model) {
  const { inflight } = model;

  const total = inflight.patches.length + inflight.proposals.length + inflight.sunsets.length;
  const overdue = inflight.patches.filter((p) => p.overdue).length;

  const metrics = `
    <div class="grid cols-4">
      <div class="metric ${inflight.patches.length ? 'attention' : 'calm'}">
        <div class="value">${inflight.patches.length}</div><div class="label">在途补丁</div>
        <div class="note">${overdue ? `${overdue} 个超收敛观察期` : '生效 ≥14 天标记'}</div>
      </div>
      <div class="metric">
        <div class="value">${inflight.proposals.length}</div><div class="label">待审阅提案</div>
      </div>
      <div class="metric">
        <div class="value">${inflight.sunsets.length}</div><div class="label">在途日落</div>
      </div>
      <div class="metric ${total ? 'attention' : 'calm'}">
        <div class="value">${total}</div><div class="label">在途合计</div>
      </div>
    </div>`;

  const patchHtml = inflight.patches.length
    ? inflight.patches
        .map((p) =>
          inflightRow({
            badge: p.patch.status || '未标注',
            badgeClass: statusTone(p.patch.status),
            title: `${p.domain} / ${p.module} · ${p.patch.id} ${p.patch.title}`,
            meta: `${p.patch.file}${p.age !== null ? ` · 生效 ${p.age} 天` : ''}`,
            next: patchNext(p.patch),
            warn: p.overdue,
          }),
        )
        .join('')
    : '<div class="hint">没有未收敛的补丁。</div>';

  const proposalHtml = inflight.proposals.length
    ? inflight.proposals
        .map((p) =>
          inflightRow({
            badge: p.proposal.status || '待审阅',
            badgeClass: statusTone(p.proposal.status),
            title: `${p.domain} / ${p.module} · ${p.proposal.id} ${p.proposal.title}`,
            meta: `${p.proposal.file}${p.proposal.proposer ? ` · ${p.proposal.proposer}` : ''}`,
            next: '审阅后标记「已通过 / 已驳回」，通过后落库为正式变更',
          }),
        )
        .join('')
    : '<div class="hint">没有待审阅的提案。</div>';

  const sunsetHtml = inflight.sunsets.length
    ? inflight.sunsets
        .map((s) =>
          inflightRow({
            badge: '日落进行中',
            badgeClass: 'retired',
            title: `${s.domain} / ${s.module} · ${s.sunset.id} ${s.sunset.title}`,
            meta: s.sunset.file,
            next: '按日落剧本推进状态机，归档日填真实日期后离列',
          }),
        )
        .join('')
    : '<div class="hint">没有进行中的日落。</div>';

  // 结构缺口（collar-status「结构缺口」同口径）
  const gaps = [];
  for (const domain of model.domains) {
    for (const mod of domain.modules) {
      if (mod.spec && !mod.tests) gaps.push(`缺伴生 tests.md：${mod.path}`);
      if (mod.spec && isUnfilled(mod.spec.owner || '⟨')) gaps.push(`负责人未认领：${mod.path}/spec.md`);
    }
  }
  const gapHtml = gaps.length
    ? `<ul class="plain-list">${gaps.map((g) => `<li class="mono">${escapeHtml(g)}</li>`).join('')}</ul>`
    : '<div class="hint">没有结构缺口。</div>';

  return `
    ${metrics}

    <div class="section-title">在途补丁（未收敛 / 未废弃）</div>
    <div class="card">${patchHtml}</div>

    <div class="section-title">待审阅提案</div>
    <div class="card">${proposalHtml}</div>

    <div class="section-title">在途日落</div>
    <div class="card">${sunsetHtml}</div>

    <div class="section-title">结构缺口</div>
    <div class="card">${gapHtml}</div>

    <div class="footnote">
      口径同 <span class="mono">sh scripts/collar-status.sh</span>：已收敛 / 已废弃的补丁与已归档的日落不占在途；
      补丁生效 ≥ 14 天视为超出收敛观察期，应评估收敛。处理完上列事项后跑
      <span class="mono">sh scripts/collar-check.sh</span> 过结构门禁再提交。
    </div>`;
}

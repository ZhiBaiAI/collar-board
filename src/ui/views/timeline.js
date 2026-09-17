// 变更时间线：按月倒序展示，破坏性变更单独置顶。

import { dash, escapeHtml, tagLabel, tagTone } from '../format.js';

function entryHtml(entry) {
  return `
    <div class="entry ${entry.breaking ? 'breaking' : ''}" data-tl-tag="${escapeHtml(entry.tag || '未分类')}" data-tl-breaking="${entry.breaking ? '1' : ''}">
      <div class="edate">${escapeHtml(entry.date)}</div>
      <div>
        <div class="etitle">
          <span class="badge ${tagTone(entry.tag)}">${escapeHtml(tagLabel(entry.tag))}</span>
          ${entry.breaking ? '<span class="badge breaking">破坏性</span>' : ''}
          <span>${escapeHtml(entry.title)}</span>
          ${entry.author ? `<span class="hint" style="margin:0">${escapeHtml(entry.author)}</span>` : ''}
          ${entry.isDemo ? '<span class="badge">示范数据</span>' : ''}
        </div>
        ${entry.change ? `<div class="efield"><b>变更</b>：${escapeHtml(entry.change)}</div>` : ''}
        ${entry.impact ? `<div class="efield"><b>影响面</b>：${escapeHtml(entry.impact)}</div>` : ''}
        ${
          entry.breaking && entry.breakingNote
            ? `<div class="efield" style="color:var(--danger)"><b>兼容性</b>：${escapeHtml(entry.breakingNote)}</div>`
            : ''
        }
        ${entry.spec ? `<div class="efield"><b>规格</b>：${escapeHtml(entry.spec)}</div>` : ''}
      </div>
    </div>`;
}

export function renderTimeline(model) {
  const { entries, byMonth, breaking } = model.timeline;

  if (!entries.length) {
    return `
      <div class="empty">
        <h2>还没有变更记录</h2>
        <p>变更时间线位于 <span class="mono">docs/changelog/YYYY/YYYY-MM.md</span>。</p>
        <p>规范要求每次提交时同步记一条，因此新项目从第一次提交起就会有内容。</p>
      </div>`;
  }

  const breakingHtml = breaking.length
    ? `<div class="card" style="border-color:color-mix(in srgb, var(--danger) 40%, transparent)">
        <h3 style="color:var(--danger)">破坏性变更（${breaking.length} 条）</h3>
        <div class="hint">这些改动可能影响调用方，发版前建议逐一确认迁移方式。</div>
        ${breaking.map(entryHtml).join('')}
      </div>`
    : `<div class="notice info">变更记录中没有标记为破坏性的改动。</div>`;

  const monthsHtml = byMonth
    .map(
      (group) => `
      <div class="timeline-month">
        <h3>${escapeHtml(group.month)}　<span class="hint" style="margin:0">${group.items.length} 条</span></h3>
        <div class="card">${group.items.map(entryHtml).join('')}</div>
      </div>`,
    )
    .join('');

  const typeCounts = {};
  for (const entry of entries) {
    const key = entry.tag || '未分类';
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  }

  const chips = [
    { id: 'all', label: '全部' },
    { id: 'breaking', label: `破坏性（${breaking.length}）` },
    ...Object.keys(typeCounts).map((tag) => ({ id: tag, label: `${tagLabel(tag)}（${typeCounts[tag]}）` })),
  ];
  const chipsHtml = `
    <div class="chips" style="margin-bottom:14px" id="tl-filters">
      ${chips.map((f, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-tl-filter="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`).join('')}
    </div>`;

  return `
    <div class="grid cols-4">
      <div class="metric"><div class="value">${entries.length}</div><div class="label">变更记录总数</div>
        <div class="note">覆盖 ${byMonth.length} 个月</div></div>
      <div class="metric ${breaking.length ? 'alert' : 'calm'}"><div class="value">${breaking.length}</div>
        <div class="label">破坏性变更</div>
        <div class="note">${breaking.length ? '需确认调用方迁移' : '无'}</div></div>
      <div class="metric"><div class="value">${typeCounts.feature || 0}</div><div class="label">新功能类变更</div></div>
      <div class="metric"><div class="value">${typeCounts.patch || 0}</div><div class="label">小改动类变更</div></div>
    </div>

    <div class="section-title">破坏性变更</div>
    ${breakingHtml}

    <div class="section-title">按月份</div>
    ${chipsHtml}
    ${monthsHtml}

    <div class="footnote">
      时间线记录「什么时候变成了什么样」，与业务地图互为索引。同一件事只记一条，写结果不写过程。
    </div>`;
}

// 架构与排障：结构视图（系统此刻怎样运转）+ 排障剧本（踩过的坑怎么修）。
// 原文呈现，不加评判——结构视图与剧本本身就是项目写好的答案。

import { dash, escapeHtml, summarize } from '../format.js';

// 小节正文里的 markdown 表 → 结构化表格渲染；依赖图 → 等宽；其余 → 文本
function archBodyHtml(content) {
  const lines = content.split('\n');
  const rows = [];
  let table = [];
  const flush = () => {
    if (!table.length) return;
    rows.push({ type: 'table', lines: table });
    table = [];
  };
  const parts = [];
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      table.push(line);
    } else {
      flush();
      if (line.trim()) parts.push(line);
    }
  }
  flush();

  const renderTable = (tbl) => {
    const cells = tbl.map((l) => l.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === '')));
    const [header, , ...body] = cells;
    return `<div class="table-wrap"><table class="data">
      <thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  };

  const html = [];
  for (const item of rows) html.push(renderTable(item.lines));
  const rest = parts.join('\n').trim();
  if (rest) {
    html.push(
      /[─→│└┌▶]/.test(rest)
        ? `<pre class="mono" style="margin:8px 0 0;white-space:pre-wrap">${escapeHtml(rest)}</pre>`
        : `<div class="fdetail" style="margin-top:8px">${escapeHtml(rest)}</div>`,
    );
  }
  return html.join('');
}

function archSectionHtml(section) {
  return `
    <div class="card">
      <h3>${escapeHtml(section.name)}</h3>
      ${archBodyHtml(section.content)}
    </div>`;
}

function playbookHtml(pb, keywords) {
  const f = pb.fields;
  const fields = ['现象', '根因', '解法', '预防', '证据']
    .filter((k) => f[k])
    .map(
      (k) => `
        <div class="efield" style="white-space:pre-wrap"><b>${k}</b>：${escapeHtml(summarize(f[k], 400))}</div>`,
    )
    .join('');
  return `
    <div class="entry" data-pb="${escapeHtml(pb.title)}" data-pb-kw="${escapeHtml(keywords.join(' '))}">
      <div>
        <div class="etitle">${escapeHtml(pb.title)}</div>
        ${keywords.length ? `<div class="tag-row" style="margin:4px 0 0">${keywords.map((k) => `<span class="badge">${escapeHtml(k)}</span>`).join('')}</div>` : ''}
        ${fields}
      </div>
    </div>`;
}

export function renderRunbook(model) {
  const arch = model.architecture;
  const trouble = model.troubleshooting;

  const archHtml = arch?.sections?.length
    ? arch.sections.map(archSectionHtml).join('')
    : `<div class="empty"><h2>没有读到结构视图</h2>
        <p>架构基线位于 <span class="mono">docs/architecture/README.md</span>「结构视图」节——
        模块依赖、接口契约、数据模型，只写现在时事实。</p></div>`;

  const keywords = [...new Set((trouble?.index || []).map((r) => r.keyword).filter(Boolean))];
  const keywordChips = keywords.length
    ? `<div class="chips" style="margin-bottom:14px" id="pb-filters">
        <button class="chip active" data-pb-filter="all">全部</button>
        ${keywords.map((k) => `<button class="chip" data-pb-filter="${escapeHtml(k)}">${escapeHtml(k)}</button>`).join('')}
      </div>`
    : '';

  const norm = (s) => s.replace(/[\s\-—–_「」()（）]/g, '').toLowerCase();
  const kwOf = (title) =>
    (trouble?.index || [])
      .filter((r) => norm(r.title) === norm(title) || (norm(r.anchor) && norm(title).includes(norm(r.anchor).slice(0, 12))))
      .map((r) => r.keyword);

  const playbookList = (trouble?.playbooks || []).map((pb) => playbookHtml(pb, kwOf(pb.title))).join('');
  const troubleHtml = trouble?.playbooks?.length
    ? `${keywordChips}<div class="card">${playbookList}</div>`
    : `<div class="empty"><h2>还没有排障剧本</h2>
        <p>排障剧本位于 <span class="mono">docs/runbook/troubleshooting.md</span>。</p>
        <p>格式是「现象 / 根因 / 解法 / 预防 / 证据」五段式，由 collar-runbook 在 commit 时抽取填充。</p></div>`;

  return `
    <div class="grid cols-2">
      <div class="metric"><div class="value">${arch?.sections?.length || 0}</div>
        <div class="label">结构视图小节</div>
        <div class="note">${arch ? 'docs/architecture/README.md' : '未读到'}</div></div>
      <div class="metric"><div class="value">${trouble?.playbooks?.length || 0}</div>
        <div class="label">排障剧本</div>
        <div class="note">${trouble ? `${trouble.index.length} 条症状索引` : '未读到'}</div></div>
    </div>

    <div class="section-title">架构基线（结构视图）</div>
    <div class="footnote" style="margin:0 0 12px">
      只写现在时事实——「X 依赖 Y」，演进过程在决策脉络与变更时间线。
    </div>
    ${archHtml}

    <div class="section-title">排障剧本</div>
    <div class="footnote" style="margin:0 0 12px">
      剧本按症状关键词检索；每条含现象 / 根因 / 解法 / 预防 / 证据。
      ${trouble?.file ? `原文见 <span class="mono">${escapeHtml(trouble.file)}</span>` : ''}
    </div>
    ${troubleHtml}`;
}

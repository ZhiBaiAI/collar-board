// 架构基线与排障剧本：
//   docs/architecture/README.md 的「结构视图」——系统此刻怎样运转（现在时事实）；
//   docs/runbook/troubleshooting.md 的剧本索引与剧本条目——踩过的坑与修法。
// 两者都只解析、不评判：原文是什么样子就呈现什么样子。

import {
  extractLinks,
  headingIncludes,
  maskFences,
  parseHeadings,
  sectionBody,
  splitTableRow,
  tableByHeader,
} from './markdown.js';

const ARCH_README = 'docs/architecture/README.md';
const TROUBLESHOOTING = 'docs/runbook/troubleshooting.md';

// 模板自带的结构性小节，不是剧本条目
const NON_PLAYBOOK_HEADINGS = new Set(['格式', '剧本索引', '通用排查顺序']);

/** 结构视图：按 ### 小节切出原文（含代码块，不用 mask 后的文本展示）。 */
export function parseArchitecture(files) {
  const text = files.get(ARCH_README);
  if (!text) return null;
  const masked = maskFences(text);
  const headings = parseHeadings(masked);
  const start = headings.find((h) => h.level === 2 && h.text.includes('结构视图'));
  if (!start) return { file: ARCH_README, sections: [] };

  const lines = text.split('\n');
  const subs = headings.filter(
    (h) => h.line > start.line && h.level === 3,
  );
  const end = headings.find((h) => h.line > start.line && h.level <= 2);
  const endLine = end ? end.line - 1 : lines.length;

  const sections = subs
    .filter((h) => h.line <= endLine)
    .map((h, i) => {
      const next = subs[i + 1];
      const to = next && next.line <= endLine ? next.line - 1 : endLine;
      return { name: h.text, content: lines.slice(h.line, to).join('\n').trim() };
    });
  return { file: ARCH_README, sections };
}

/**
 * 剧本条目：## 标题下「- **键**：值」的字段块（现象/根因/解法/预防/证据）。
 * 字段值可能跨行续写，续行并入上一字段。
 */
function parsePlaybook(body) {
  const fields = {};
  let current = null;
  for (const line of body.split('\n')) {
    const m = /^\s*[-*]\s+\*\*(.+?)\*\*\s*[：:]\s*(.*)$/.exec(line);
    if (m) {
      current = m[1].trim();
      fields[current] = m[2].trim();
    } else if (current && line.trim() && !/^#/.test(line.trim())) {
      fields[current] += `\n${line.trim()}`;
    }
  }
  return fields;
}

/** 排障剧本：索引表（症状关键词 → 剧本）+ 各 ## 小节的字段块。 */
export function parseTroubleshooting(files) {
  const text = files.get(TROUBLESHOOTING);
  if (!text) return null;
  const masked = maskFences(text);
  const headings = parseHeadings(masked);
  const lines = masked.split('\n');

  // 剧本索引表：症状关键词 | 剧本
  const indexTable = tableByHeader(masked, ['症状关键词', '剧本']);
  const index = (indexTable?.rows || [])
    .filter((cells) => cells.length >= 2 && cells[0])
    .map((cells) => ({
      keyword: cells[0],
      title: (extractLinks(cells[1])[0]?.text || cells[1]).trim(),
      anchor: (extractLinks(cells[1])[0]?.href || '').replace(/^#/, ''),
    }));

  // 剧本条目：「剧本索引」之后的 ## 小节，模板结构性小节与占位标题除外
  const indexHead = headings.find((h) => h.text === '剧本索引');
  const afterIdx = indexHead ? indexHead.line : 0;
  const playbooks = [];
  const level2 = headings.filter((h) => h.level === 2 && h.line > afterIdx);
  for (const h of level2) {
    if (NON_PLAYBOOK_HEADINGS.has(h.text) || h.text.includes('⟨')) continue;
    const body = sectionBody(masked, (x) => x.line === h.line);
    const fields = parsePlaybook(body);
    if (!fields['现象'] && !fields['根因']) continue; // 不是剧本结构
    playbooks.push({ title: h.text, fields, file: TROUBLESHOOTING });
  }

  return { file: TROUBLESHOOTING, index, playbooks };
}

/** 把索引里的症状关键词按所属剧本归到各条目上（同一剧本可有多个关键词）。 */
export function playbookKeywords(trouble, playbookTitle) {
  const norm = (s) => s.replace(/[\s\-—–_「」()（）]/g, '').toLowerCase();
  return (trouble?.index || [])
    .filter((row) => {
      if (norm(row.title) === norm(playbookTitle)) return true;
      // 索引里的锚点是标题的 anchor 化，宽松比对
      return norm(row.anchor) && norm(playbookTitle).includes(norm(row.anchor).slice(0, 12));
    })
    .map((row) => row.keyword);
}

export const _internal = { parsePlaybook };

// Markdown 的受限解析：只处理规范文档实际用到的结构。
// 全部为纯函数，输入文本、输出数据，不碰 DOM 与文件系统。

/**
 * 把围栏代码块的内容替换为等量空行，保持行号不变。
 * 代码块里常出现「示例 markdown」，若不屏蔽会被误当成真实表格或标题。
 */
export function maskFences(text) {
  let fence = null;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = /^\s*(`{3,}|~{3,})/.exec(line);
      if (m) {
        const marker = m[1][0];
        if (fence === null) {
          fence = marker;
          return '';
        }
        if (fence === marker) {
          fence = null;
          return '';
        }
      }
      return fence === null ? line : '';
    })
    .join('\n');
}

/** `| a | b |` → `['a', 'b']` */
export function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const SEPARATOR_ROW = /^\|?[\s:|-]+\|?$/;

/** 解析所有表格。分隔行必须只由 -、:、| 与空白组成，否则不认为是表格。 */
export function parseTables(masked) {
  const lines = masked.split('\n');
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    if (!/^\s*\|/.test(lines[i])) {
      i += 1;
      continue;
    }
    const start = i;
    const block = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) {
      block.push(lines[i]);
      i += 1;
    }
    if (block.length < 2) continue;
    const separator = block[1];
    if (!SEPARATOR_ROW.test(separator) || !separator.includes('-')) continue;
    tables.push({
      header: splitTableRow(block[0]),
      rows: block.slice(2).map(splitTableRow),
      startLine: start + 1,
    });
  }
  return tables;
}

/** 按表头文本精确匹配取第一张表。 */
export function tableByHeader(masked, header) {
  const want = header.map((c) => c.trim());
  return (
    parseTables(masked).find(
      (t) => t.header.length === want.length && t.header.every((c, idx) => c === want[idx]),
    ) || null
  );
}

export function parseHeadings(masked) {
  return masked
    .split('\n')
    .map((line, idx) => {
      const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      return m ? { level: m[1].length, text: m[2], line: idx + 1 } : null;
    })
    .filter(Boolean);
}

/** 取某个标题下的正文，直到出现同级或更高级标题为止。predicate 收到 {level, text}。 */
export function sectionBody(masked, predicate) {
  const lines = masked.split('\n');
  const heads = parseHeadings(masked);
  const idx = heads.findIndex((h) => predicate(h));
  if (idx === -1) return '';
  const head = heads[idx];
  const next = heads.slice(idx + 1).find((n) => n.level <= head.level);
  return lines.slice(head.line, next ? next.line - 1 : lines.length).join('\n');
}

/** 标题文本以给定前缀开头（如「5. 验收标准」）。 */
export function headingStartsWith(prefix) {
  return (h) => h.text.startsWith(prefix);
}

/**
 * 标题文本包含关键词。
 * 各文档的章节编号并不统一（同一份「验收标准」在不同 spec 里可能是 §4 或 §5），
 * 因此定位章节一律按名称匹配，不按编号。
 */
export function headingIncludes(keyword) {
  return (h) => h.text.includes(keyword);
}

/** 标题文本完全等于给定值。 */
export function headingIs(title) {
  return (h) => h.text === title;
}

export function firstHeading(masked) {
  return parseHeadings(masked).find((h) => h.level === 1) || null;
}

/** 提取行内链接 `[文本](地址)`。 */
export function extractLinks(text) {
  const out = [];
  const re = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(text))) out.push({ text: m[1], href: m[2] });
  return out;
}

/**
 * 提取 `- **键**：值` 形式的字段行。
 * 同一行出现多个字段时以全角「｜」分隔，例如 changelog 的
 * `- **Spec**：… ｜ **影响面**：…`。首次出现的键优先。
 */
export function parseKeyedBullets(text) {
  const out = {};
  const put = (key, value) => {
    if (key && !(key in out)) out[key] = value.trim();
  };
  for (const line of text.split('\n')) {
    const m = /^\s*[-*]\s+\*\*(.+?)\*\*\s*[：:]\s*(.*)$/.exec(line);
    if (!m) continue;
    const segments = m[2].split('｜');
    put(m[1].trim(), segments[0]);
    for (const segment of segments.slice(1)) {
      const sub = /^\s*\*\*(.+?)\*\*\s*[：:]\s*(.*)$/.exec(segment);
      if (sub) put(sub[1].trim(), sub[2]);
    }
  }
  return out;
}

/** 取某个标题之后第一条非空行（常用于抓一句结论）。 */
export function firstNonEmptyLineAfter(masked, predicate) {
  const body = sectionBody(masked, predicate);
  return body.split('\n').find((l) => l.trim()) || '';
}

/** 去掉行内 markdown 标记，得到适合纯文本展示的一行。 */
export function stripInline(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .trim();
}

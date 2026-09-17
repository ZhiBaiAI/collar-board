// 变更时间线：docs/changelog/YYYY/YYYY-MM.md
// 条目格式（docs/changelog/README.md）：
//   ### YYYY-MM-DD · 标签 · 一句话概述 · @作者
//   - **Spec**：… ｜ **影响面**：…
//   - **变更**：… / **破坏性**：… / **关联**：…
// 作者可省略，因此解析需容忍段数不足。

import { extractLinks, maskFences, parseKeyedBullets, stripInline } from './markdown.js';

const CHANGELOG_ROOT = 'docs/changelog/';

const KNOWN_TAGS = ['feature', 'patch', 'sunset', 'refactor', 'fix', 'chore', 'BREAKING'];

function looksLikeAuthor(segment) {
  return /^⟨?@/.test(segment.trim());
}

/** 「有 / 无」判定：去掉加粗后以「有」开头即为破坏性。 */
function isBreaking(raw) {
  if (!raw) return false;
  const plain = stripInline(raw).replace(/\*\*/g, '').trim();
  return /^有/.test(plain);
}

export function parseTimeline(files) {
  const entries = [];

  for (const [path, text] of files) {
    if (!path.startsWith(CHANGELOG_ROOT) || !path.endsWith('.md')) continue;
    if (path.endsWith('README.md')) continue;
    if (path.includes('_template')) continue;

    const masked = maskFences(text);
    const lines = masked.split('\n');
    let current = null;

    const flush = () => {
      if (current) entries.push(current);
      current = null;
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const m = /^###\s+(.+)$/.exec(line);
      if (m) {
        flush();
        const segments = m[1].split('·').map((s) => s.trim());
        const date = segments[0] || '';
        let tag = '';
        let author = '';
        let titleParts = [];

        if (segments.length >= 2 && KNOWN_TAGS.includes(segments[1])) {
          tag = segments[1];
          titleParts = segments.slice(2);
        } else {
          titleParts = segments.slice(1);
        }
        if (titleParts.length && looksLikeAuthor(titleParts[titleParts.length - 1])) {
          author = titleParts[titleParts.length - 1];
          titleParts = titleParts.slice(0, -1);
        }

        current = {
          date,
          tag,
          title: titleParts.join(' · ').trim(),
          author,
          file: path,
          line: i + 1,
          spec: '',
          impact: '',
          change: '',
          breaking: false,
          breakingNote: '',
          links: [],
          isDemo: /〔示例〕/.test(m[1]),
        };
        continue;
      }

      // 条目正文：遇到下一个标题即结束（二级标题表示月份区块结束）
      if (current && /^#{1,2}\s/.test(line)) {
        flush();
        continue;
      }
      if (current && /^\s*-\s+\*\*/.test(line)) {
        // 收集本条的字段行（可能跨多行，这里按行取，续行忽略）
        const block = [line];
        let j = i + 1;
        while (j < lines.length && lines[j].trim() && !/^\s*[-*#]/.test(lines[j])) {
          block.push(lines[j]);
          j += 1;
        }
        const fields = parseKeyedBullets(block.join('\n'));
        if (fields['Spec'] !== undefined) current.spec = fields['Spec'];
        if (fields['影响面'] !== undefined) current.impact = fields['影响面'];
        if (fields['变更'] !== undefined) current.change = fields['变更'];
        if (fields['破坏性'] !== undefined) {
          current.breaking = isBreaking(fields['破坏性']);
          current.breakingNote = stripInline(fields['破坏性']).replace(/\*\*/g, '').trim();
        }
        if (fields['关联'] !== undefined) {
          current.links = extractLinks(fields['关联']);
        }
        i = j - 1;
      }
    }
    flush();
  }

  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // 按月分组，供时间线视图直接使用
  const byMonth = new Map();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7) || '未知';
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(entry);
  }

  return {
    entries,
    byMonth: [...byMonth.entries()].map(([month, items]) => ({ month, items })),
    breaking: entries.filter((e) => e.breaking),
  };
}

export const _internal = { isBreaking, looksLikeAuthor };

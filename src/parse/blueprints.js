// 蓝图：docs/wiki/blue-print/*.md
// 成熟度由文件名前缀表达：`[调研]` → `[讨论稿]` → `[技术方案] Vx`。

import { headingIs, maskFences, parseHeadings, sectionBody } from './markdown.js';
import { parseMetadata, splitPair } from './metadata.js';

const BLUEPRINT_ROOT = 'docs/wiki/blue-print/';

const MATURITY_ORDER = ['[调研]', '[讨论稿]', '[技术方案]'];

function basename(path) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/** 从文件名前缀判断成熟度；无前缀则视为未分级。 */
export function maturityOf(filename) {
  for (const level of MATURITY_ORDER) {
    if (filename.startsWith(level)) return level;
  }
  return '';
}

export function parseBlueprints(files) {
  const out = [];

  for (const [path, text] of files) {
    if (!path.startsWith(BLUEPRINT_ROOT) || !path.endsWith('.md')) continue;
    const base = basename(path);
    if (base === 'README.md' || base.startsWith('_template')) continue;

    const masked = maskFences(text);
    const meta = parseMetadata(text);
    const heading = parseHeadings(masked).find((h) => h.level === 1);
    const maturity = maturityOf(base);

    const openQuestions = sectionBody(masked, (h) => /^5\./.test(h.text))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^-\s*\[[ xX]\]/.test(l))
      .map((l) => l.replace(/^-\s*\[[ xX]\]\s*/, ''));

    const graduation = sectionBody(masked, (h) => /^6\./.test(h.text))
      .split('\n')
      .filter((l) => l.trim().startsWith('|'))
      .map((l) => l.split('|').map((c) => c.trim()))
      .filter((cells) => cells.length >= 4 && cells[1] && cells[1] !== '条件' && !/^-+$/.test(cells[1]))
      .map((cells) => ({ condition: cells[1], state: cells[2] }));

    const notGraduating = /当前结论[：:]\s*\*\*不毕业/.test(masked);

    out.push({
      file: path,
      filename: base,
      title: heading ? heading.text : base,
      maturity,
      maturityIndex: MATURITY_ORDER.indexOf(maturity),
      owner: meta['负责人'] || '',
      dates: splitPair(meta['创建 / 更新'] || ''),
      targetDate: meta['目标毕业时间'] || '',
      version: meta['版本'] || '',
      openQuestions,
      graduation,
      notGraduating,
    });
  }

  out.sort((a, b) => (a.maturityIndex - b.maturityIndex) || a.filename.localeCompare(b.filename));
  return out;
}

export const _internal = { basename, MATURITY_ORDER };

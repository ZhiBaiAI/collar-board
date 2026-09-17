// 决策脉络：docs/architecture/ADR/NNNN-简述.md 与 principles/P-NNN-*.md
// ADR 只增不改，状态机 proposed → accepted → deprecated / superseded by NNNN / rejected。

import {
  extractLinks,
  headingIs,
  headingStartsWith,
  maskFences,
  parseHeadings,
  sectionBody,
  stripInline,
} from './markdown.js';
import { parseMetadata } from './metadata.js';

const ADR_DIR = 'docs/architecture/ADR/';
const PRINCIPLE_DIR = 'docs/architecture/principles/';

function isTemplate(path) {
  return path.includes('_template') || path.includes('0000-adr-template');
}

function basename(path) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export function parseAdr(path, text) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const heading = parseHeadings(masked).find((h) => h.level === 1);
  const numMatch = /^(\d{4})/.exec(basename(path));

  const status = meta['状态'] || '';
  const superseded = /superseded\s+by\s+(\d{4})/i.exec(status);

  // 「备选方案」表里被选定的那一行
  const altSection = sectionBody(masked, headingIs('备选方案'));
  const chosen = altSection
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .find((cells) => cells.some((c) => c.includes('选定的')));

  const revisit = sectionBody(masked, headingStartsWith('Revisit'))
    .split('\n')
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter((l) => l && !l.startsWith('<'));

  const consequence = sectionBody(masked, headingIs('后果'))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-') || l.startsWith('*'));

  return {
    id: numMatch ? numMatch[1] : '',
    file: path,
    title: heading ? heading.text.replace(/^ADR-\d+[：:]\s*/, '') : basename(path, '.md'),
    status,
    statusKind: superseded ? 'superseded' : status.trim(),
    supersededBy: superseded ? superseded[1] : '',
    date: meta['日期'] || '',
    deciders: meta['决策者'] || '',
    source: meta['来源'] || '',
    lastConfirmed: meta['最后确认'] || '',
    relatedSpec: extractLinks(meta['相关 Spec'] || '').map((l) => l.href),
    // 去掉加粗标记，保留「（选定的）」这类语义标注
    chosen: chosen ? stripInline(chosen.filter(Boolean)[0]) : '',
    revisit,
    consequences: consequence,
  };
}

export function parsePrinciple(path, text) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const heading = parseHeadings(masked).find((h) => h.level === 1);
  const statement = sectionBody(masked, headingIs('原则'))
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('<')) || '';

  // 元数据里写的是 P-001，这里统一存数字部分，由展示层补 P- 前缀
  const rawId = meta['编号'] || '';
  const id = (/P-(\d+)/.exec(rawId) || /^P-(\d+)/.exec(basename(path)) || [, ''])[1];

  return {
    id,
    file: path,
    title: heading ? heading.text.replace(/^P-\d+[：:]\s*/, '') : basename(path, '.md'),
    status: meta['状态'] || '',
    source: meta['来源'] || '',
    scope: meta['适用范围'] || '',
    lastConfirmed: meta['最后确认'] || '',
    statement: statement.replace(/\*\*/g, ''),
  };
}

export function parseDecisions(files) {
  const adrs = [];
  const principles = [];

  for (const [path, text] of files) {
    if (path.startsWith(ADR_DIR) && path.endsWith('.md') && !isTemplate(path)) {
      adrs.push(parseAdr(path, text));
    }
    if (path.startsWith(PRINCIPLE_DIR) && path.endsWith('.md') && !path.includes('_template')) {
      principles.push(parsePrinciple(path, text));
    }
  }

  adrs.sort((a, b) => a.id.localeCompare(b.id));
  principles.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // 编号重复：仓库结构门禁 S4 的规则
  const seen = new Map();
  const duplicates = [];
  for (const adr of adrs) {
    if (!adr.id) continue;
    if (seen.has(adr.id)) duplicates.push(adr.id);
    seen.set(adr.id, true);
  }

  return { adrs, principles, duplicateIds: duplicates };
}

export const _internal = { isTemplate };

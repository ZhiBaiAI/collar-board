// 规范文档顶部的元数据表：表头固定为「项 | 值」，两列。

import { maskFences, parseTables } from './markdown.js';

/**
 * 去掉包裹整个值的行内标记，如 `` `/demo` `` → `/demo`、`**生效**` → `生效`。
 * 只处理「整体包裹」的情形，不做通用 markdown 剥离——
 * 元数据里可能有链接（相关 Spec），展开会破坏它。
 */
export function cleanValue(value) {
  let s = (value || '').trim();
  const code = /^`([^`]+)`$/.exec(s);
  if (code) s = code[1].trim();
  const bold = /^\*\*([^*]+)\*\*$/.exec(s);
  if (bold) s = bold[1].trim();
  return s;
}

/**
 * 收集文档中所有「项 | 值」两列表，按出现顺序合并，同名键以首次出现为准。
 * 只认表头第二列恰为「值」的表——像 patch 的「项 | 内容」表不属于元数据。
 */
export function parseMetadata(text) {
  const masked = maskFences(text);
  const meta = {};
  for (const table of parseTables(masked)) {
    if (table.header.length !== 2) continue;
    if (table.header[0] !== '项' || table.header[1] !== '值') continue;
    for (const row of table.rows) {
      const key = (row[0] || '').trim();
      if (!key || key in meta) continue;
      meta[key] = cleanValue(row[1]);
    }
  }
  return meta;
}

/** 取元数据中「创建 / 更新」这类合并字段的两半。 */
export function splitPair(value) {
  if (!value) return { created: '', updated: '' };
  const parts = value.split('/').map((p) => p.trim());
  return { created: parts[0] || '', updated: parts[1] || parts[0] || '' };
}

/** 文档中未替换的模板占位符数量（⟨…⟩）。 */
export function countPlaceholders(text) {
  const matches = text.match(/⟨[^⟩]*⟩/g);
  return matches ? matches.length : 0;
}

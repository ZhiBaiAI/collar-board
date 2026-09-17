// 验收标准（AC）编号的提取与对齐。
// 编号规则来自 docs/specs/_templates/：
//   spec.md §5      → AC-N
//   PATCH-NNN §⑥    → AC-P⟨NNN⟩-N

const PATCH_AC = /AC-P(\d{3})-(\d+)/g;
const MAIN_AC = /AC-(\d+)/g;

/** 提取一段文本里出现的全部 AC 编号（两种形态都收，已归一化）。 */
export function extractAcTokens(text) {
  const out = new Set();
  for (const m of text.matchAll(PATCH_AC)) out.add(`AC-P${m[1]}-${m[2]}`);
  for (const m of text.matchAll(MAIN_AC)) out.add(`AC-${m[1]}`);
  return [...out];
}

export function isPatchAc(token) {
  return /^AC-P\d{3}-\d+$/.test(token);
}

/** 从「- [ ] `AC-1` 描述」清单中取编号与描述。 */
export function parseAcChecklist(sectionText) {
  const out = [];
  const re = /^\s*-\s*\[[ xX]\]\s*`?(AC-(?:P\d{3}-)?\d+)`?\s*(.*)$/;
  for (const line of sectionText.split('\n')) {
    const m = re.exec(line);
    if (m) out.push({ id: m[1], text: m[2].trim() });
  }
  return out;
}

/**
 * patch §⑥ Delta 四段（结构门禁 S5 的同一格式）：
 *   ### ADDED    - [ ] `AC-PNNN-N` 新增标准
 *   ### MODIFIED - [ ] `AC-N` 替代主文档的新文本
 *   ### REMOVED  - `AC-N` 作废原因
 *   ### RENAMED  - FROM: `AC-旧` 紧跟 - TO: `AC-PNNN-N`
 * 早期模板是平铺清单、没有 ### 小节——四段全空时视为旧格式，
 * 由调用方退回 parseAcChecklist 兼容。
 */
export function parseDelta(sectionText) {
  const delta = { added: [], modified: [], removed: [], renamed: [] };
  let sec = '';
  let pendingFrom = null;
  const itemRe = /^\s*-\s*(\[[ xX]\]\s*)?`(AC-(?:P\d{3}-)?\d+)`\s*(.*)$/;
  for (const line of sectionText.split('\n')) {
    const h = /^###\s+(.+?)\s*$/.exec(line);
    if (h) {
      const name = h[1].toUpperCase();
      if (name.startsWith('ADD')) sec = 'added';
      else if (name.startsWith('MODI')) sec = 'modified';
      else if (name.startsWith('REMO')) sec = 'removed';
      else if (name.startsWith('RENA')) sec = 'renamed';
      else sec = '';
      pendingFrom = null;
      continue;
    }
    // 更高级别标题（## / #）结束 delta 段（sectionBody 一般会先截断，这里兜底）
    if (/^#{1,2}(?!#)/.test(line)) {
      sec = '';
      pendingFrom = null;
      continue;
    }
    if (sec === 'renamed') {
      const from = /^\s*-\s*FROM:\s*`(AC-(?:P\d{3}-)?\d+)`/.exec(line);
      if (from) { pendingFrom = from[1]; continue; }
      const to = /^\s*-\s*TO:\s*`(AC-(?:P\d{3}-)?\d+)`/.exec(line);
      if (to) {
        delta.renamed.push({ from: pendingFrom || '', to: to[1] });
        pendingFrom = null;
        continue;
      }
    }
    if (!sec || sec === 'renamed') continue;
    const m = itemRe.exec(line);
    if (m) delta[sec].push({ id: m[2], text: m[3].trim() });
  }
  return delta;
}

export function deltaIsEmpty(delta) {
  return !delta.added.length && !delta.modified.length && !delta.removed.length && !delta.renamed.length;
}

/** 实施任务清单：feature §8 `- [ ] `T-N`` / patch §⑦ `- [ ] `T-PNNN-N``。 */
export function parseTaskChecklist(sectionText) {
  const out = [];
  const re = /^\s*-\s*\[([ xX])\]\s*`?(T-(?:P\d{3}-)?\d+)`?\s*(.*)$/;
  for (const line of sectionText.split('\n')) {
    const m = re.exec(line);
    if (m) out.push({ id: m[2], done: m[1].toLowerCase() === 'x', text: m[3].trim() });
  }
  return out;
}

/**
 * 对齐校验：spec 声明的 AC 与 tests/patch 回指的 AC 互相覆盖。
 * 返回四类结果，语义与仓库结构门禁 S3 一致，并补充 patch 侧的同类检查。
 */
export function alignAc({ specAcs, patchAcs, testRefs, patchRefs }) {
  const specSet = new Set(specAcs);
  const patchSet = new Set(patchAcs);
  const testSet = new Set(testRefs);
  const patchRefSet = new Set(patchRefs);

  return {
    // spec 声明但没有任何测试点回指
    uncoveredMain: [...specSet].filter((ac) => !testSet.has(ac)),
    // patch 声明但没有任何测试点回指
    uncoveredPatch: [...patchSet].filter((ac) => !testSet.has(ac)),
    // 测试点回指的 spec AC 不存在
    danglingMain: [...testSet].filter((ac) => !specSet.has(ac) && !patchSet.has(ac)),
    // 测试点回指的 patch AC 不存在
    danglingPatch: [...patchRefSet].filter((ac) => !patchSet.has(ac)),
  };
}

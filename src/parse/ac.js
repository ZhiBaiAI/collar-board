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

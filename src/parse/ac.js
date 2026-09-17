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

/**
 * Delta 一致性核对——与结构门禁 S5 同口径的七类机械检查：
 *   小节内重复编号 / 跨小节同编号 / FROM-TO 不配对 / TO 非 AC-PNNN-N /
 *   段外孤儿行 / 疑似拼错的小节标题 / RENAMED TO 撞主文档编号（由调用方核对）。
 * 返回 { issues, checkIds, toIds }：
 *   issues   结构错误描述（逐条即事实，不经评分）
 *   checkIds delta 引用主文档已有 AC 的编号（MODIFIED/REMOVED/FROM）
 *   toIds    RENAMED TO 的新编号（调用方须核对不得已存在于主文档）
 */
export function parseDeltaIssues(sectionText) {
  const issues = [];
  const checkIds = [];
  const toIds = [];
  const cnt = new Map(); // `${sec}|${ac}` → n
  const seclist = new Map(); // ac → 出现过的小节列表
  let sec = '';
  let pend = '';

  const mark = (ac, s) => {
    const key = `${s}|${ac}`;
    const n = (cnt.get(key) || 0) + 1;
    cnt.set(key, n);
    if (n > 1) issues.push(`\`${ac}\` 在 ${s} 小节内重复——同一编号只留一条`);
    if (!seclist.has(ac)) seclist.set(ac, []);
    if (!seclist.get(ac).includes(s)) seclist.get(ac).push(s);
  };

  const flushPend = () => {
    if (sec === 'RENAMED' && pend) {
      issues.push(`### RENAMED 里 FROM: \`${pend}\` 没有配对的 TO:（每条 FROM: 紧跟一条 TO:）`);
      pend = '';
    }
  };

  for (const raw of sectionText.split('\n')) {
    const line = raw.trimEnd();
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      flushPend();
      const hdr = h3[1];
      if (['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'].includes(hdr)) {
        sec = hdr;
      } else {
        sec = '';
        if (/^(ADD|MODI|REMO|RENA)/.test(hdr.toUpperCase())) {
          issues.push(
            `小节标题「### ${hdr}」疑似拼错——delta 小节只认 ADDED/MODIFIED/REMOVED/RENAMED（若非笔误请改标题或层级）`,
          );
        }
      }
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      flushPend();
      sec = '';
      continue;
    }

    const from = /^\s*-\s*FROM:\s*`(AC-[A-Za-z0-9-]+)`/.exec(line);
    const to = /^\s*-\s*TO:\s*`(AC-[A-Za-z0-9-]+)`/.exec(line);
    const item = /^\s*-\s*(\[[ xX]\]\s*)?`(AC-[A-Za-z0-9-]+)`/.exec(line);

    if (sec === 'RENAMED' && from) {
      if (pend) issues.push(`### RENAMED 里 FROM: \`${pend}\` 没有配对的 TO:（每条 FROM: 紧跟一条 TO:）`);
      pend = from[1];
      mark(pend, 'RENAMED(FROM)');
      checkIds.push(pend);
      continue;
    }
    if (sec === 'RENAMED' && to) {
      if (!pend) issues.push(`### RENAMED 里 TO: \`${to[1]}\` 没有配对的 FROM:`);
      else pend = '';
      if (!/^AC-P\d+-\d+$/.test(to[1])) {
        issues.push(`RENAMED TO 的 \`${to[1]}\` 必须是 AC-PNNN-N 形编号——普通 AC-N 会撞主文档编号体系并触发 S3 悬空引用`);
      }
      mark(to[1], 'RENAMED(TO)');
      toIds.push(to[1]);
      continue;
    }
    if (sec && sec !== 'RENAMED' && item) {
      mark(item[2], sec);
      if (sec !== 'ADDED') checkIds.push(item[2]);
      continue;
    }
    if (!sec && item) {
      issues.push(`AC 条目不在 delta 小节内会被收敛忽略：${line.trim()}（移进对应 ### 小节）`);
      continue;
    }
    if (!sec && (from || to)) {
      issues.push(`FROM:/TO: 行不在 ### RENAMED 小节内会被忽略：${line.trim()}`);
    }
  }

  flushPend();
  for (const [ac, secs] of seclist) {
    if (secs.length > 1) {
      issues.push(`编号 \`${ac}\` 跨多个 delta 小节出现（${secs.join('|')}）——一个 AC 只能属于一种操作`);
    }
  }

  return { issues, checkIds, toIds };
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

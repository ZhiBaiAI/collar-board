// Delta 四段与实施任务解析的单元测试（合成输入，不依赖真实仓库）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDelta, deltaIsEmpty, parseTaskChecklist, parseDeltaIssues } from '../src/parse/ac.js';

const FULL = `## ⑥ 验收标准变更（Delta）

### ADDED
- [ ] \`AC-P001-1\` 新增标准一
- [ ] \`AC-P001-2\` 新增标准二

### MODIFIED
- [ ] \`AC-2\` 替代主文档 AC-2 的新文本

### REMOVED
- \`AC-3\` 已被新方案取代

### RENAMED
- FROM: \`AC-1\` 旧编号
- TO: \`AC-P001-4\` 新编号

## ⑦ 实施任务
`;

test('四段全部解析', () => {
  const d = parseDelta(FULL);
  assert.equal(deltaIsEmpty(d), false);
  assert.deepEqual(
    d.added.map((a) => a.id),
    ['AC-P001-1', 'AC-P001-2'],
  );
  assert.equal(d.modified[0].id, 'AC-2');
  assert.ok(d.modified[0].text.includes('新文本'));
  assert.equal(d.removed[0].id, 'AC-3');
  assert.deepEqual(d.renamed, [{ from: 'AC-1', to: 'AC-P001-4' }]);
});

test('REMOVED 无勾选项也能解析', () => {
  const d = parseDelta('### REMOVED\n- `AC-7` 下线原因\n');
  assert.equal(d.removed.length, 1);
  assert.equal(d.removed[0].id, 'AC-7');
});

test('没有 ### 小节时判为空（退回旧格式清单）', () => {
  const d = parseDelta('- [ ] `AC-P001-1` 平铺条目\n- [ ] `AC-P001-2` 平铺条目二\n');
  assert.equal(deltaIsEmpty(d), true);
});

test('未配对 FROM 不产生 renamed 条目', () => {
  const d = parseDelta('### RENAMED\n- FROM: `AC-1` 没有 TO\n');
  assert.deepEqual(d.renamed, []);
});

test('### 标题改变后停止收集', () => {
  const d = parseDelta('### ADDED\n- [ ] `AC-P001-1` a\n## 别的大节\n- [ ] `AC-P001-9` 不属于\n');
  assert.equal(d.added.length, 1);
});

test('任务清单解析勾选状态', () => {
  const t = parseTaskChecklist('## ⑦ 实施任务\n\n- [x] `T-P001-1` 改接口\n- [ ] `T-P001-2` 补测试\n');
  assert.equal(t.length, 2);
  assert.equal(t[0].done, true);
  assert.equal(t[1].done, false);
  assert.equal(t[1].id, 'T-P001-2');
});

/* ------------------------------------------------------------------ */
/* S5 一致性核对（collar-check.sh 同口径七类）                          */
/* ------------------------------------------------------------------ */

test('干净的 delta 不产生结构问题', () => {
  const { issues } = parseDeltaIssues(FULL);
  assert.deepEqual(issues, [], `不应有问题：${issues.join('；')}`);
});

test('小节内重复编号被检出', () => {
  const { issues } = parseDeltaIssues('### ADDED\n- [ ] `AC-P001-1` a\n- [ ] `AC-P001-1` b\n');
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes('重复'));
});

test('跨小节同编号被检出', () => {
  const { issues } = parseDeltaIssues('### ADDED\n- [ ] `AC-P001-1` a\n### REMOVED\n- `AC-P001-1` x\n');
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes('多个 delta 小节'));
});

test('FROM 无配对 TO 与孤儿 TO 都被检出', () => {
  const a = parseDeltaIssues('### RENAMED\n- FROM: `AC-1` 没下文\n');
  assert.equal(a.issues.length, 1);
  assert.ok(a.issues[0].includes('没有配对的 TO'));
  const b = parseDeltaIssues('### RENAMED\n- TO: `AC-P001-9` 没上文\n');
  assert.equal(b.issues.length, 1);
  assert.ok(b.issues[0].includes('没有配对的 FROM'));
});

test('TO 不是 AC-PNNN-N 形被检出', () => {
  const { issues } = parseDeltaIssues('### RENAMED\n- FROM: `AC-1`\n- TO: `AC-9`\n');
  assert.ok(issues.some((i) => i.includes('AC-PNNN-N')), `实际：${issues.join('；')}`);
});

test('段外 AC 孤儿行被检出', () => {
  const { issues } = parseDeltaIssues('随便一段\n- `AC-5` 写在小节外面\n');
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes('不在 delta 小节内'));
});

test('疑似拼错小节标题被检出', () => {
  // 口径同门禁：大写后以 ADD/MODI/REMO/RENA 开头但不是精确值
  const { issues } = parseDeltaIssues('### MODIFED\n- [ ] `AC-P001-1` a\n');
  assert.ok(issues.some((i) => i.includes('MODIFED')), `实际：${issues.join('；')}`);
});

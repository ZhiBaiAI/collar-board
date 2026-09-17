// Delta 四段与实施任务解析的单元测试（合成输入，不依赖真实仓库）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDelta, deltaIsEmpty, parseTaskChecklist } from '../src/parse/ac.js';

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

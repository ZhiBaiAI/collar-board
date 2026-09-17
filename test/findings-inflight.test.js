// 在途概览与新增核对项的单元测试（合成输入，不依赖真实仓库）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../src/parse/model.js';

const MINIMAL_SPEC = `## 0. 变更单

| 项 | 值 |
|---|---|
| 名称 | 测试功能 |
| 业务域 | 测试域 |
| 负责人 | @chu |
| 状态 | 已验证 |
| 变更原因 | 测试 |
| 前台路由 | /t |
| 后台 API | /api/t |
| 创建 / 更新 | 2026-09-01 / 2026-09-10 |

## 5. 验收标准

- [ ] \`AC-1\` 第一条
`;

const MINIMAL_TESTS = `| 编号 | 级别 | 回指 AC | 断言什么 |
|---|---|---|---|
| \`TC-1\` | unit | \`AC-1\` | 能过 |
`;

function repoWith(extra = {}) {
  return new Map([
    ['AGENTS.md', '# x\n'],
    ['collar.yaml', 'identity:\n  entry: AGENTS.md\n'],
    ['docs/specs/README.md', '# 认领表\n\n| 业务域 | 功能点 | 负责人 | Spec | 测试文档 |\n|---|---|---|---|---|\n| 测试域 | 测试功能 | @chu | ./01_测试域/02_测试功能/spec.md | ./tests.md |\n'],
    ['docs/specs/01_测试域/02_测试功能/spec.md', MINIMAL_SPEC],
    ['docs/specs/01_测试域/02_测试功能/tests.md', MINIMAL_TESTS],
    ...Object.entries(extra),
  ]);
}

test('spec 侧 premature-verified：已验证但任务未全勾', () => {
  const spec = `${MINIMAL_SPEC}\n## 8. 实施任务\n\n- [x] \`T-1\` 完成项\n- [ ] \`T-2\` 未完成项\n`;
  const model = buildModel(repoWith({ 'docs/specs/01_测试域/02_测试功能/spec.md': spec }), { today: '2026-09-16' });
  const hits = model.findings.items.filter((f) => f.kind === 'premature-verified');
  assert.equal(hits.length, 1, `实际：${model.findings.items.map((f) => f.title).join('；')}`);
  assert.ok(hits[0].title.includes('1 项任务未勾'));
});

test('S7 会话指代词在现状文档被检出', () => {
  const model = buildModel(
    repoWith({ 'docs/runbook/commit-gate.md': '本次新增的约束写在这里\n' }),
    { today: '2026-09-16' },
  );
  const hits = model.findings.items.filter((f) => f.kind === 'session-deixis');
  assert.equal(hits.length, 1);
  assert.ok(hits[0].evidence.includes('commit-gate.md'));
});

test('历史叙述文件不触发会话指代词（changelog 豁免）', () => {
  const model = buildModel(
    repoWith({ 'docs/changelog/2026/2026-09.md': '本次新增的功能在这里\n' }),
    { today: '2026-09-16' },
  );
  const hits = model.findings.items.filter((f) => f.kind === 'session-deixis');
  assert.equal(hits.length, 0);
});

test('缺 scripts/skills 时 toolchain-missing 提示；VERSION 缺失也提示', () => {
  const model = buildModel(repoWith(), { today: '2026-09-16' });
  const kinds = model.findings.items.map((f) => f.kind);
  assert.ok(kinds.includes('toolchain-missing'), `实际 kinds：${kinds.join('、')}`);
  assert.ok(kinds.includes('version-missing'));
});

test('工具链齐全时不误报', () => {
  const model = buildModel(
    repoWith({
      'VERSION': '1.0.0\n',
      'scripts/collar-check.sh': '#!/bin/sh\n',
      'scripts/collar-status.sh': '#!/bin/sh\n',
      'scripts/hooks/pre-commit': '#!/bin/sh\n',
      'skills/collar-specs/SKILL.md': '# x\n',
      '.github/workflows/collar-check.yml': 'run: sh scripts/collar-check.sh\n',
    }),
    { today: '2026-09-16' },
  );
  const kinds = model.findings.items.map((f) => f.kind);
  assert.ok(!kinds.includes('toolchain-missing'));
  assert.ok(!kinds.includes('version-missing'));
  assert.ok(!kinds.includes('ci-not-wired'));
});

test('质量门禁占位命令被提示', () => {
  const model = buildModel(
    repoWith({
      'collar.yaml': 'identity:\n  entry: AGENTS.md\nvalidation:\n  gates:\n    - name: test\n      cmd: "⟨npm test⟩"\n',
    }),
    { today: '2026-09-16' },
  );
  const hits = model.findings.items.filter((f) => f.kind === 'quality-gate-placeholder');
  assert.equal(hits.length, 1);
});

test('收集截断标记会产出事实项', () => {
  const files = repoWith();
  files.truncated = true;
  const model = buildModel(files, { today: '2026-09-16' });
  const hits = model.findings.items.filter((f) => f.kind === 'collection-truncated');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, 'high');
});

test('在途概览：未收敛 patch 列出，超 14 天标观察期', () => {
  const patch = `# PATCH-001 测试补丁

| 项 | 值 |
|---|---|
| 状态 | 实施中 |
| 生效日期 | 2026-08-20 |

<!-- meta 表头用「项 | 值」 -->

## ⑥ 验收标准变更（Delta）

### ADDED
- [ ] \`AC-P001-1\` 新标准
`;
  const files = repoWith({ 'docs/specs/01_测试域/02_测试功能/PATCH-001-测试.md': patch });
  // spec 需有反向指针避免 pointer-missing 干扰（与本断言无关但保持干净）
  const spec = `${MINIMAL_SPEC}<!-- 已被 PATCH-001 取代 -->\n`;
  files.set('docs/specs/01_测试域/02_测试功能/spec.md', spec);
  const model = buildModel(files, { today: '2026-09-16' });
  assert.equal(model.inflight.patches.length, 1);
  assert.equal(model.inflight.patches[0].patch.id, 'PATCH-001');
  assert.equal(model.inflight.patches[0].overdue, true, '27 天应超 14 天观察期');
});

test('在途概览：已收敛 patch 不占在途；待审阅提案列出', () => {
  const patch = `# PATCH-001 收敛过的

| 项 | 值 |
|---|---|
| 状态 | 已收敛 |
| 生效日期 | 2026-09-01 |
`;
  const proposal = `# PROPOSAL-001 加字段

| 项 | 值 |
|---|---|
| 提案人 | @x |
| 目标模块 | \`spec.md\` |
| 状态 | 待审阅 |
`;
  const model = buildModel(
    repoWith({
      'docs/specs/01_测试域/02_测试功能/PATCH-001-a.md': patch,
      'docs/specs/01_测试域/02_测试功能/PROPOSAL-001-加字段.md': proposal,
    }),
    { today: '2026-09-16' },
  );
  assert.equal(model.inflight.patches.length, 0);
  assert.equal(model.inflight.proposals.length, 1);
  assert.equal(model.inflight.proposals[0].proposal.id, 'PROPOSAL-001');
});

test('架构基线解析出结构视图小节（真实仓库）', async () => {
  const { readRepo, exists } = await import('./helpers/repo.js');
  const root = new URL('../../collar-sdd', import.meta.url).pathname;
  if (!(await exists(`${root}/AGENTS.md`))) return;
  const { parseArchitecture } = await import('../src/parse/runbook.js');
  const arch = parseArchitecture(await readRepo(root));
  assert.ok(arch.sections.length >= 2);
  assert.ok(arch.sections.some((s) => s.name.includes('模块依赖')));
});

test('排障剧本解析出索引与字段块（真实仓库）', async () => {
  const { readRepo, exists } = await import('./helpers/repo.js');
  const root = new URL('../../collar-sdd', import.meta.url).pathname;
  if (!(await exists(`${root}/AGENTS.md`))) return;
  const { parseTroubleshooting } = await import('../src/parse/runbook.js');
  const tr = parseTroubleshooting(await readRepo(root));
  assert.ok(tr.index.length >= 2);
  assert.ok(tr.playbooks.length >= 2);
  const pb = tr.playbooks.find((p) => p.title.includes('结构门禁'));
  assert.ok(pb.fields['现象'] && pb.fields['预防'], `实际字段：${Object.keys(pb.fields).join('、')}`);
});

test('在途概览：未归档 sunset 列出；结构缺口给负责人与 tests.md', () => {
  const sunset = `# SUNSET-001 下线剧本

| 项 | 值 |
|---|---|
| 目标 | V1 |
| 归档日期 | ⟨YYYY-MM-DD⟩ |

## 0. 状态机
\`待评审 → 公告中 → 执行中 → 归档\`
`;
  const files = repoWith({ 'docs/specs/01_测试域/02_测试功能/SUNSET-001-下线.md': sunset });
  files.delete('docs/specs/01_测试域/02_测试功能/tests.md');
  const model = buildModel(files, { today: '2026-09-16' });
  assert.equal(model.inflight.sunsets.length, 1);
  assert.ok(model.findings.items.some((f) => f.kind === 'missing-tests'));
});

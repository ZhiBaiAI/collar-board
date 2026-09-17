// 用真实的 collar-sdd 仓库验证解析结果。
// 这些断言直接对照文档里的实际内容，解析器一旦回归会立刻失败。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readRepo, exists } from './helpers/repo.js';
import { buildModel, inspectProject } from '../src/parse/model.js';

const SAMPLE = join(import.meta.dirname, '..', '..', 'collar-sdd');

const available = await exists(join(SAMPLE, 'AGENTS.md'));
const files = available ? await readRepo(SAMPLE) : new Map();
const model = available ? buildModel(files, { today: '2026-09-16' }) : null;

const skip = available ? false : '样例仓库 collar-sdd 不在同级目录，跳过';

test('读取到规范项目所需的文件', { skip }, () => {
  assert.ok(files.has('AGENTS.md'));
  assert.ok(files.has('collar.yaml'));
  assert.ok(files.has('docs/specs/README.md'));
  assert.ok(files.size > 20, `实际读到 ${files.size} 个文件`);
});

test('合规自检通过', { skip }, () => {
  const compliance = inspectProject(files);
  assert.equal(compliance.isCompliant, true, `缺失：${JSON.stringify(compliance.missing)}`);
});

test('collar.yaml 三层声明解析正确', { skip }, () => {
  const { collar } = model;
  assert.ok(collar, 'collar.yaml 应能解析');
  assert.equal(collar.identity.entry, 'AGENTS.md');
  assert.equal(collar.identity.knowledgeBase, 'docs/');
  assert.equal(collar.boundary.default, 'deny');
  assert.ok(collar.boundary.allowWrite.includes('docs/**'));
  assert.ok(collar.boundary.denyCommand.some((c) => c.includes('git push --force')));
  assert.ok(collar.validation.gates.length >= 5, '门禁条目应被解析出来');
  // 角色化边界
  assert.ok(collar.boundary.roles['non-dev'], '非研发角色应被解析出来');
  assert.equal(collar.boundary.roles['non-dev'].changes_via, 'proposal');
});

test('业务地图解析出业务域与功能点', { skip }, () => {
  assert.equal(model.domains.length, 2, '示例仓库有 2 个业务域');
  const names = model.domains.map((d) => d.name);
  assert.ok(names.includes('示例域'), `实际：${names.join('、')}`);
  assert.ok(names.includes('示范域'), `实际：${names.join('、')}`);

  const modules = model.domains.flatMap((d) => d.modules);
  assert.equal(modules.length, 2);
});

test('技术方案的元数据与验收标准解析正确', { skip }, () => {
  const demo = model.domains
    .find((d) => d.name === '示例域')
    .modules.find((m) => m.name === '示例功能');

  assert.ok(demo.spec, '应有 spec');
  assert.equal(demo.spec.status, '已上线');
  assert.equal(demo.spec.route, '/demo');
  assert.equal(demo.spec.api, '/api/demo');
  assert.equal(demo.spec.dates.created, '2026-09-01');
  assert.equal(demo.spec.dates.updated, '2026-09-09');

  // AC-1、AC-2 两条验收标准
  assert.equal(demo.spec.acs.length, 2);
  assert.equal(demo.spec.acs[0].id, 'AC-1');
  assert.ok(demo.spec.acs[0].text.includes('keyword'));
});

test('测试文档的测试点与已知缺口解析正确', { skip }, () => {
  const demo = model.domains
    .find((d) => d.name === '示例域')
    .modules.find((m) => m.name === '示例功能');

  assert.ok(demo.tests, '应有 tests.md');
  assert.equal(demo.tests.testCases.length, 5);
  assert.equal(demo.tests.testCases[0].id, 'TC-1');
  assert.equal(demo.tests.testCases[0].level, 'unit');
  assert.equal(demo.tests.testCases[0].ac, 'AC-1');
  assert.equal(demo.tests.gaps.length, 1, '示例里登记了 1 条已知缺口');
});

test('补丁解析出覆盖范围、破坏性与验收标准', { skip }, () => {
  const demo = model.domains
    .find((d) => d.name === '示例域')
    .modules.find((m) => m.name === '示例功能');

  assert.equal(demo.patches.length, 1);
  const patch = demo.patches[0];
  assert.equal(patch.id, 'PATCH-001');
  assert.equal(patch.status, '已合并');
  assert.equal(patch.effectiveDate, '2026-09-09');
  assert.equal(patch.breaking, true, '示例补丁标记为破坏性');
  assert.ok(patch.before.includes('偏移量分页'));
  assert.ok(patch.after.includes('游标分页'));
  // AC-P001-1..3
  assert.equal(patch.acs.length, 3);
  assert.equal(patch.acs[0].id, 'AC-P001-1');
});

test('AC 对齐校验通过（示例仓库全绿）', { skip }, () => {
  for (const domain of model.domains) {
    for (const mod of domain.modules) {
      assert.deepEqual(
        mod.alignment.uncoveredMain,
        [],
        `${domain.name}/${mod.name} 不应有未覆盖的主文档 AC`,
      );
      assert.deepEqual(
        mod.alignment.uncoveredPatch,
        [],
        `${domain.name}/${mod.name} 不应有未覆盖的补丁 AC`,
      );
      assert.deepEqual(
        mod.alignment.danglingMain,
        [],
        `${domain.name}/${mod.name} 不应有悬空引用`,
      );
    }
  }
});

test('补丁的双向指针被识别为完整', { skip }, () => {
  const demo = model.domains
    .find((d) => d.name === '示例域')
    .modules.find((m) => m.name === '示例功能');
  assert.equal(demo.reversePointers.length, 1);
  assert.equal(demo.reversePointers[0].present, true);
});

test('日落剧本被解析出来', { skip }, () => {
  const core = model.domains
    .find((d) => d.name === '示范域')
    .modules.find((m) => m.name === '核心循环');
  assert.equal(core.sunsets.length, 1);
  assert.equal(core.sunsets[0].id, 'SUNSET-001');
  assert.ok(core.sunsets[0].target.includes('V1'), '目标应指向 V1');
});

test('架构决策解析出状态与复审条件', { skip }, () => {
  assert.equal(model.decisions.adrs.length, 1, '真实 ADR 有一条');
  const adr = model.decisions.adrs[0];
  assert.equal(adr.id, '0001');
  assert.equal(adr.status, 'accepted');
  assert.equal(adr.date, '2026-09-09');
  assert.ok(adr.title.includes('冲突检测'), `实际标题：${adr.title}`);
  assert.ok(adr.revisit.length >= 2, `应解析出复审条件，实际 ${adr.revisit.length} 条`);
  assert.deepEqual(model.decisions.duplicateIds, []);
});

test('模板文件不会被当作真实决策', { skip }, () => {
  const ids = model.decisions.adrs.map((a) => a.id);
  assert.ok(!ids.includes('0000'), 'ADR 模板应被跳过');
});

test('工程原则被解析出来', { skip }, () => {
  assert.equal(model.decisions.principles.length, 1);
  const p = model.decisions.principles[0];
  assert.equal(p.id, '001');
  assert.equal(p.status, '生效');
  assert.ok(p.statement.includes('上下文'), `实际：${p.statement}`);
});

test('变更时间线解析出条目、标签与破坏性', { skip }, () => {
  assert.ok(model.timeline.entries.length >= 4, `实际 ${model.timeline.entries.length} 条`);

  // 仓库里标注「有」的破坏性变更：分页策略调整、结构门禁上线
  const breaking = model.timeline.breaking;
  assert.equal(breaking.length, 2, `实际 ${breaking.length} 条：${breaking.map((b) => b.title).join('；')}`);
  assert.ok(breaking.some((b) => b.title.includes('分页策略')));
  assert.ok(breaking.some((b) => b.title.includes('结构门禁')));

  // 破坏性必须带上兼容性说明
  for (const entry of breaking) {
    assert.ok(entry.breakingNote, `${entry.title} 应带破坏性说明`);
  }

  const first = model.timeline.entries.find((e) => e.tag === 'feature');
  assert.ok(first, '应识别出 feature 标签');
  assert.ok(first.change, '应解析出「变更」字段');

  // 作者字段可省略，不应导致解析失败
  const noAuthor = model.timeline.entries.find((e) => e.date === '2026-09-15');
  assert.ok(noAuthor);
  assert.ok(noAuthor.title.includes('结构门禁'), `实际：${noAuthor.title}`);

  // 按月分组供时间线视图使用
  assert.ok(model.timeline.byMonth.length >= 1);
  assert.equal(model.timeline.byMonth[0].month, '2026-09');
});

test('蓝图解析出成熟度', { skip }, () => {
  assert.equal(model.blueprints.length, 2, '有两份蓝图');
  const tech = model.blueprints.find((b) => b.maturity === '[技术方案]');
  assert.ok(tech, '应识别出技术方案成熟度');
  assert.ok(tech.openQuestions.length >= 1);
});

test('统计量与实际文档一致', { skip }, () => {
  const { stats } = model;
  assert.equal(stats.domains, 2);
  assert.equal(stats.modules, 2);
  assert.equal(stats.adrs, 1);
  assert.equal(stats.principles, 1);
  assert.equal(stats.blueprints, 2);
  assert.equal(stats.patches, 2, '两个示例域各有一个补丁');
  assert.equal(stats.sunsets, 1);
  assert.ok(stats.agentsLines > 0 && stats.agentsLines <= 120, `入口地图 ${stats.agentsLines} 行`);
  assert.ok(stats.placeholders > 0, '示例仓库仍含占位符');
});

test('统计量中的占位符不计入模板目录', { skip }, () => {
  // _templates 里的占位符是模板本体，不应计入「项目未填写」
  const fromTemplates = model.stats.placeholderFiles.filter((f) => f.path.includes('_templates/'));
  assert.equal(fromTemplates.length, 0, '模板目录不应出现在占位符清单里');
});

test('识别出示范业务域', { skip }, () => {
  assert.equal(model.stats.demoDomains.length, 2);
});

test('结构事实清单产出且带依据', { skip }, () => {
  const { items, counts, thresholds } = model.findings;
  assert.ok(Array.isArray(items));
  // 示例仓库里 AC 全对齐、指针完整，因此不应出现「需处理」级问题
  assert.equal(counts.high, 0, `不应有需处理项，实际：${items.filter((f) => f.severity === 'high').map((f) => f.title).join('；')}`);
  // 阈值取自规范原文
  assert.equal(thresholds.staleDays, 90);
  assert.equal(thresholds.patchConvergence, 3);
  assert.equal(thresholds.agentsMaxLines, 120);
  // 每条事实都必须有依据出处
  for (const item of items) {
    assert.ok(item.title && item.detail && item.evidence, `事实缺少字段：${JSON.stringify(item)}`);
  }
});

test('占位符与示范数据被作为参考级事实列出', { skip }, () => {
  const kinds = model.findings.items.map((f) => f.kind);
  assert.ok(kinds.includes('placeholders'));
  assert.ok(kinds.includes('demo-data'));
});

test('知识库外的引用不报断链（看板不读源码树）', { skip }, () => {
  // 变更记录里指向 scripts/collar-check.sh 的链接真实存在，
  // 但看板只读 docs/ 等知识库文件，无从核实——报「不存在」就是编造。
  const dangling = model.findings.items.filter((f) => f.kind === 'timeline-dangling');
  assert.deepEqual(dangling, [], `不应有断链误报：${dangling.map((d) => d.evidence).join('；')}`);
});

test('未替换的占位符不会被当成真实值展示', { skip }, () => {
  const demo = model.domains
    .find((d) => d.name === '示例域')
    .modules.find((m) => m.name === '示例功能');
  // 负责人字段是 ⟨@谁⟩，解析层保留原值，展示层负责清洗
  assert.ok(demo.spec.owner.includes('⟨'), '解析层应保留原始值');
});

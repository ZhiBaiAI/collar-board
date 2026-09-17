// 把各解析器组装成一个完整的项目模型。
// 这是纯函数：输入「文件路径 → 文本」映射，输出模型，不接触文件系统与 DOM，
// 因此可以在 Node 里直接用真实仓库数据跑测试。

import { maskFences, parseHeadings } from './markdown.js';
import { countPlaceholders } from './metadata.js';
import { parseSpecs, parseClaimTable } from './specs.js';
import { parseDecisions } from './decisions.js';
import { parseTimeline } from './timeline.js';
import { parseBlueprints } from './blueprints.js';
import { parseCollar } from './yaml.js';
import { deriveFindings } from './findings.js';

// 模板落地清单要求删除的示范业务域
const DEMO_DOMAIN_PATTERN = /^0[01]_\[业务地图\]/;

function isDemoPath(path) {
  return path.startsWith('docs/specs/00_') || path.startsWith('docs/specs/01_');
}

export function buildModel(files, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const collar = parseCollar(files.get('collar.yaml') || '');

  const domains = parseSpecs(files);
  const claims = parseClaimTable(files);
  const decisions = parseDecisions(files);
  const timeline = parseTimeline(files);
  const blueprints = parseBlueprints(files);

  // 占位符统计：跳过模板目录，它们本就该保留占位符
  const placeholderFiles = [];
  let placeholders = 0;
  for (const [path, text] of files) {
    if (!path.endsWith('.md')) continue;
    if (path.includes('_templates/') || path.includes('_template-')) continue;
    if (path.startsWith('skills/')) continue;
    const count = countPlaceholders(text);
    if (count > 0) {
      placeholders += count;
      placeholderFiles.push({ path, count });
    }
  }
  placeholderFiles.sort((a, b) => b.count - a.count);

  const agentsText = files.get('AGENTS.md');
  const agentsLines = agentsText ? agentsText.split('\n').length : null;

  const demoDomains = domains.filter((d) => DEMO_DOMAIN_PATTERN.test(d.dir)).map((d) => d.dir);

  const modules = domains.flatMap((d) => d.modules);
  const specs = modules.map((m) => m.spec).filter(Boolean);
  const tests = modules.map((m) => m.tests).filter(Boolean);
  const patches = modules.flatMap((m) => m.patches);
  const sunsets = modules.flatMap((m) => m.sunsets);

  const statusCounts = {};
  for (const spec of specs) {
    const key = spec.status || '（未标注）';
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }

  const stats = {
    domains: domains.length,
    modules: modules.length,
    specs: specs.length,
    tests: tests.length,
    patches: patches.length,
    sunsets: sunsets.length,
    adrs: decisions.adrs.length,
    principles: decisions.principles.length,
    blueprints: blueprints.length,
    timelineEntries: timeline.entries.length,
    breakingChanges: timeline.breaking.length,
    testCases: tests.reduce((sum, t) => sum + t.testCases.length, 0),
    acceptanceCriteria: specs.reduce((sum, s) => sum + s.acs.length, 0),
    gaps: tests.reduce((sum, t) => sum + t.gaps.length, 0),
    agentsLines,
    placeholders,
    placeholderFiles,
    demoDomains,
    statusCounts,
    totalFiles: files.size,
  };

  const model = {
    generatedAt: new Date().toISOString(),
    today,
    collar,
    domains,
    claims,
    decisions,
    timeline,
    blueprints,
    stats,
    files,
  };

  model.findings = deriveFindings(model, today);
  return model;
}

/** 项目合规自检：判断所选目录是否是一个 Collar SDD 规范项目。 */
export function inspectProject(files) {
  const requiredFiles = [
    ['AGENTS.md', '入口地图'],
    ['collar.yaml', '边界与门禁声明'],
    ['docs/specs/README.md', '站点地图'],
    ['docs/runbook/conventions.md', '关键约定'],
  ];
  const requiredDirs = [
    ['docs/specs', '正式规格层'],
    ['docs/changelog', '变更时间线'],
    ['docs/architecture', '架构决策'],
    ['docs/runbook', '过程知识'],
  ];

  const present = [];
  const missing = [];
  for (const [path, label] of requiredFiles) {
    (files.has(path) ? present : missing).push({ path, label });
  }
  for (const [path, label] of requiredDirs) {
    const has = [...files.keys()].some((p) => p.startsWith(`${path}/`));
    (has ? present : missing).push({ path, label });
  }

  const total = requiredFiles.length + requiredDirs.length;
  return {
    isCompliant: missing.length === 0,
    score: `${present.length}/${total}`,
    present,
    missing,
  };
}

export const _internal = { isDemoPath, DEMO_DOMAIN_PATTERN };

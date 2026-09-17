// 结构事实：把所有可机械核对的问题集中列出，并说明每条依据来自哪条规范。
// 这是「看板帮你看什么」的落点——全部可追溯到规范原文，没有评分。

import { escapeHtml, severityLabel } from '../format.js';

const SEVERITY_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'high', label: '需处理' },
  { id: 'medium', label: '建议核对' },
  { id: 'low', label: '提示' },
  { id: 'info', label: '参考' },
];

// 每条规则对应的规范依据，让人知道「凭什么这么说」
const RULE_SOURCES = [
  {
    kind: 'missing-tests',
    rule: '每个 spec.md 必须有同目录 tests.md',
    source: '结构门禁 S2；docs/specs/README.md「伴生文档」',
  },
  {
    kind: 'ac-uncovered',
    rule: '技术方案声明的每条验收标准都应有测试点回指',
    source: '结构门禁 S3；约定 C-005',
  },
  {
    kind: 'ac-dangling',
    rule: '测试点回指的编号必须真实存在',
    source: '结构门禁 S3',
  },
  {
    kind: 'pointer-missing',
    rule: '补丁存在时，主文档必须有「已被 …取代」反向指针',
    source: '结构门禁 S5；docs/specs/README.md「关键规格一」',
  },
  {
    kind: 'delta-ref-dangling',
    rule: 'delta 引用主文档的编号必须真实存在',
    source: '结构门禁 S5',
  },
  {
    kind: 'delta-issue',
    rule: 'delta 结构七类核对：块内重复 / 跨块冲突 / FROM-TO 配对 / TO 用 AC-PNNN-N / 段外孤儿行 / 标题拼错 / TO 撞已存编号',
    source: '结构门禁 S5',
  },
  {
    kind: 'session-deixis',
    rule: '现状文档禁用「本次新增 / 本轮 / 刚才 / 上文提到」等会话指代词',
    source: '结构门禁 S7',
  },
  {
    kind: 'collection-truncated',
    rule: '文件收集被截断时事实可能不完整，必须显式声明',
    source: '看板「不编造」原则',
  },
  {
    kind: 'patch-scope-missing',
    rule: 'patch 必须有「覆盖范围」节写明前后对照',
    source: '_templates/patch.md',
  },
  {
    kind: 'premature-verified',
    rule: '实施任务全勾 + 差异清单无未决才允许标「已验证」',
    source: 'feature / patch 模板实施任务节',
  },
  {
    kind: 'spec-owner-missing',
    rule: '每个功能点必须有明确负责人',
    source: 'docs/specs/README.md「认领表」；collar-status.sh',
  },
  {
    kind: 'proposal-dangling',
    rule: '提案目标模块应可定位到具体 spec',
    source: '_templates/proposal.md',
  },
  {
    kind: 'toolchain-missing',
    rule: '门禁脚本 / hooks / 技能随模板装配',
    source: '结构门禁 S0 骨架清单',
  },
  {
    kind: 'ci-not-wired',
    rule: '结构门禁应在 CI 上执行，不只靠本地 hooks',
    source: 'commit-gate.md；collar-check.yml',
  },
  {
    kind: 'version-missing',
    rule: '下游仓用 VERSION 记录基于的模板版本',
    source: 'collar-sync.sh 版本机制',
  },
  {
    kind: 'quality-gate-placeholder',
    rule: 'collar.yaml 质量门禁的 ⟨⟩ 命令要替换成真实命令',
    source: 'collar.yaml validation.gates',
  },
  {
    kind: 'patch-convergence',
    rule: '同一功能点补丁累积达阈值应合入主文档',
    source: 'docs/specs/README.md「patch 的收敛」',
  },
  {
    kind: 'stale-spec',
    rule: '技术方案超过 90 天未更新视为待校准',
    source: 'feature 模板「创建 / 更新」字段口径',
  },
  {
    kind: 'adr-duplicate',
    rule: '决策记录编号唯一，只增不改',
    source: '结构门禁 S4',
  },
  {
    kind: 'agents-too-long',
    rule: '入口地图不超过 120 行',
    source: '结构门禁 S1；AGENTS.md 第 0 节',
  },
  {
    kind: 'claim-dangling',
    rule: '认领表登记的 Spec 路径必须存在',
    source: 'docs/specs/README.md「认领表」',
  },
  {
    kind: 'timeline-dangling',
    rule: '变更记录引用的文件必须存在',
    source: 'docs/changelog/README.md「质量红线」',
  },
];

export function renderFindings(model) {
  const { items, counts, thresholds } = model.findings;

  const summary = `
    <div class="grid cols-4">
      <div class="metric ${counts.high ? 'alert' : 'calm'}">
        <div class="value">${counts.high}</div><div class="label">需处理</div>
        <div class="note">违反规范明文规则</div>
      </div>
      <div class="metric ${counts.medium ? 'attention' : ''}">
        <div class="value">${counts.medium}</div><div class="label">建议核对</div>
        <div class="note">达到规范约定的阈值</div>
      </div>
      <div class="metric"><div class="value">${counts.low}</div><div class="label">提示</div></div>
      <div class="metric"><div class="value">${counts.info}</div><div class="label">参考</div></div>
    </div>`;

  const listHtml = items.length
    ? items
        .map(
          (f) => `
      <div class="finding" data-severity="${f.severity}">
        <div class="sev ${f.severity}">${escapeHtml(severityLabel(f.severity))}</div>
        <div>
          <div class="ftitle">${escapeHtml(f.title)}</div>
          <div class="fdetail">${escapeHtml(f.detail)}</div>
          <div class="fev">${escapeHtml(f.evidence)}</div>
          ${f.fix ? `<div class="hint">修法：${escapeHtml(f.fix)}</div>` : ''}
        </div>
      </div>`,
        )
        .join('')
    : `<div class="empty"><h2>没有发现结构问题</h2>
        <p>按规范里明文写定的规则逐条核对，当前项目全部通过。</p>
        <p>这不代表项目本身没有其他问题，只说明这些可机械核对的结构约束都满足了。</p>
      </div>`;

  const rulesHtml = RULE_SOURCES.map(
    (r) => `<tr><td>${escapeHtml(r.rule)}</td><td class="hint">${escapeHtml(r.source)}</td></tr>`,
  ).join('');

  return `
    ${summary}

    <div class="section-title">问题清单</div>
    <div class="chips" style="margin-bottom:14px" id="finding-filters">
      ${SEVERITY_FILTERS.map(
        (f, i) =>
          `<button class="chip ${i === 0 ? 'active' : ''}" data-finding-filter="${f.id}">${
            f.label
          }${f.id !== 'all' ? `（${counts[f.id]}）` : ''}</button>`,
      ).join('')}
    </div>
    <div class="card" id="finding-list">${listHtml}</div>

    <div class="section-title">核对依据</div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>规则</th><th>出处</th></tr></thead>
        <tbody>${rulesHtml}</tbody>
      </table>
    </div>

    <div class="footnote">
      <b>这份看板刻意不做评分。</b>
      健康度总分需要规范里没有定义的权重，做出来就是编造的数字。
      这里只呈现可机械核对的事实，并标明每条事实的依据出处，判断权交给人。
      <br />
      当前阈值：技术方案新鲜度 ${thresholds.staleDays} 天、补丁收敛 ${thresholds.patchConvergence} 个、
      入口地图 ${thresholds.agentsMaxLines} 行。这些数值都取自规范原文，不是看板自定的。
    </div>`;
}

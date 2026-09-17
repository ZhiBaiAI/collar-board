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

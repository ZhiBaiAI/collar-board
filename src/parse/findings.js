// 结构事实：全部可机械核对，不含任何评分或加权。
// 每条事实都注明依据来源——规范里写明的规则，或仓库结构门禁正在执行的检查。
// 刻意不做「健康度打分」：分数需要规范未定义的权重，属于编造。

const DAY = 24 * 60 * 60 * 1000;

// feature 模板对「创建 / 更新」的口径：超过 90 天视为待校准
const STALE_DAYS = 90;
// specs/README.md 的 patch 收敛时机：同一 feature 下累积 ≥ 3 个
const PATCH_CONVERGENCE_THRESHOLD = 3;
// collar.yaml 与 AGENTS.md 声明的入口地图上限
const AGENTS_MAX_LINES = 120;

function daysBetween(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY);
}

function isPlaceholder(value) {
  return typeof value === 'string' && value.includes('⟨');
}

/**
 * @param {object} model 已解析的完整项目模型
 * @param {string} today ISO 日期，用于新鲜度计算（由调用方注入，便于测试）
 */
export function deriveFindings(model, today) {
  const findings = [];
  const add = (finding) => findings.push(finding);

  // ---- 业务地图：AC 对齐（依据 collar-check.sh S3）----
  for (const domain of model.domains) {
    for (const mod of domain.modules) {
      const where = `${domain.name} / ${mod.name}`;
      const base = { domain: domain.name, module: mod.name, path: mod.path };

      if (mod.spec && !mod.tests) {
        add({
          ...base,
          kind: 'missing-tests',
          severity: 'high',
          title: `${where}：有技术方案但没有测试文档`,
          detail: '每个功能点的 spec.md 必须有同目录 tests.md（结构门禁 S2）。',
          evidence: mod.spec.file,
        });
      }

      for (const ac of mod.alignment.uncoveredMain) {
        add({
          ...base,
          kind: 'ac-uncovered',
          severity: 'high',
          title: `${where}：${ac} 没有任何测试点回指`,
          detail: '技术方案声明的验收标准，在测试文档里找不到对应测试点。',
          evidence: `${mod.spec?.file || mod.path}`,
        });
      }

      for (const ac of mod.alignment.uncoveredPatch) {
        add({
          ...base,
          kind: 'ac-uncovered-patch',
          severity: 'high',
          title: `${where}：${ac} 没有任何测试点回指`,
          detail: '补丁引入的验收标准，在测试文档里找不到对应测试点。',
          evidence: mod.path,
        });
      }

      for (const ac of mod.alignment.danglingMain) {
        add({
          ...base,
          kind: 'ac-dangling',
          severity: 'high',
          title: `${where}：测试点引用了不存在的 ${ac}`,
          detail: '测试文档回指的编号在技术方案与补丁里都找不到。',
          evidence: mod.tests?.file || mod.path,
        });
      }

      // ---- patch 双向指针（依据 collar-check.sh S5）----
      for (const ptr of mod.reversePointers) {
        if (!ptr.present) {
          add({
            ...base,
            kind: 'pointer-missing',
            severity: 'high',
            title: `${where}：${ptr.patchId} 缺少主文档反向指针`,
            detail: '补丁已存在，但技术方案里没有「已被 …取代」的标记，会读出错版本。',
            evidence: mod.spec?.file || mod.path,
          });
        }
      }

      // ---- patch 收敛（依据 specs/README.md 的收敛时机）----
      if (mod.patches.length >= PATCH_CONVERGENCE_THRESHOLD) {
        add({
          ...base,
          kind: 'patch-convergence',
          severity: 'medium',
          title: `${where}：已累积 ${mod.patches.length} 个补丁，达到收敛时机`,
          detail: `规范写明同一功能点补丁累积到 ${PATCH_CONVERGENCE_THRESHOLD} 个即应合入主文档，补丁文件保留作历史。`,
          evidence: mod.patches.map((p) => p.file).join('、'),
        });
      }

      // ---- 技术方案新鲜度（依据 feature 模板的 90 天口径）----
      const updated = mod.spec?.dates?.updated;
      if (updated && /^\d{4}-\d{2}-\d{2}$/.test(updated)) {
        const age = daysBetween(updated, today);
        if (age !== null && age > STALE_DAYS) {
          add({
            ...base,
            kind: 'stale-spec',
            severity: 'low',
            title: `${where}：技术方案已 ${age} 天未更新`,
            detail: `技术方案模板的默认口径是超过 ${STALE_DAYS} 天视为待校准。`,
            evidence: `${mod.spec.file}（更新于 ${updated}）`,
          });
        }
      }
    }
  }

  // ---- 决策记录：编号唯一（依据 collar-check.sh S4）----
  for (const id of model.decisions.duplicateIds) {
    add({
      kind: 'adr-duplicate',
      severity: 'high',
      title: `决策记录编号重复：${id}`,
      detail: '决策只增不改，同一编号不得出现两次。',
      evidence: `docs/architecture/ADR/${id}`,
    });
  }

  // ---- 入口地图行数（依据 collar-check.sh S1）----
  const agentsLines = model.stats.agentsLines;
  if (agentsLines !== null && agentsLines > AGENTS_MAX_LINES) {
    add({
      kind: 'agents-too-long',
      severity: 'medium',
      title: `入口地图 ${agentsLines} 行，超过 ${AGENTS_MAX_LINES} 行上限`,
      detail: '入口地图只做导航，细节应迁到 docs/ 对应模块。',
      evidence: 'AGENTS.md',
    });
  }

  // ---- 认领表指向不存在的技术方案 ----
  for (const claim of model.claims) {
    const target = claim.specPath.split('#')[0].split('?')[0];
    if (!target) continue;
    if (/^https?:/i.test(target)) continue;
    const normalized = normalizePath('docs/specs/README.md', target);
    if (!model.files.has(normalized)) {
      add({
        kind: 'claim-dangling',
        severity: 'medium',
        title: `认领表指向的技术方案不存在：${claim.domain} / ${claim.module}`,
        detail: '认领表登记的 Spec 路径解析后找不到对应文件。',
        evidence: `docs/specs/README.md → ${claim.specPath}`,
      });
    }
  }

  // ---- 变更时间线引用的文件不存在 ----
  for (const entry of model.timeline.entries) {
    for (const link of entry.links) {
      const href = link.href.split('#')[0];
      if (!href || /^https?:/i.test(href)) continue;
      const normalized = normalizePath(entry.file, href);
      // 只核对知识库内的引用：看板不读源码树，
      // 指向 scripts/、src/ 等处的链接无从核实，报「不存在」就是编造。
      if (!isVerifiablePath(normalized)) continue;
      if (!model.files.has(normalized)) {
        add({
          kind: 'timeline-dangling',
          severity: 'low',
          title: `变更记录引用的文件不存在：${entry.date} ${entry.title}`,
          detail: `关联链接 ${link.href} 解析后找不到对应文件。`,
          evidence: `${entry.file}:${entry.line}`,
        });
      }
    }
  }

  // ---- 模板未填：占位符仍在 ----
  const placeholderTotal = model.stats.placeholders;
  if (placeholderTotal > 0) {
    add({
      kind: 'placeholders',
      severity: 'info',
      title: `文档中仍有 ${placeholderTotal} 处未替换的模板占位符`,
      detail: '占位符 ⟨…⟩ 表示模板值尚未替换为真实内容，相关字段不能当作事实读取。',
      evidence: model.stats.placeholderFiles
        .slice(0, 8)
        .map((f) => `${f.path}（${f.count}）`)
        .join('、'),
    });
  }

  // ---- 示范数据仍在 ----
  if (model.stats.demoDomains.length) {
    add({
      kind: 'demo-data',
      severity: 'info',
      title: `仍存在 ${model.stats.demoDomains.length} 个模板示范业务域`,
      detail: '示范数据混在真实业务地图里会干扰阅读，模板落地清单要求删除。',
      evidence: model.stats.demoDomains.join('、'),
    });
  }

  const order = { high: 0, medium: 1, low: 2, info: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title));

  return {
    items: findings,
    counts: {
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
    thresholds: {
      staleDays: STALE_DAYS,
      patchConvergence: PATCH_CONVERGENCE_THRESHOLD,
      agentsMaxLines: AGENTS_MAX_LINES,
    },
  };
}

/** 把文档内的相对链接解析成仓库根目录下的路径。 */
export function normalizePath(fromFile, href) {
  const decoded = decodeURIComponent(href);
  const baseParts = fromFile.split('/');
  baseParts.pop();
  for (const part of decoded.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join('/');
}

/**
 * 该路径是否属于看板读取的范围。
 * 看板只读知识库（docs/、AGENTS.md、collar.yaml），
 * 源码树等目录没有读，因此对它们的引用无法判断存在与否。
 */
export function isVerifiablePath(path) {
  if (!path) return false;
  if (path.startsWith('docs/')) return true;
  return path === 'AGENTS.md' || path === 'collar.yaml';
}

export const _internal = {
  daysBetween,
  isPlaceholder,
  isVerifiablePath,
  STALE_DAYS,
  PATCH_CONVERGENCE_THRESHOLD,
  AGENTS_MAX_LINES,
};

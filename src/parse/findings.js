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
// collar-status.sh 的 patch 收敛观察期：生效 ≥ 14 天应评估收敛
export const CONVERGE_OBSERVE_DAYS = 14;

// 结构门禁 S7：现状文档禁用绑定「过去某次会话」的指代词
// 「本次提交」是执行时指代，不算泄漏，不查（与门禁同口径）
const DEIXIS_PATTERN = /本次新增|本轮|刚才|上文提到|上次提到|本次调整|本次引入/;
// S7 检查的现状文档集合（历史叙述模块豁免：changelog 条目、ADR、sunset、_archived、blue-print）
const DEIXIS_ROOT_FILES = ['AGENTS.md', 'collar.yaml', 'README.md', 'README.en.md'];
function isDeixisChecked(path) {
  if (DEIXIS_ROOT_FILES.includes(path)) return true;
  if (path.startsWith('skills/')) return true;
  if (path === 'docs/specs/README.md' || path === 'docs/architecture/README.md') return true;
  if (path.startsWith('docs/runbook/') && path.endsWith('.md')) return true;
  if (path === 'docs/changelog/README.md') return true;
  return false;
}

export function daysBetween(fromISO, toISO) {
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
          fix: '在同目录建 tests.md，测试点逐条回指 spec §5 的 AC-N。',
        });
      }

      // ---- spec 负责人未认领（依据 collar-status.sh「结构缺口」）----
      if (mod.spec && isPlaceholder(mod.spec.owner || '⟨')) {
        add({
          ...base,
          kind: 'spec-owner-missing',
          severity: 'low',
          title: `${where}：技术方案负责人未认领`,
          detail: '认领表要求每个功能点有明确负责人，未认领的功能点出了偏差没人可对焦。',
          evidence: mod.spec.file,
          fix: '在 spec.md 负责人字段填 @谁，并同步认领表。',
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
          fix: '在 tests.md 补一条回指该编号的测试点。',
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
          fix: '在 tests.md 补一条回指该编号的测试点。',
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
          fix: '改正 tests.md 里的编号（可能打错或已被 RENAMED 改名）。',
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
            fix: '在 spec.md 对应章节加「已被 PATCH-NNN 取代」标记与生效日期。',
          });
        }
      }

      // ---- delta 对主文档 AC 的引用必须存在（依据 collar-check.sh S5）----
      for (const ac of mod.alignment.danglingDeltaRefs || []) {
        add({
          ...base,
          kind: 'delta-ref-dangling',
          severity: 'high',
          title: `${where}：补丁 delta 引用了不存在的 ${ac}`,
          detail: 'MODIFIED / REMOVED / RENAMED(FROM) 的编号必须在主文档验收标准里真实存在。',
          evidence: mod.path,
          fix: '核对编号——可能打错、已被移除或被 RENAMED 改名。',
        });
      }

      // ---- Delta 结构一致性（依据 collar-check.sh S5 七类机械检查）----
      for (const patch of mod.patches) {
        for (const issue of patch.deltaIssues || []) {
          add({
            ...base,
            kind: 'delta-issue',
            severity: 'high',
            title: `${where}：${patch.id} delta 结构错误`,
            detail: issue,
            evidence: patch.file,
            fix: '按 S5 口径修正 §⑥：一个 AC 只属于一种操作、FROM/TO 配对、TO 用 AC-PNNN-N、条目归位到对应 ### 小节。',
          });
        }
      }

      // ---- 「已验证」要求任务全勾（依据模板实施任务节口径，patch §⑦ 与 feature §8 同查）----
      for (const patch of mod.patches) {
        const undone = patch.tasks.filter((t) => !t.done);
        if (/已验证/.test(patch.status) && patch.tasks.length && undone.length) {
          add({
            ...base,
            kind: 'premature-verified',
            severity: 'medium',
            title: `${where}：${patch.id} 标了「已验证」但还有 ${undone.length} 项任务未勾`,
            detail: '模板规定实施任务全部勾选且差异清单无未决项才允许标「已验证」。',
            evidence: patch.file,
            fix: '勾完剩余任务再标「已验证」，或把状态退回「实施中」。',
          });
        }
      }
      if (mod.spec) {
        const undone = mod.spec.tasks.filter((t) => !t.done);
        if (/已验证/.test(mod.spec.status) && mod.spec.tasks.length && undone.length) {
          add({
            ...base,
            kind: 'premature-verified',
            severity: 'medium',
            title: `${where}：技术方案标了「已验证」但还有 ${undone.length} 项任务未勾`,
            detail: '模板规定实施任务全部勾选且差异清单无未决项才允许标「已验证」。',
            evidence: mod.spec.file,
            fix: '勾完剩余任务再标「已验证」，或把状态退回「实施中」。',
          });
        }
      }

      // ---- patch 缺「覆盖范围」节：模板要求前后对照 ----
      for (const patch of mod.patches) {
        if (!patch.hasScopeSection) {
          add({
            ...base,
            kind: 'patch-scope-missing',
            severity: 'low',
            title: `${where}：${patch.id} 没有「覆盖范围」节`,
            detail: 'patch 模板要求写明目标文件 / 章节与前后对照，缺了这段读者无从定位变更。',
            evidence: patch.file,
            fix: '补「覆盖范围」两列表（目标文件 / 目标章节 / 原状态 / 新状态）。',
          });
        }
      }

      // ---- 提案目标模块可核实（仅写成路径形才核对，口头描述不编造）----
      for (const proposal of mod.proposals) {
        if (/已通过|已驳回/.test(proposal.status)) continue;
        const m = /`([^`]+)`/.exec(proposal.targetModule || '');
        if (!m || /⟨/.test(m[1])) continue;
        const ref = m[1];
        if (!/[/.]|spec/i.test(ref)) continue;
        const resolved = normalizePath(proposal.file, ref);
        const asSpecPath = normalizePath(`${mod.path}/`, ref);
        if (!model.files.has(resolved) && !model.files.has(asSpecPath) && !model.files.has(ref)) {
          add({
            ...base,
            kind: 'proposal-dangling',
            severity: 'medium',
            title: `${where}：${proposal.id} 目标模块无法核实`,
            detail: `目标模块写的是 ${ref}，按提案文件位置与功能点目录都解析不到对应文件。`,
            evidence: proposal.file,
            fix: '改成可定位的 spec 路径（相对功能点目录或仓库根）。',
          });
        }
      }

      // 已收敛 / 已废弃的 patch 是历史状态，不再占用收敛计数
      const livePatches = mod.patches.filter((p) => !/已收敛|已废弃/.test(p.status));
      if (livePatches.length >= PATCH_CONVERGENCE_THRESHOLD) {
        add({
          ...base,
          kind: 'patch-convergence',
          severity: 'medium',
          title: `${where}：已累积 ${livePatches.length} 个补丁，达到收敛时机`,
          detail: `规范写明同一功能点补丁累积到 ${PATCH_CONVERGENCE_THRESHOLD} 个即应合入主文档，补丁文件保留作历史。`,
          evidence: mod.patches.map((p) => p.file).join('、'),
          fix: '逐个跑 sh scripts/collar-converge.sh 合入主文档。',
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
            fix: '与现状核对一次——仍准确就刷新「创建 / 更新」日期，有偏差就走 patch/proposal。',
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
      fix: '后写的那份改用下一个空闲编号，并在被替代者上标「已被替代」。',
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
      fix: '把详情迁到 docs/ 对应模块，入口只留一行摘要 + 链接。',
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
        fix: '修正认领表里的 Spec 路径，或补齐对应 spec.md。',
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
          fix: '修正链接或补回被引用的文件。',
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
      fix: '按 README「落地清理清单」删除示范域与相关提示文字。',
    });
  }

  // ---- 收集被截断：以下事实可能不完整 ----
  if (model.files.truncated) {
    add({
      kind: 'collection-truncated',
      severity: 'high',
      title: '文档收集达到上限被截断，本页事实可能不完整',
      detail: '读取文件数达到内置上限即停止，未读到的文件不会被当存在——缺口类事实可能是误报。',
      evidence: `已读取 ${model.files.size} 个文档`,
      fix: '目前无解（内置上限）；如遇此报请反馈给看板项目调大上限。',
    });
  }

  // ---- S7 现状文档无会话指代词 ----
  const deixisHits = [];
  for (const [path, text] of model.files) {
    if (!isDeixisChecked(path)) continue;
    const hits = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (DEIXIS_PATTERN.test(lines[i])) hits.push(i + 1);
    }
    if (hits.length) deixisHits.push({ path, hits });
  }
  for (const hit of deixisHits) {
    add({
      kind: 'session-deixis',
      severity: 'high',
      title: `现状文档出现会话指代词：${hit.path}`,
      detail: '「本次新增 / 本轮 / 刚才 / 上文提到」等词绑定过去某次会话，未来读者无法解析（结构门禁 S7）。',
      evidence: `${hit.path} 第 ${hit.hits.join('、')} 行`,
      fix: '改为指代具体文件 / 章节 / 编号；历史叙述移进 changelog 或 ADR。',
    });
  }

  // ---- 工具链装配状态（依据 S0 骨架清单）----
  const toolchainMissing = [];
  for (const [path, label] of [
    ['scripts/collar-check.sh', '结构门禁脚本'],
    ['scripts/collar-status.sh', '在途导航脚本'],
    ['scripts/hooks/pre-commit', '预置 git hooks'],
  ]) {
    if (!model.files.has(path)) toolchainMissing.push(`${label}（${path}）`);
  }
  if (![...model.files.keys()].some((p) => p.startsWith('skills/'))) {
    toolchainMissing.push('技能目录（skills/）');
  }
  if (toolchainMissing.length) {
    add({
      kind: 'toolchain-missing',
      severity: 'info',
      title: `工具链未完整装配：缺 ${toolchainMissing.length} 项`,
      detail: '门禁脚本 / hooks / 技能是模板的执行体，缺失意味着提交关卡与变更操作不可用。',
      evidence: toolchainMissing.join('、'),
      fix: '从上游模板同步 scripts/ 与 skills/（下游仓用 sh scripts/collar-sync.sh）。',
    });
  }

  // ---- collar-check 未见 CI 装配 ----
  const workflows = [...model.files.keys()].filter((p) => p.startsWith('.github/workflows/'));
  if (workflows.length) {
    const wired = workflows.some((p) => (model.files.get(p) || '').includes('collar-check'));
    if (!wired) {
      add({
        kind: 'ci-not-wired',
        severity: 'info',
        title: '有 CI 工作流但未发现 collar-check 装配',
        detail: '本地 hooks 是自愿装配，CI 上门禁才拦得住未装 hooks 的提交。',
        evidence: workflows.join('、'),
        fix: '在 CI 里加一步跑 sh scripts/collar-check.sh。',
      });
    }
  } else if (model.files.has('scripts/collar-check.sh')) {
    add({
      kind: 'ci-not-wired',
      severity: 'info',
      title: '未发现 CI 工作流（.github/workflows 为空）',
      detail: '本地 hooks 是自愿装配，CI 上门禁才拦得住未装 hooks 的提交。',
      evidence: 'scripts/collar-check.sh 存在',
      fix: '建 .github/workflows 加一步跑 sh scripts/collar-check.sh。',
    });
  }

  // ---- 无 VERSION 文件：模板版本不可考 ----
  if (!model.files.has('VERSION')) {
    add({
      kind: 'version-missing',
      severity: 'info',
      title: '无 VERSION 文件，无法判断所基于的模板版本',
      detail: '下游仓用 VERSION 记录基于的 collar-sdd 版本，collar-sync.sh 靠它报差异。',
      evidence: 'VERSION（根目录）',
      fix: '写入当前基于的模板版本号（如 1.0.0）。',
    });
  }

  // ---- 质量门禁仍含占位符：未装配 ----
  const gates = model.collar?.validation?.gates || [];
  const placeholderGates = gates.filter((g) => typeof g.cmd === 'string' && g.cmd.includes('⟨'));
  if (placeholderGates.length) {
    add({
      kind: 'quality-gate-placeholder',
      severity: 'info',
      title: `${placeholderGates.length} 个质量门禁仍是占位命令，未装配`,
      detail: 'collar.yaml validation.gates 里 cmd 含 ⟨⟩ 的门禁不会真正执行。',
      evidence: placeholderGates.map((g) => `${g.name}: ${g.cmd}`).join('、'),
      fix: '按技术栈填真实命令（如 npm test / make lint），或删掉不用的门禁项。',
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
  if (path.startsWith('scripts/collar-')) return true;
  if (path.startsWith('skills/')) return true;
  return ['AGENTS.md', 'collar.yaml', 'VERSION', 'README.md', 'README.en.md'].includes(path);
}

export const _internal = {
  daysBetween,
  isPlaceholder,
  isVerifiablePath,
  STALE_DAYS,
  PATCH_CONVERGENCE_THRESHOLD,
  AGENTS_MAX_LINES,
};

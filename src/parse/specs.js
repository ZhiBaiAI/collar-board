// 业务地图：docs/specs/NN_[业务地图]XX域/NN_功能/
// 目录名形如 00_[业务地图]示例域，模块名形如 01_示例功能。
// _templates 与 _archived 不是业务数据，一律跳过。

import {
  extractLinks,
  headingIncludes,
  maskFences,
  parseHeadings,
  parseKeyedBullets,
  sectionBody,
} from './markdown.js';
import { parseMetadata, splitPair, countPlaceholders } from './metadata.js';
import {
  alignAc,
  deltaIsEmpty,
  extractAcTokens,
  parseAcChecklist,
  parseDelta,
  parseDeltaIssues,
  parseTaskChecklist,
} from './ac.js';

const SPECS_ROOT = 'docs/specs/';

function basename(path) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function dirname(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

/** `00_[业务地图]示例域` → `示例域`；`01_核心循环` → `核心循环`。 */
function stripNumericPrefix(name) {
  return name.replace(/^\d+_/, '').replace(/^\[业务地图\]/, '');
}

function isSkipped(path) {
  return path.includes('/_templates/') || path.includes('/_archived/');
}

/** 按目录把 docs/specs 下的文件归到「业务域 → 功能点」。 */
export function collectSpecTree(files) {
  const domains = new Map();
  for (const path of files.keys()) {
    if (!path.startsWith(SPECS_ROOT) || isSkipped(path)) continue;
    const rel = path.slice(SPECS_ROOT.length);
    const segments = rel.split('/');
    // 只要「域/功能点/文件」三层，README 等根级文件不属于任何功能点
    if (segments.length < 3) continue;
    const [domainDir, moduleDir] = segments;
    if (!domainDir || !moduleDir) continue;

    if (!domains.has(domainDir)) {
      domains.set(domainDir, { dir: domainDir, name: stripNumericPrefix(domainDir), modules: new Map() });
    }
    const domain = domains.get(domainDir);
    if (!domain.modules.has(moduleDir)) {
      domain.modules.set(moduleDir, {
        dir: moduleDir,
        name: stripNumericPrefix(moduleDir),
        path: `${SPECS_ROOT}${domainDir}/${moduleDir}`,
      });
    }
  }
  return domains;
}

function parsePatch(path, text, files) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const heading = parseHeadings(masked).find((h) => h.level === 1);
  const scope = sectionBody(masked, (h) => h.text.includes('覆盖范围'));
  const scopeRows = scope.split('\n').filter((l) => l.trim().startsWith('|'));

  // 「覆盖范围」是「项 | 内容」两列表，逐行取键值
  const scopeMap = {};
  for (const row of scopeRows) {
    const cells = row.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));
    if (cells.length >= 2 && cells[0] !== '项') scopeMap[cells[0].replace(/\*\*/g, '')] = cells[1];
  }

  const acSection = sectionBody(masked, headingIncludes('验收标准'));
  // 现行模板是 Delta 四段（### ADDED/MODIFIED/REMOVED/RENAMED），
  // 早期 patch 是平铺验收清单——四段全空时退回旧格式兼容。
  const delta = parseDelta(acSection);
  const hasDelta = !deltaIsEmpty(delta);
  // 需要测试点覆盖的生效标准：新增 + 修改 + 改名落地号；作废与旧号不算。
  const acs = hasDelta
    ? [
        ...delta.added.map((a) => ({ ...a, kind: 'added' })),
        ...delta.modified.map((a) => ({ ...a, kind: 'modified' })),
        ...delta.renamed.map((r) => ({ id: r.to, text: '', kind: 'renamed' })),
      ]
    : parseAcChecklist(acSection);

  // 对主文档已有 AC 的引用（MODIFIED/REMOVED/FROM）——必须真实存在（结构门禁 S5）；
  // deltaChecks 带 S5 同口径的七类结构错误与 RENAMED TO 新编号
  const refAcs = hasDelta
    ? [...delta.modified.map((a) => a.id), ...delta.removed.map((a) => a.id), ...delta.renamed.map((r) => r.from)]
    : [];
  const deltaChecks = hasDelta ? parseDeltaIssues(acSection) : { issues: [], checkIds: [], toIds: [] };

  const taskSection = sectionBody(masked, headingIncludes('实施任务'));

  const numMatch = /^PATCH-(\d{3})/.exec(basename(path));
  // 破坏性字段在各模板里口径不同：patch 用「是 / 否」，changelog 用「有 / 无」
  const breakingRaw = (scopeMap['是否破坏性'] || '').replace(/\*\*/g, '').trim();

  return {
    kind: 'patch',
    id: numMatch ? `PATCH-${numMatch[1]}` : basename(path, '.md'),
    file: path,
    title: heading ? heading.text : basename(path, '.md'),
    status: meta['状态'] || '',
    author: meta['作者'] || '',
    effectiveDate: meta['生效日期'] || '',
    targetFile: scopeMap['目标文件'] || '',
    targetSection: scopeMap['目标章节'] || '',
    before: scopeMap['原状态'] || '',
    after: scopeMap['新状态'] || '',
    breaking: /^(有|是)/.test(breakingRaw),
    breakingNote: breakingRaw,
    acs,
    delta: hasDelta ? delta : null,
    refAcs,
    deltaIssues: deltaChecks.issues,
    deltaToIds: deltaChecks.toIds,
    tasks: parseTaskChecklist(taskSection),
    hasScopeSection: scope.includes('覆盖范围') && scope.length > 0,
    placeholders: countPlaceholders(text),
  };
}

function parseSunset(path, text) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const heading = parseHeadings(masked).find((h) => h.level === 1);
  const numMatch = /^SUNSET-(\d{3})/.exec(basename(path));
  return {
    kind: 'sunset',
    id: numMatch ? `SUNSET-${numMatch[1]}` : basename(path, '.md'),
    file: path,
    title: heading ? heading.text : basename(path, '.md'),
    target: meta['目标'] || '',
    replacement: meta['替代方案'] || '',
    owner: meta['负责人'] || '',
    startDate: meta['启动日期'] || '',
    archiveDate: meta['归档日期'] || '',
    placeholders: countPlaceholders(text),
  };
}

function parseSpecFile(path, text, files) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const heading = parseHeadings(masked).find((h) => h.level === 1);
  const acSection = sectionBody(masked, headingIncludes('验收标准'));

  const dir = dirname(path);
  const testsPath = `${dir}/tests.md`;
  const testsText = files.get(testsPath);

  return {
    kind: 'spec',
    file: path,
    title: heading ? heading.text : basename(dir),
    status: meta['状态'] || '',
    owner: meta['负责人'] || '',
    domain: meta['业务域'] || '',
    route: meta['前台路由'] || '',
    api: meta['后台 API'] || '',
    source: meta['来源'] || '',
    scope: meta['适用范围'] || '',
    dates: splitPair(meta['创建 / 更新'] || ''),
    acs: parseAcChecklist(acSection),
    tasks: parseTaskChecklist(sectionBody(masked, headingIncludes('实施任务'))),
    placeholders: countPlaceholders(text),
    hasTests: Boolean(testsText),
  };
}

function parseProposal(path, text) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const heading = parseHeadings(masked).find((h) => h.level === 1);
  const numMatch = /^PROPOSAL-(\d{3})/.exec(basename(path));
  return {
    kind: 'proposal',
    id: numMatch ? `PROPOSAL-${numMatch[1]}` : basename(path, '.md'),
    file: path,
    title: heading ? heading.text : basename(path, '.md'),
    proposer: meta['提案人'] || '',
    targetModule: meta['目标模块'] || '',
    status: meta['状态'] || '',
    dates: splitPair(meta['创建 / 更新'] || ''),
    placeholders: countPlaceholders(text),
  };
}

function parseTestsFile(path, text) {
  const masked = maskFences(text);
  const meta = parseMetadata(text);
  const table = (() => {
    const lines = masked.split('\n');
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*\|\s*编号\s*\|/.test(lines[i])) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return [];
    const rows = [];
    for (let i = headerIdx + 2; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/^\s*\|/.test(line)) break;
      const cells = line.split('|').map((c) => c.trim());
      cells.shift();
      if (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (cells.length >= 4) {
        rows.push({
          id: cells[0],
          level: cells[1],
          what: cells[2],
          ac: cells[3],
          code: cells[4] || '',
          status: cells[5] || '',
        });
      }
    }
    return rows;
  })();

  const gapSection = sectionBody(masked, headingIncludes('已知缺口'));
  const gaps = gapSection
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((cells) => cells.length >= 5 && cells[1] && cells[1] !== '未覆盖项' && !/^-+$/.test(cells[1]))
    .map((cells) => ({ item: cells[1], reason: cells[2], owner: cells[3], plan: cells[4] }));

  return {
    file: path,
    owner: meta['负责人'] || '',
    dates: splitPair(meta['创建 / 更新'] || ''),
    testCases: table,
    gaps,
    placeholders: countPlaceholders(text),
  };
}

/**
 * 解析整个业务地图，并把每个功能点的 AC 与测试点做对齐校验。
 * 对齐规则来自仓库自身的结构门禁（scripts/collar-check.sh S3）。
 */
export function parseSpecs(files) {
  const domains = collectSpecTree(files);
  const out = [];

  // 先按目录把文件分桶一次，避免每个模块都全扫一遍文件表
  const byDir = new Map();
  for (const [path, text] of files) {
    const dir = dirname(path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push([path, text]);
  }

  for (const domain of domains.values()) {
    const modules = [];
    for (const mod of domain.modules.values()) {
      const specPath = `${mod.path}/spec.md`;
      const specText = files.get(specPath);
      const testsPath = `${mod.path}/tests.md`;
      const testsText = files.get(testsPath);

      const patches = [];
      const sunsets = [];
      const proposals = [];
      for (const [path, text] of byDir.get(mod.path) || []) {
        const base = basename(path);
        if (/^PATCH-\d{3}-/.test(base)) patches.push(parsePatch(path, text, files));
        else if (/^SUNSET-\d{3}-/.test(base)) sunsets.push(parseSunset(path, text));
        else if (/^PROPOSAL-\d{3}-/.test(base)) proposals.push(parseProposal(path, text));
      }
      patches.sort((a, b) => a.id.localeCompare(b.id));
      sunsets.sort((a, b) => a.id.localeCompare(b.id));
      proposals.sort((a, b) => a.id.localeCompare(b.id));

      const spec = specText ? parseSpecFile(specPath, specText, files) : null;
      const tests = testsText ? parseTestsFile(testsPath, testsText) : null;

      const testRefs = new Set();
      const patchRefs = new Set();
      if (tests) {
        for (const tc of tests.testCases) {
          for (const token of extractAcTokens(tc.ac)) {
            testRefs.add(token);
            if (token.startsWith('AC-P')) patchRefs.add(token);
          }
        }
      }

      const patchAcs = patches.flatMap((p) => p.acs.map((a) => a.id));
      const specAcIds = spec ? spec.acs.map((a) => a.id) : [];
      const specAcSet = new Set(specAcIds);
      // delta 对主文档已有 AC 的引用（MODIFIED/REMOVED/FROM）必须真实存在（S5 同口径）
      // 没有 spec 时引用无从核对——主报「缺技术方案」，不再追加悬空清单
      const danglingDeltaRefs = spec
        ? [...new Set(patches.flatMap((p) => p.refAcs).filter((ac) => ac && !specAcSet.has(ac)))]
        : [];

      // RENAMED TO 的新编号不得已存在于主文档（S5 NEW 检查）
      for (const p of patches) {
        for (const id of p.deltaToIds) {
          if (specAcSet.has(id)) {
            p.deltaIssues.push(`RENAMED TO 的 \`${id}\` 在主文档已存在——TO 必须换新编号（通常用 AC-PNNN-N）`);
          }
        }
      }

      const alignment = spec
        ? {
            ...alignAc({
              specAcs: specAcIds,
              patchAcs,
              testRefs: [...testRefs],
              patchRefs: [...patchRefs],
            }),
            danglingDeltaRefs,
          }
        : {
            uncoveredMain: [],
            uncoveredPatch: [],
            danglingMain: [],
            danglingPatch: [],
            danglingDeltaRefs,
          };

      modules.push({
        ...mod,
        spec,
        tests,
        patches,
        sunsets,
        proposals,
        alignment,
        // 主文档里指向本模块 patch 的反向指针（「已被 … PATCH-NNN …取代」）。
        // 已收敛/已废弃的 patch 指针随收敛移除，缺指针是正确状态，不查。
        // 用 mask 后的正文核对——代码围栏里的「已被…取代」字样不算指针。
        reversePointers: spec
          ? patches.filter((p) => !/已收敛|已废弃/.test(p.status)).map((p) => ({
              patchId: p.id,
              present: new RegExp(`已被[^\\n]*${p.id}`).test(maskFences(specText)),
            }))
          : [],
      });
    }
    modules.sort((a, b) => a.dir.localeCompare(b.dir));
    out.push({ ...domain, modules });
  }

  out.sort((a, b) => a.dir.localeCompare(b.dir));
  return out;
}

/** 从 docs/specs/README.md 的认领表取「业务域 / 模块 / 负责人 / Spec 路径」。 */
export function parseClaimTable(files) {
  const text = files.get('docs/specs/README.md');
  if (!text) return [];
  const masked = maskFences(text);
  const lines = masked.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*\|\s*业务域\s*\|/.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i += 1) {
    if (!/^\s*\|/.test(lines[i])) break;
    const cells = lines[i].split('|').map((c) => c.trim());
    cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length >= 4 && !/^-+$/.test(cells[0])) {
      const link = extractLinks(cells[3])[0];
      rows.push({ domain: cells[0], module: cells[1], owner: cells[2], specPath: link ? link.href : '' });
    }
  }
  return rows;
}

export const _internal = { stripNumericPrefix, basename, dirname, parseTestsFile, parsePatch, parseSpecFile };

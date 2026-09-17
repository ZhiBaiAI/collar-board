// 从真实仓库读取文档，供测试当作输入。
// 只读：不写入、不修改被检查的仓库。

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.mimosa', '.zcode']);
const TOP_DIRS = new Set(['docs', 'skills', 'scripts', '.github']);
const ROOT_FILES = new Set(['AGENTS.md', 'collar.yaml', 'VERSION', 'README.md', 'README.en.md']);

function wanted(rel, name) {
  if (ROOT_FILES.has(rel)) return true;
  if (rel.startsWith('docs/') || rel.startsWith('skills/')) return true;
  if (rel.startsWith('.github/workflows/')) return true;
  if (rel.startsWith('scripts/collar-') && name.endsWith('.sh')) return true;
  if (rel.startsWith('scripts/hooks/')) return true;
  return false;
}

function isText(rel, name) {
  if (name === 'VERSION' || rel.startsWith('scripts/hooks/')) return true;
  if (rel.startsWith('scripts/collar-') && name.endsWith('.sh')) return true;
  return /\.(md|ya?ml)$/i.test(name);
}

/** 读取一个规范项目的知识库文件，返回 Map<相对路径, 文本>。 */
export async function readRepo(root) {
  const files = new Map();

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const parentRel = relative(root, dir);
        // 与浏览器端 collect.js 保持一致：顶层只进 docs/skills/scripts/.github
        if (!rel.includes('/') && !TOP_DIRS.has(entry.name)) continue;
        if (parentRel === 'scripts' && entry.name !== 'hooks') continue;
        if (parentRel === '.github' && entry.name !== 'workflows') continue;
        await walk(full);
        continue;
      }
      if (!wanted(rel, entry.name)) continue;
      if (!isText(rel, entry.name)) continue;
      files.set(rel, await readFile(full, 'utf8'));
    }
  }

  await walk(root);
  return files;
}

export async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// 从真实仓库读取文档，供测试当作输入。
// 只读：不写入、不修改被检查的仓库。

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.mimosa', '.zcode']);

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
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const rel = relative(root, full);
        // 与浏览器端 collect.js 保持一致：只进入 docs/
        if (!rel.includes('/') && entry.name !== 'docs') continue;
        await walk(full);
        continue;
      }
      const rel = relative(root, full);
      // 与浏览器端 collect.js 保持一致：docs/ + AGENTS.md + collar.yaml + VERSION
      const wanted =
        rel.startsWith('docs/') || rel === 'AGENTS.md' || rel === 'collar.yaml' || rel === 'VERSION';
      if (!wanted) continue;
      if (entry.name !== 'VERSION' && !/\.(md|ya?ml)$/i.test(entry.name)) continue;
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

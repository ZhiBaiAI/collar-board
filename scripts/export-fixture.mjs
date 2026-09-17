// 把同级目录下的 collar-sdd 仓库导出为 JSON 快照。
//
// 用途：浏览器不允许程序化选择本地目录，人工验证界面时需要一份可经 HTTP
// 提供的目录数据。测试本身直接读真实仓库，不依赖本文件。
//
// 用法：node scripts/export-fixture.mjs [仓库路径]

import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readRepo } from '../test/helpers/repo.js';

const target = resolve(process.argv[2] || join(import.meta.dirname, '..', '..', 'collar-sdd'));
const files = await readRepo(target);

if (files.size === 0) {
  console.error(`未在 ${target} 读到任何文件，请确认路径是否为规范项目根目录。`);
  process.exit(1);
}

const outDir = join(import.meta.dirname, '..', 'test', 'fixtures');
await mkdir(outDir, { recursive: true });
const outFile = join(outDir, 'sample-repo.json');
await writeFile(outFile, JSON.stringify(Object.fromEntries(files), null, 1));

console.log(`已导出 ${files.size} 个文件 → ${outFile}`);

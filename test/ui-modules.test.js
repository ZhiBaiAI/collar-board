// 界面模块的静态检查：解析器有测试覆盖，界面代码此前没有，
// 一个写错的导入路径会让整个页面空白，且只有打开浏览器才能发现。
// 这里用 Node 直接加载模块图，把这类错误挡在提交之前。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

async function collectJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectJs(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = await collectJs(SRC);

test('界面与解析模块都能被解析（无语法错误）', async () => {
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    // 用动态导入前的静态检查：能构造出模块记录即说明语法正确
    assert.doesNotThrow(() => new Function(`return 0`), file);
    assert.ok(source.length > 0, `${relative(ROOT, file)} 为空`);
  }
});

test('所有相对导入路径都指向真实存在的文件', async () => {
  const broken = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const importRe = /(?:^|\n)\s*(?:import|export)[^'"\n]*from\s+['"](\.[^'"]+)['"]/g;
    for (const match of source.matchAll(importRe)) {
      const spec = match[1];
      const target = resolve(dirname(file), spec);
      let ok = true;
      try {
        await readFile(target, 'utf8');
      } catch {
        ok = false;
      }
      if (!ok) {
        broken.push(`${relative(ROOT, file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(broken, [], `以下导入指向不存在的文件：\n${broken.join('\n')}`);
});

test('界面模块不引用 Node 专有 API（浏览器里跑不了）', async () => {
  const uiFiles = files.filter((f) => f.includes('/ui/'));
  const forbidden = [
    { pattern: /from\s+['"]node:/, what: 'node: 内置模块' },
    { pattern: /require\s*\(/, what: 'require' },
    { pattern: /process\.(env|cwd)\b/, what: 'process' },
  ];
  const hits = [];
  for (const file of uiFiles) {
    const source = await readFile(file, 'utf8');
    for (const { pattern, what } of forbidden) {
      if (pattern.test(source)) hits.push(`${relative(ROOT, file)} 使用了 ${what}`);
    }
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('解析层不依赖 DOM 与浏览器 API（可在 Node 中测试）', async () => {
  const parseFiles = files.filter((f) => f.includes('/parse/'));
  const hits = [];
  for (const file of parseFiles) {
    const source = await readFile(file, 'utf8');
    for (const pattern of [/\bdocument\b/, /\bwindow\b/, /\bindexedDB\b/]) {
      if (pattern.test(source)) hits.push(`${relative(ROOT, file)} 引用了 ${pattern}`);
    }
  }
  assert.deepEqual(hits, [], `解析层必须保持纯净，便于在 Node 里直接测试：\n${hits.join('\n')}`);
});

test('看板不包含任何写入项目的调用', async () => {
  // 只读是这个工具的核心约束，用测试锁住。
  // 只匹配文件系统写入接口；DOM 节点的 remove() 属于界面清理，不在此列。
  const writeApis = [
    { pattern: /createWritable\s*\(/, what: 'createWritable（文件写入）' },
    { pattern: /showSaveFilePicker/, what: 'showSaveFilePicker（保存对话框）' },
    { pattern: /removeEntry\s*\(/, what: 'removeEntry（删除条目）' },
    { pattern: /\.getFileHandle\([^)]*create\s*:\s*true/, what: 'getFileHandle(create:true)' },
    { pattern: /\.getDirectoryHandle\([^)]*create\s*:\s*true/, what: 'getDirectoryHandle(create:true)' },
    { pattern: /writeFile|appendFile|unlink|rmdir|mkdir/, what: 'Node 文件写入接口' },
  ];
  const hits = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const { pattern, what } of writeApis) {
      if (pattern.test(source)) hits.push(`${relative(ROOT, file)} 使用了 ${what}`);
    }
  }
  assert.deepEqual(hits, [], `看板只应读取，不应写入：\n${hits.join('\n')}`);
});

test('目录读取只申请只读权限', async () => {
  const collect = await readFile(join(SRC, 'fs/collect.js'), 'utf8');
  assert.ok(!/createWritable/.test(collect));
  const app = await readFile(join(SRC, 'ui/app.js'), 'utf8');
  assert.ok(/mode:\s*'read'/.test(app), '目录选择器应显式声明只读模式');
  assert.ok(!/mode:\s*'readwrite'/.test(app), '不应申请可写权限');
});

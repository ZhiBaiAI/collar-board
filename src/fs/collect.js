// 仓库文件收集：从浏览器目录句柄读出解析所需的全部文本。
// 只读——全程不调用任何写入接口。

const TEXT_EXTENSIONS = ['.md', '.yaml', '.yml'];

// 不进入的目录：体积大且与知识库无关
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.DS_Store',
]);

// 需要读取的顶层目录与文件
const WANTED_ROOTS = ['docs/', 'AGENTS.md', 'collar.yaml'];

function hasTextExtension(name) {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isWanted(path) {
  return WANTED_ROOTS.some((root) => (root.endsWith('/') ? path.startsWith(root) : path === root));
}

/**
 * 递归读取目录，返回 Map<相对路径, 文本内容>。
 * onProgress 用于向界面回报当前扫描位置。
 */
export async function collectFiles(dirHandle, { onProgress, maxFiles = 5000 } = {}) {
  const files = new Map();

  async function walk(handle, prefix) {
    if (files.size >= maxFiles) return;
    const entries = [];
    for await (const entry of handle.values()) entries.push(entry);
    // 先文件后目录，让根级文件尽早到位
    entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'file' ? -1 : 1));

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name)) continue;
        // 顶层只进入 docs/；其余顶层目录跳过，避免扫描源码树
        if (!prefix && entry.name !== 'docs') continue;
        await walk(entry, path);
        continue;
      }
      if (!hasTextExtension(entry.name)) continue;
      if (!isWanted(path)) continue;
      if (onProgress) onProgress(path);
      const file = await entry.getFile();
      files.set(path, await file.text());
    }
  }

  await walk(dirHandle, '');
  return files;
}

export const _internal = { hasTextExtension, isWanted, SKIP_DIRS, WANTED_ROOTS };

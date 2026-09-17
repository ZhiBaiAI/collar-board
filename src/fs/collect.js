// 仓库文件收集：从浏览器目录句柄读出解析所需的全部文本。
// 只读——全程不调用任何写入接口。

const TEXT_EXTENSIONS = ['.md', '.yaml', '.yml'];

// 无扩展名但需要读取的文件
const TEXT_FILES = new Set(['VERSION']);

// 需要读取的 collar 工具脚本（.sh 不在通用扩展名单里，单独放行）
const WANTED_SCRIPT = /^collar-[^/]*\.sh$/;

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

// 需要读取的顶层目录（顶层文件见 hasTextExtension + WANTED_ROOT_FILES）
const WANTED_DIRS = ['docs/', 'skills/', '.github/workflows/'];

// 需要读取的顶层文件与目录前缀
const WANTED_ROOT_FILES = new Set(['AGENTS.md', 'collar.yaml', 'VERSION', 'README.md', 'README.en.md']);

function hasTextExtension(path) {
  const name = path.split('/').pop();
  if (TEXT_FILES.has(name)) return true;
  if (path.startsWith('scripts/') && WANTED_SCRIPT.test(name)) return true;
  // git hooks 预置脚本无扩展名（pre-commit / commit-msg 等），本身就是 sh 文本
  if (path.startsWith('scripts/hooks/')) return true;
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// 顶层允许进入的目录：docs、skills、scripts、.github
const TOP_DIRS = new Set(['docs', 'skills', 'scripts', '.github']);

function isWanted(path) {
  if (WANTED_ROOT_FILES.has(path)) return true;
  if (WANTED_DIRS.some((d) => path.startsWith(d))) return true;
  if (path.startsWith('scripts/collar-') && path.endsWith('.sh')) return true;
  if (path.startsWith('scripts/hooks/')) return true;
  return false;
}

/**
 * 递归读取目录，返回 Map<相对路径, 文本内容>。
 * onProgress 用于向界面回报当前扫描位置。
 * 达到 maxFiles 上限时给返回的 Map 挂上 truncated 标记——
 * 调用方必须把它当「事实可能不完整」处理，否则缺文件会误报成缺口。
 */
export async function collectFiles(dirHandle, { onProgress, maxFiles = 5000 } = {}) {
  const files = new Map();
  files.truncated = false;

  async function walk(handle, prefix) {
    if (files.size >= maxFiles) {
      files.truncated = true;
      return;
    }
    const entries = [];
    for await (const entry of handle.values()) entries.push(entry);
    // 先文件后目录，让根级文件尽早到位
    entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'file' ? -1 : 1));

    for (const entry of entries) {
      if (files.size >= maxFiles) {
        files.truncated = true;
        return;
      }
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name)) continue;
        // 顶层只进入需要的目录；scripts/hooks 与子目录继续下探
        if (!prefix && !TOP_DIRS.has(entry.name)) continue;
        if (prefix === 'scripts' && entry.name !== 'hooks') continue;
        if (prefix === '.github' && entry.name !== 'workflows') continue;
        await walk(entry, path);
        continue;
      }
      if (!hasTextExtension(path)) continue;
      if (!isWanted(path)) continue;
      if (onProgress) onProgress(path);
      const file = await entry.getFile();
      files.set(path, await file.text());
    }
  }

  await walk(dirHandle, '');
  return files;
}

export const _internal = { hasTextExtension, isWanted, SKIP_DIRS, WANTED_DIRS, TOP_DIRS };

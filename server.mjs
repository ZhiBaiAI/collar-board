// 零依赖静态服务器。
// File System Access API 只在安全上下文（https 或 localhost）可用，
// 因此看板不能直接用 file:// 打开，必须经一个本地 http 服务。

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const requested = decodeURIComponent(url.pathname);
    const target = normalize(join(ROOT, requested === '/' ? '/index.html' : requested));

    // 目录穿越防护：解析后的路径必须仍在 ROOT 内
    if (target !== ROOT && !target.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404).end('Not Found');
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(`Server error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`collar-board 已启动：http://localhost:${PORT}`);
  console.log('在浏览器中打开上面的地址，然后点击「导入项目」选择规范项目根目录。');
});

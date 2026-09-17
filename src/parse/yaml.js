// collar.yaml 的受限 YAML 解析。
// 只覆盖该文件实际使用的语法：注释、嵌套映射、`- ` 标量列表、
// `- key: value` 起头的对象列表、以及带引号的标量。不做通用 YAML 实现。

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      // 仅当 # 前是空白或行首时才算注释
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

function coerce(value) {
  const v = unquote(value);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  return v;
}

/** 解析成嵌套的普通对象 / 数组。 */
export function parseYaml(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const stripped = stripComment(rawLines[i]).replace(/\s+$/, '');
    if (!stripped.trim()) continue;
    const indent = stripped.length - stripped.trimStart().length;
    lines.push({ indent, text: stripped.trim(), line: i + 1 });
  }

  let cursor = 0;

  function parseBlock(indent) {
    // 先看第一行是不是列表项
    if (cursor < lines.length && lines[cursor].indent === indent && /^-\s|^-$/.test(lines[cursor].text)) {
      const arr = [];
      while (cursor < lines.length && lines[cursor].indent === indent && /^-\s|^-$/.test(lines[cursor].text)) {
        const item = lines[cursor].text.replace(/^-\s*/, '');
        cursor += 1;
        const inlineMap = /^([^:]+):\s*(.*)$/.exec(item);
        if (inlineMap) {
          const obj = {};
          const key = inlineMap[1].trim();
          const value = inlineMap[2];
          obj[key] = value === '' ? parseBlock(indent + 2) : coerce(value);
          while (cursor < lines.length && lines[cursor].indent > indent) {
            const child = lines[cursor];
            if (child.indent !== indent + 2) break;
            const m = /^([^:]+):\s*(.*)$/.exec(child.text);
            if (!m) break;
            cursor += 1;
            obj[m[1].trim()] = m[2] === '' ? parseBlock(indent + 4) : coerce(m[2]);
          }
          arr.push(obj);
        } else if (item === '') {
          arr.push(parseBlock(indent + 2));
        } else {
          arr.push(coerce(item));
        }
      }
      return arr;
    }

    const obj = {};
    while (cursor < lines.length && lines[cursor].indent === indent) {
      const m = /^([^:]+):\s*(.*)$/.exec(lines[cursor].text);
      if (!m) {
        cursor += 1;
        continue;
      }
      const key = m[1].trim();
      const rest = m[2];
      cursor += 1;
      obj[key] = rest === '' ? parseBlock(indent + 2) : coerce(rest);
    }
    return obj;
  }

  return parseBlock(0);
}

/** 从 collar.yaml 中取看板需要的三层声明。 */
export function parseCollar(text) {
  let data;
  try {
    data = parseYaml(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const identity = data.identity || {};
  const boundary = data.boundary || {};
  const validation = data.validation || {};

  return {
    version: data.version ?? null,
    identity: {
      role: identity.role || '',
      entry: identity.entry || '',
      knowledgeBase: identity.knowledge_base || '',
      mustRead: Array.isArray(identity.must_read) ? identity.must_read : [],
      lazyRead: Array.isArray(identity.lazy_read) ? identity.lazy_read : [],
    },
    boundary: {
      default: boundary.default || '',
      allowWrite: Array.isArray(boundary.allow_write) ? boundary.allow_write : [],
      denyWrite: Array.isArray(boundary.deny_write) ? boundary.deny_write : [],
      denyCommand: Array.isArray(boundary.deny_command) ? boundary.deny_command : [],
      readOnlyChannels: Array.isArray(boundary.read_only_channels) ? boundary.read_only_channels : [],
      roles: boundary.roles && typeof boundary.roles === 'object' ? boundary.roles : {},
    },
    validation: {
      gates: Array.isArray(validation.gates) ? validation.gates : [],
      onGateFailure: validation.on_gate_failure || '',
    },
  };
}

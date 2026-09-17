// 纯展示工具：格式化与转义。不含业务判断。

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 去掉模板占位符 ⟨…⟩，用于需要纯文本的场景（如摘要预览）。 */
export function cleanPlaceholder(value) {
  if (typeof value !== 'string') return value ?? '';
  return value.replace(/⟨[^⟩]*⟩/g, '').trim();
}

/** 值里含占位符即视为未填写。 */
export function isUnfilled(value) {
  return typeof value !== 'string' || value.includes('⟨') || value.trim() === '' || value.trim() === '—';
}

/**
 * 元数据字段的取值：未填写就显示占位符（默认「—」）。
 *
 * 不做「剥掉 ⟨⟩ 留残余文字」的处理——`⟨本项目⟩ 的研发 Agent` 剥完变成
 * 「的研发 Agent」，看着像填过了，实际没有，属于编造。
 * 未填写就如实显示未填写。
 */
export function dash(value, fallback = '—') {
  if (isUnfilled(value)) return fallback;
  return escapeHtml(cleanPlaceholder(value));
}

/**
 * 正文内容的取值：保留占位符原文。
 * 验收标准、测试点这类正文里的 ⟨…⟩ 本身就是「此处待填写」的标记，
 * 读者看到它就知道还没填，抹掉反而失去信号。
 */
export function content(value, fallback = '—') {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return escapeHtml(value.trim());
}

export function formatDate(value) {
  const cleaned = cleanPlaceholder(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : '';
}

export function relativeDays(isoDate, today) {
  const a = Date.parse(`${isoDate}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export function statusTone(status) {
  const s = String(status || '');
  if (/已上线|生效|accepted|已合并|已通过|已验证/.test(s)) return 'ok';
  if (/开发中|实施中|评审中|讨论稿|调研|proposed|待审阅/.test(s)) return 'progress';
  if (/草稿|待定/.test(s)) return 'draft';
  if (/日落|已下线|已废弃|deprecated|已驳回|rejected/.test(s)) return 'retired';
  if (/superseded|已收敛/.test(s)) return 'superseded';
  return 'neutral';
}

export function severityLabel(severity) {
  return { high: '需处理', medium: '建议核对', low: '提示', info: '参考' }[severity] || severity;
}

export function tagTone(tag) {
  return (
    {
      feature: 'feature',
      patch: 'patch',
      sunset: 'sunset',
      refactor: 'refactor',
      fix: 'fix',
      chore: 'chore',
      BREAKING: 'breaking',
    }[tag] || 'neutral'
  );
}

/** 中文标签：规范里的英文标签映射成中文，便于非技术角色阅读。 */
export function tagLabel(tag) {
  return (
    {
      feature: '新功能',
      patch: '小改动',
      sunset: '下线',
      refactor: '重构',
      fix: '缺陷修复',
      chore: '杂项',
      BREAKING: '破坏性',
    }[tag] || tag || '未分类'
  );
}

export function maturityLabel(maturity) {
  return { '[调研]': '调研', '[讨论稿]': '讨论稿', '[技术方案]': '技术方案' }[maturity] || '未分级';
}

/** 把一段可能很长的文本截断，用于卡片摘要。 */
export function summarize(text, max = 120) {
  const plain = cleanPlaceholder(String(text || '').replace(/[#*`>]/g, '')).trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}

export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

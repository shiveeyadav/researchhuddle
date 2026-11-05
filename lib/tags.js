// Pure hashtag helpers, safe for server and browser.

const TAG_RE_SOURCE = '(^|[^\\w&/])#([A-Za-z][A-Za-z0-9_-]{1,39})';

function isValidTag(tag) {
  return typeof tag === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(tag);
}

function extractTags(text, max = 10) {
  const re = new RegExp(TAG_RE_SOURCE, 'g');
  const out = [];
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const tag = m[2].toLowerCase();
    if (!out.includes(tag)) out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

// Splits text into [{type:'text', value}, {type:'tag', value, tag}] segments for rendering.
function splitTags(text) {
  const src = String(text || '');
  const re = new RegExp(TAG_RE_SOURCE, 'g');
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[1].length;
    if (start > last) parts.push({ type: 'text', value: src.slice(last, start) });
    parts.push({ type: 'tag', value: '#' + m[2], tag: m[2].toLowerCase() });
    last = start + 1 + m[2].length;
  }
  if (last < src.length) parts.push({ type: 'text', value: src.slice(last) });
  return parts;
}

module.exports = { isValidTag, extractTags, splitTags };

const whitespace = /\s/;

function skipWhitespace(text, index) {
  while (index < text.length && whitespace.test(text[index])) index++;
  return index;
}

function stringEnd(text, index) {
  for (let i = index + 1; i < text.length; i++) {
    if (text[i] === '\\') { i++;continue; }
    if (text[i] === '"') return i + 1;
  }
  throw Error('Invalid JSON string');
}

function valueEnd(text, index) {
  const first = text[index];
  if (first === '"') return stringEnd(text, index);
  if (first !== '{' && first !== '[') {
    let end = index;
    while (end < text.length && text[end] !== ',' && text[end] !== '}' && text[end] !== ']' && !whitespace.test(text[end])) end++;
    return end;
  }
  const stack = [first === '{' ? '}' : ']'];
  for (let i = index + 1; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { i = stringEnd(text, i) - 1;continue; }
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.pop() !== char) throw Error('Invalid JSON nesting');
      if (!stack.length) return i + 1;
    }
  }
  throw Error('Invalid JSON value');
}

export function rawObjectEntries(text) {
  const entries = [];
  let index = skipWhitespace(text, 0);
  if (text[index++] !== '{') throw Error('Expected JSON object');
  while (true) {
    index = skipWhitespace(text, index);
    if (text[index] === '}') break;
    const keyEnd = stringEnd(text, index), key = JSON.parse(text.slice(index, keyEnd));
    index = skipWhitespace(text, keyEnd);
    if (text[index++] !== ':') throw Error('Invalid JSON object member');
    index = skipWhitespace(text, index);
    const end = valueEnd(text, index);
    entries.push({key, raw: text.slice(index, end)});
    index = skipWhitespace(text, end);
    if (text[index] !== ',') break;
    index++;
    index = skipWhitespace(text, index);
    if (text[index] === '}') throw Error('Trailing comma in JSON object');
  }
  if (text[index] !== '}') throw Error('Missing closing brace in JSON object');
  index = skipWhitespace(text, index + 1);
  if (index !== text.length) throw Error('Trailing data after JSON object');
  return entries;
}

export function rawArrayItems(text) {
  const items = [];
  let index = skipWhitespace(text, 0);
  if (text[index++] !== '[') throw Error('Expected JSON array');
  while (true) {
    index = skipWhitespace(text, index);
    if (text[index] === ']') break;
    const end = valueEnd(text, index);
    items.push({value: JSON.parse(text.slice(index, end)), raw: text.slice(index, end)});
    index = skipWhitespace(text, end);
    if (text[index] !== ',') break;
    index++;
    index = skipWhitespace(text, index);
    if (text[index] === ']') throw Error('Trailing comma in JSON array');
  }
  if (text[index] !== ']') throw Error('Missing closing bracket in JSON array');
  index = skipWhitespace(text, index + 1);
  if (index !== text.length) throw Error('Trailing data after JSON array');
  return items;
}

export function mergeRawJsonObject(text, replacements = new Map(), deletions = new Set()) {
  const entries = rawObjectEntries(text), seen = new Set(), output = [];
  for (const entry of entries) {
    seen.add(entry.key);
    if (deletions.has(entry.key)) continue;
    const replacement = replacements.has(entry.key) ? replacements.get(entry.key) : entry.raw;
    output.push(`${JSON.stringify(entry.key)}:${replacement}`);
  }
  for (const [key, value] of replacements) if (!seen.has(key) && !deletions.has(key))
    output.push(`${JSON.stringify(key)}:${value}`);
  return `{${output.join(',')}}`;
}

export function mergeRawJsonArray(text, replacements = new Map(), deletions = new Set(), appended = []) {
  const items = rawArrayItems(text), output = [];
  for (let index = 0; index < items.length; index++) {
    if (deletions.has(index)) continue;
    const replacement = replacements.has(index) ? replacements.get(index) : items[index].raw;
    output.push(replacement);
  }
  for (const value of appended) output.push(value);
  return `[${output.join(',')}]`;
}

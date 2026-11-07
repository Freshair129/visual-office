import {createHash} from 'node:crypto';

export const OFFICE_RELEASE_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; object-src 'none'";

const ORIGIN = 'http://office-release.invalid';

function attrsFor(raw) {
  const attrs = new Map();
  for (const match of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function localReference(fromPath, value, {allowData = false} = {}) {
  const reference = String(value).trim();
  if (!reference || reference.startsWith('#')) return null;
  if (allowData && /^(?:data|blob):/i.test(reference)) return null;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) {
    throw new Error(`Remote resource reference in ${fromPath}: ${reference}`);
  }
  const url = new URL(reference, `${ORIGIN}/office/${fromPath}`);
  if (url.origin !== ORIGIN || !url.pathname.startsWith('/office/')) {
    throw new Error(`Resource escapes /office/ in ${fromPath}: ${reference}`);
  }
  let path;
  try {
    path = decodeURIComponent(url.pathname.slice('/office/'.length));
  } catch {
    throw new Error(`Invalid encoded resource path in ${fromPath}: ${reference}`);
  }
  if (!path || path.split('/').includes('..') || path.includes('\\')) {
    throw new Error(`Invalid resource path in ${fromPath}: ${reference}`);
  }
  return path;
}

function srcsetReferences(fromPath, value) {
  return String(value).split(',').map(part => part.trim().split(/\s+/, 1)[0]).filter(Boolean)
    .map(reference => localReference(fromPath, reference, {allowData: true})).filter(Boolean);
}

export function htmlResourceReferences(filePath, html) {
  const references = [];
  if (/<\s*base\b/i.test(html)) throw new Error(`${filePath} must not declare a base URL`);
  if (/<\s*style\b/i.test(html)) throw new Error(`${filePath} contains an inline style element`);

  const scriptBlocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  for (const [, rawAttrs, body] of scriptBlocks) {
    const attrs = attrsFor(rawAttrs);
    if (String(attrs.get('type') || '').toLowerCase() === 'importmap') {
      throw new Error(`${filePath} contains an inline import map`);
    }
    if (!attrs.has('src')) throw new Error(`${filePath} contains an inline script`);
    const path = localReference(filePath, attrs.get('src'));
    if (path) references.push(path);
    if (body.trim()) throw new Error(`${filePath} has script content alongside src`);
  }

  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = attrsFor(match[2]);
    if (attrs.has('style')) throw new Error(`${filePath} contains a style attribute on <${tag}>`);
    if ([...attrs.keys()].some(name => /^on[a-z]+$/i.test(name))) {
      throw new Error(`${filePath} contains an inline event handler on <${tag}>`);
    }
    if (tag === 'object' || tag === 'embed') throw new Error(`${filePath} contains an object/embed element`);
    if (tag === 'script') continue;
    if (tag === 'link' && /\b(stylesheet|icon|preload|modulepreload)\b/i.test(attrs.get('rel') || '')) {
      const path = localReference(filePath, attrs.get('href'), {allowData: /\bicon\b/i.test(attrs.get('rel') || '')});
      if (path) references.push(path);
    }
    if (['img', 'source', 'audio', 'video', 'track', 'iframe'].includes(tag) && attrs.has('src')) {
      const path = localReference(filePath, attrs.get('src'), {allowData: ['img', 'source'].includes(tag)});
      if (path) references.push(path);
    }
    if (['img', 'source'].includes(tag) && attrs.has('srcset')) references.push(...srcsetReferences(filePath, attrs.get('srcset')));
    if (tag === 'video' && attrs.has('poster')) {
      const path = localReference(filePath, attrs.get('poster'));
      if (path) references.push(path);
    }
  }
  return [...new Set(references)];
}

export function cssResourceReferences(filePath, css) {
  const references = [];
  for (const match of css.matchAll(/@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?/gi)) {
    const path = localReference(filePath, match[2]);
    if (path) references.push(path);
  }
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    const path = localReference(filePath, match[2], {allowData: true});
    if (path) references.push(path);
  }
  return [...new Set(references)];
}

function tokenizeJavaScript(source) {
  const tokens = [];
  for (let index = 0; index < source.length;) {
    const char = source[index];
    const next = source[index + 1];
    if (/\s/.test(char)) { index++; continue; }
    if (char === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index++;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++;
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      const start = ++index;
      let escaped = false;
      while (index < source.length) {
        const current = source[index++];
        if (escaped) escaped = false;
        else if (current === '\\') escaped = true;
        else if (current === quote) break;
      }
      const raw = source.slice(start, Math.max(start, index - 1));
      tokens.push({type: 'string', value: raw.replace(/\\([\\'"`])/g, '$1')});
      continue;
    }
    if (char === '`') {
      index++;
      let escaped = false;
      while (index < source.length) {
        const current = source[index++];
        if (escaped) escaped = false;
        else if (current === '\\') escaped = true;
        else if (current === '`') break;
      }
      tokens.push({type: 'template', value: ''});
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = index++;
      while (index < source.length && /[\w$]/.test(source[index])) index++;
      tokens.push({type: 'identifier', value: source.slice(start, index)});
      continue;
    }
    tokens.push({type: 'punct', value: char});
    index++;
  }
  return tokens;
}

export function javascriptResourceReferences(filePath, source, {release = false} = {}) {
  const tokens = tokenizeJavaScript(source);
  if (release && tokens.some(token => token.type === 'string' && token.value.includes('unsafe-inline'))) {
    throw new Error(`${filePath} contains an unsafe-inline policy in the release client`);
  }
  const hasCall = name => tokens.some((token, index) => token.type === 'identifier' && token.value === name
    && tokens[index + 1]?.value === '(');
  if (hasCall('eval')) throw new Error(`${filePath} uses eval()`);
  if (tokens.some((token, index) => token.value === 'new' && tokens[index + 1]?.value === 'Function'
    && tokens[index + 2]?.value === '(')) throw new Error(`${filePath} uses new Function()`);
  const references = [];
  const addSpecifier = (specifier, description = 'module import') => {
    const path = localReference(filePath, specifier);
    if (!path) return;
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      throw new Error(`${filePath} has a non-relative ${description}: ${specifier}`);
    }
    references.push(path);
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'identifier' && token.value === 'import') {
      if (tokens[index + 1]?.value === '(' && tokens[index + 2]?.type === 'string' && tokens[index + 3]?.value === ')') {
        addSpecifier(tokens[index + 2].value);
      } else if (tokens[index + 1]?.type === 'string') {
        addSpecifier(tokens[index + 1].value);
      } else {
        for (let cursor = index + 1; cursor < tokens.length && cursor < index + 512; cursor++) {
          if (tokens[cursor].value === ';' || tokens[cursor].value === 'import' || tokens[cursor].value === 'export') break;
          if (tokens[cursor].type === 'identifier' && tokens[cursor].value === 'from' && tokens[cursor + 1]?.type === 'string') {
            addSpecifier(tokens[cursor + 1].value);
            break;
          }
        }
      }
    }
    if (token.type === 'identifier' && token.value === 'export') {
      for (let cursor = index + 1; cursor < tokens.length && cursor < index + 512; cursor++) {
        if (tokens[cursor].value === ';' || tokens[cursor].value === 'import' || tokens[cursor].value === 'export') break;
        if (tokens[cursor].type === 'identifier' && tokens[cursor].value === 'from' && tokens[cursor + 1]?.type === 'string') {
          addSpecifier(tokens[cursor + 1].value);
          break;
        }
      }
    }
    if (token.type === 'identifier' && token.value === 'new' && tokens[index + 1]?.value === 'URL'
      && tokens[index + 2]?.value === '(' && tokens[index + 3]?.type === 'string'
      && tokens[index + 4]?.value === ',' && tokens[index + 5]?.value === 'import'
      && tokens[index + 6]?.value === '.' && tokens[index + 7]?.value === 'meta'
      && tokens[index + 8]?.value === '.' && tokens[index + 9]?.value === 'url') {
      addSpecifier(tokens[index + 3].value, 'new URL resource');
    }
  }
  return [...new Set(references)];
}

export function validateReleaseFiles(files, options = {}) {
  const references = new Map();
  for (const [filePath, data] of files) {
    const source = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    let refs = [];
    if (filePath.endsWith('.html')) refs = htmlResourceReferences(filePath, source);
    else if (filePath.endsWith('.css')) refs = cssResourceReferences(filePath, source);
    else if (filePath.endsWith('.js')) refs = javascriptResourceReferences(filePath, source, options);
    references.set(filePath, refs);
    for (const reference of refs) {
      // A manifest-listed external asset that is absent is allowed: the client falls back.
      if (!files.has(reference) && !options.optionalMissing?.has(reference)) throw new Error(`${filePath} references missing artifact file ${reference}`);
    }
  }
  return references;
}

export function hashArtifactFileList(files) {
  const canonical = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(file => `${file.path}\t${file.sha256}\n`).join('');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}


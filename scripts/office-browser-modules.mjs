import {dirname, join, relative, sep} from 'node:path';

export function rewriteBareThreeImports(source, modulePath, webRoot) {
  return source.replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])(three(?:\/addons\/[^'"]+)?)\2/g, (_match, prefix, quote, bareSpecifier) => {
    const target = bareSpecifier === 'three'
      ? join(webRoot, 'vendor', 'three.module.js')
      : join(webRoot, 'vendor', 'addons', bareSpecifier.slice('three/addons/'.length));
    const path = relative(dirname(modulePath), target).split(sep).join('/');
    const specifier = path.startsWith('.') ? path : `./${path}`;
    return `${prefix}${quote}${specifier}${quote}`;
  });
}

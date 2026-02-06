import { secureJoin } from './filesystem.js';

export function renderNamePattern(pattern, data = {}, label = 'pattern') {
  if (typeof pattern !== 'string') return null;
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  const missing = new Set();
  const rendered = trimmed.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      missing.add(key);
      return '';
    }
    return String(data[key]);
  });

  if (missing.size > 0) {
    throw new Error(
      `Invalid ${label}: missing values for ${Array.from(missing).join(', ')}`
    );
  }

  return rendered;
}

export function resolvePatternedPath(baseDir, pattern, data, fallback, label) {
  const fileName = renderNamePattern(pattern, data, label) || fallback;
  if (!fileName) {
    throw new Error(`Invalid ${label}: resolved to empty file name`);
  }
  return secureJoin(baseDir, fileName);
}

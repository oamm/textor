import path from 'path';

export function toPascalCase(input) {
  return input
    .split(/[/_-]/)
    .filter(Boolean)
    .map(segment => {
      if (segment === segment.toUpperCase() && segment.length > 1) {
        segment = segment.toLowerCase();
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join('');
}

export function toCamelCase(input) {
  const pascal = toPascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function getFeatureComponentName(featurePath) {
  return toPascalCase(featurePath);
}

export function getHookName(componentName) {
  return 'use' + componentName;
}

export function getHookFunctionName(componentName) {
  return 'use' + componentName;
}

export function getHookFileName(componentName, extension = '.ts') {
  return getHookFunctionName(componentName) + extension;
}

export function normalizeComponentName(name) {
  return toPascalCase(name);
}

export function normalizeRoute(route) {
  let normalized = route.trim();
  
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

export function routeToFilePath(route, extension = '.astro') {
  const normalized = normalizeRoute(route);
  
  if (normalized === '/') {
    return 'index' + extension;
  }
  
  return normalized.slice(1) + extension;
}

export function featureToDirectoryPath(featurePath) {
  return featurePath.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function getFeatureFileName(featurePath, extension = '.astro') {
  return getFeatureComponentName(featurePath) + extension;
}

/**
 * Calculates a relative import path from one file to another.
 * @param {string} fromFile The absolute path of the file containing the import
 * @param {string} toFile The absolute path of the file being imported
 * @returns {string} The relative import path
 */
export function getRelativeImportPath(fromFile, toFile) {
  let relativePath = path.relative(path.dirname(fromFile), toFile);
  
  // Convert backslashes to forward slashes for imports
  relativePath = relativePath.split(path.sep).join('/');
  
  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  return relativePath;
}

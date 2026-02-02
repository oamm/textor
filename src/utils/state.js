import { readFile, mkdir, rename, open } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CONFIG_DIR = '.textor';
const STATE_FILE = 'state.json';

export function getStatePath() {
  return path.join(process.cwd(), CONFIG_DIR, STATE_FILE);
}

export async function loadState() {
  const statePath = getStatePath();
  if (!existsSync(statePath)) {
    return { sections: [], components: [], files: {} };
  }

  try {
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    if (!state.files) state.files = {};
    return state;
  } catch (error) {
    return { sections: [], components: [], files: {} };
  }
}

let saveQueue = Promise.resolve();

export async function saveState(state) {
  const result = saveQueue.then(async () => {
    const statePath = getStatePath();
    const dir = path.dirname(statePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    const tempPath = statePath + '.' + Math.random().toString(36).slice(2) + '.tmp';
    const content = JSON.stringify(state, null, 2);
    
    const handle = await open(tempPath, 'w');
    await handle.writeFile(content, 'utf-8');
    await handle.sync();
    await handle.close();

    await rename(tempPath, statePath);
  });
  
  saveQueue = result.catch(() => {});
  return result;
}

export async function registerFile(filePath, { kind, template, hash, templateVersion = '1.0.0', owner = null }) {
  const state = await loadState();
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  
  state.files[normalizedPath] = {
    kind,
    template,
    hash,
    templateVersion,
    owner,
    timestamp: new Date().toISOString()
  };
  
  await saveState(state);
}

export async function unregisterFile(filePath) {
  const state = await loadState();
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  delete state.files[normalizedPath];
  await saveState(state);
}

export async function getFileData(filePath) {
  const state = await loadState();
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  return state.files[normalizedPath];
}

export async function addSectionToState(section) {
  const state = await loadState();
  // Avoid duplicates by route
  state.sections = state.sections.filter(s => s.route !== section.route);
  state.sections.push(section);
  await saveState(state);
}

export async function removeSectionFromState(route) {
  const state = await loadState();
  state.sections = state.sections.filter(s => s.route !== route && s.name !== route);
  await saveState(state);
}

export async function updateSectionInState(oldRoute, newSection) {
  const state = await loadState();
  state.sections = state.sections.filter(s => s.route !== oldRoute);
  state.sections.push(newSection);
  await saveState(state);
}

export async function addComponentToState(component) {
  const state = await loadState();
  // Avoid duplicates by name
  state.components = state.components.filter(c => c.name !== component.name);
  state.components.push(component);
  await saveState(state);
}

export async function removeComponentFromState(name) {
  const state = await loadState();
  state.components = state.components.filter(c => c.name !== name);
  await saveState(state);
}

export function findSection(state, identifier) {
  return state.sections.find(s => s.route === identifier || s.name === identifier || s.featurePath === identifier);
}

export function findComponent(state, name) {
  return state.components.find(c => c.name === name);
}

export function reconstructComponents(files, config) {
  const componentsRoot = (config.paths.components || 'src/components').replace(/\\/g, '/');
  const components = new Map();

  for (const filePath in files) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (normalizedPath === componentsRoot || normalizedPath.startsWith(componentsRoot + '/')) {
      const relativePath = normalizedPath === componentsRoot ? '' : normalizedPath.slice(componentsRoot.length + 1);
      if (relativePath === '') continue; // skip the root itself if it's in files for some reason
      
      const parts = relativePath.split('/');
      if (parts.length >= 1) {
        const componentName = parts[0];
        const componentPath = `${componentsRoot}/${componentName}`;
        if (!components.has(componentName)) {
          components.set(componentName, {
            name: componentName,
            path: componentPath
          });
        }
      }
    }
  }

  return Array.from(components.values());
}

export function reconstructSections(state, config) {
  const pagesRoot = (config.paths.pages || 'src/pages').replace(/\\/g, '/');
  const featuresRoot = (config.paths.features || 'src/features').replace(/\\/g, '/');
  const files = state.files;
  
  // Keep existing sections if their files still exist
  const validSections = (state.sections || []).filter(section => {
    // Check if route file exists in state.files
    const routeFile = Object.keys(files).find(f => {
      const normalizedF = f.replace(/\\/g, '/');
      const routePath = section.route === '/' ? 'index' : section.route.slice(1);
      return normalizedF.startsWith(pagesRoot + '/' + routePath + '.') || 
             normalizedF === pagesRoot + '/' + routePath + '/index.astro'; // nested mode
    });

    // Check if feature directory has at least one file in state.files
    const hasFeatureFiles = Object.keys(files).some(f => 
      f.replace(/\\/g, '/').startsWith(section.featurePath.replace(/\\/g, '/') + '/')
    );

    return routeFile && hasFeatureFiles;
  });

  const sections = new Map();
  validSections.forEach(s => sections.set(s.route, s));

  // Try to discover new sections
  for (const filePath in files) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (normalizedPath.startsWith(pagesRoot + '/')) {
      const relativePath = normalizedPath.slice(pagesRoot.length + 1);
      const route = '/' + relativePath.replace(/\.(astro|ts|js|tsx|jsx)$/, '').replace(/\/index$/, '');
      const finalRoute = route === '' ? '/' : route;

      if (!sections.has(finalRoute)) {
        // Try to find a matching feature by name
        const routeName = path.basename(finalRoute === '/' ? 'index' : finalRoute);
        // Look for a directory in features with same name or similar
        const possibleFeaturePath = Object.keys(files).find(f => {
           const nf = f.replace(/\\/g, '/');
           return nf.startsWith(featuresRoot + '/') && nf.includes('/' + routeName + '/');
        });

        if (possibleFeaturePath) {
           const featurePathParts = possibleFeaturePath.replace(/\\/g, '/').split('/');
           const featuresBase = path.basename(featuresRoot);
           const featureIndex = featurePathParts.indexOf(featuresBase) + 1;
           
           if (featureIndex > 0 && featureIndex < featurePathParts.length) {
             const featureName = featurePathParts[featureIndex];
             const featurePath = `${featuresRoot}/${featureName}`;

             sections.set(finalRoute, {
               name: featureName,
               route: finalRoute,
               featurePath: featurePath,
               extension: path.extname(filePath)
             });
           }
        }
      }
    }
  }

  return Array.from(sections.values());
}

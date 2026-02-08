import path from 'path';
import { loadConfig, resolvePath } from '../utils/config.js';
import { loadState, findComponent, findSection, saveState } from '../utils/state.js';
import { 
  normalizeComponentName, 
  normalizeRoute, 
  featureToDirectoryPath 
} from '../utils/naming.js';
import { moveDirectory, scanAndReplaceImports } from '../utils/refactor.js';
import { moveSectionCommand } from './move-section.js';
import { cleanupEmptyDirs } from '../utils/filesystem.js';

/**
 * Dispatcher for rename commands.
 */
export async function renameCommand(type, oldName, newName, options) {
  try {
    if (!type || !oldName || !newName) {
      throw new Error('Usage: textor rename <route|feature|component> <oldName> <newName>');
    }

    if (type === 'route' || type === 'path') {
      const normalizedOld = normalizeRoute(oldName);
      const normalizedNew = normalizeRoute(newName);
      // By default, move-section will try to move the feature if it matches the route.
      // For a simple "rename route", we might want to keep that behavior or not.
      // Usually "rename route" means just the URL/file.
      return await moveSectionCommand(normalizedOld, undefined, normalizedNew, undefined, options);
    }
    
    if (type === 'feature') {
      const state = await loadState();
      const normalizedOld = featureToDirectoryPath(oldName);
      const normalizedNew = featureToDirectoryPath(newName);
      
      const section = findSection(state, normalizedOld);
      
      if (section) {
        // If it's a managed section, move it using section logic
        return await moveSectionCommand(section.route, section.featurePath, section.route, normalizedNew, options);
      } else {
        // Standalone feature move
        return await moveSectionCommand(undefined, normalizedOld, undefined, normalizedNew, options);
      }
    }
    
    if (type === 'component') {
      return await renameComponent(oldName, newName, options);
    }
    
    throw new Error(`Unknown rename type: ${type}. Supported types: route, feature, component.`);
  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Specialized logic for renaming shared components.
 */
async function renameComponent(oldName, newName, options) {
  const config = await loadConfig();
  const state = await loadState();
  
  const normalizedOldName = normalizeComponentName(oldName);
  const normalizedNewName = normalizeComponentName(newName);
  
  const component = findComponent(state, normalizedOldName);
  
  const componentsRoot = resolvePath(config, 'components');
  const fromPath = component 
    ? path.resolve(process.cwd(), component.path) 
    : path.join(componentsRoot, normalizedOldName);
    
  const toPath = path.join(componentsRoot, normalizedNewName);
  
  if (options.dryRun) {
    console.log(`Dry run - would rename component: ${normalizedOldName} -> ${normalizedNewName}`);
    console.log(`  Path: ${fromPath} -> ${toPath}`);
    return;
  }
  
  const signatures = Object.values(config.signatures || {});
  
  await moveDirectory(fromPath, toPath, state, config, {
    ...options,
    fromName: normalizedOldName,
    toName: normalizedNewName,
    signatures
  });
  
  if (options.scan) {
    await scanAndReplaceImports(config, state, {
      fromPath: normalizedOldName,
      fromName: normalizedOldName,
      type: 'component'
    }, {
      toPath: normalizedNewName,
      toName: normalizedNewName
    }, options);
  }
  
  await cleanupEmptyDirs(path.dirname(fromPath), componentsRoot);
  
  // Update state metadata
  if (component) {
    component.name = normalizedNewName;
    component.path = path.relative(process.cwd(), toPath).replace(/\\/g, '/');
  }
  
  await saveState(state);
  console.log(`✓ Renamed component ${normalizedOldName} to ${normalizedNewName}`);
}

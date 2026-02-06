import { loadConfig } from '../utils/config.js';
import { 
  safeDeleteDir,
  cleanupEmptyDirs,
  secureJoin 
} from '../utils/filesystem.js';
import { loadState, findComponent, saveState } from '../utils/state.js';
import { isRepoClean } from '../utils/git.js';
import path from 'path';

export async function removeComponentCommand(identifier, options) {
  try {
    const config = await loadConfig();

    if (config.git?.requireCleanRepo && !await isRepoClean()) {
      throw new Error('Git repository is not clean. Please commit or stash your changes before proceeding.');
    }

    const state = await loadState();
    
    const component = findComponent(state, identifier);
    let componentDir;

    if (component) {
        componentDir = path.resolve(process.cwd(), component.path);
    } else {
        // Fallback: try to guess path if not in state
        const componentsRoot = path.resolve(process.cwd(), config.paths.components);
        componentDir = secureJoin(componentsRoot, identifier);
    }
    
    if (options.dryRun) {
      console.log('Dry run - would delete:');
      console.log(`  Component directory: ${componentDir}/`);
      return;
    }
    
    const result = await safeDeleteDir(componentDir, {
      force: options.force,
      stateFiles: state.files,
      acceptChanges: options.acceptChanges,
      normalization: config.hashing?.normalization,
      owner: identifier
    });
    
    if (result.deleted) {
      console.log(`✓ Deleted component: ${componentDir}/`);
      await cleanupEmptyDirs(path.dirname(componentDir), path.join(process.cwd(), config.paths.components));
      
      // Unregister files
      const relComponentPath = path.relative(process.cwd(), componentDir).replace(/\\/g, '/');
      const dirPrefix = relComponentPath + '/';
      for (const f in state.files) {
        if (f.startsWith(dirPrefix)) {
          delete state.files[f];
        }
      }
      state.components = state.components.filter(c => c.name !== identifier && c.path !== relComponentPath);
      await saveState(state);
    } else if (result.message) {
      console.log(`⚠ Skipped: ${componentDir}`);
      console.log(`    Reason: ${result.message}`);
    } else {
      console.log(`Component not found at ${componentDir}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

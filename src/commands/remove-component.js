import { loadConfig } from '../utils/config.js';
import { 
  safeDeleteDir,
  cleanupEmptyDirs,
  secureJoin 
} from '../utils/filesystem.js';
import { loadState, findComponent, saveState } from '../utils/state.js';
import path from 'path';

export async function removeComponentCommand(identifier, options) {
  try {
    const config = await loadConfig();
    const state = await loadState();
    
    const component = findComponent(state, identifier);
    let componentDir;

    if (component) {
        componentDir = component.path;
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
      acceptChanges: options.acceptChanges
    });
    
    if (result.deleted) {
      console.log(`✓ Deleted component: ${componentDir}/`);
      await cleanupEmptyDirs(path.dirname(componentDir), path.join(process.cwd(), config.paths.components));
      
      // Unregister files
      const dirPrefix = path.relative(process.cwd(), componentDir).replace(/\\/g, '/') + '/';
      for (const f in state.files) {
        if (f.startsWith(dirPrefix)) {
          delete state.files[f];
        }
      }
      state.components = state.components.filter(c => c.name !== identifier && c.path !== componentDir);
      await saveState(state);
    } else if (result.message) {
      console.log(`⚠ Skipped: ${componentDir}`);
      console.log(`    Reason: ${result.message}`);
    } else {
      console.log(`Component not found at ${componentDir}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

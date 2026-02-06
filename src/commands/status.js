import { loadConfig } from '../utils/config.js';
import { loadState } from '../utils/state.js';
import { getProjectStatus } from '../utils/status.js';

export async function statusCommand() {
  try {
    const config = await loadConfig();
    const state = await loadState();
    
    const results = await getProjectStatus(config, state);

    // Reporting
    console.log('Textor Status Report:');
    console.log(`  Synced files: ${results.synced}`);
    
    if (results.modified.length > 0) {
      console.log(`\n  MODIFIED (In state, but content changed): ${results.modified.length}`);
      results.modified.forEach(f => console.log(`    ~ ${f}`));
    }
    
    if (results.missing.length > 0) {
      console.log(`\n  MISSING (In state, but not on disk): ${results.missing.length}`);
      results.missing.forEach(f => console.log(`    - ${f}`));
    }

    if (results.untracked.length > 0) {
      console.log(`\n  UNTRACKED (On disk with signature, not in state): ${results.untracked.length}`);
      results.untracked.forEach(f => console.log(`    + ${f}`));
    }

    if (results.orphaned.length > 0) {
      console.log(`\n  ORPHANED (On disk without signature, in managed folder): ${results.orphaned.length}`);
      results.orphaned.forEach(f => console.log(`    ? ${f}`));
    }

    if (results.modified.length === 0 && results.missing.length === 0 && results.untracked.length === 0) {
      console.log('\n✓ Project is perfectly synchronized with state.');
    } else {
      console.log('\nUse "textor sync" to reconcile state with disk.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

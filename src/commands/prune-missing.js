import readline from 'readline';
import { loadConfig } from '../utils/config.js';
import { loadState, saveState, reconstructComponents, reconstructSections } from '../utils/state.js';
import { getProjectStatus } from '../utils/status.js';

/**
 * Removes missing references from Textor state.
 * @param {Object} options 
 * @param {boolean} options.dryRun 
 * @param {boolean} options.yes 
 */
export async function pruneMissingCommand(options = {}) {
  try {
    const config = await loadConfig();
    const state = await loadState();
    
    const results = await getProjectStatus(config, state);
    
    if (results.missing.length === 0) {
      console.log('No missing references found.');
      return;
    }

    console.log(`Found ${results.missing.length} missing references:`);
    results.missing.forEach(f => console.log(`  - ${f}`));

    if (options.dryRun) {
      console.log('\nDry run: no changes applied to state.');
      return;
    }

    if (!options.yes && options.interactive !== false && process.stdin.isTTY && process.env.NODE_ENV !== 'test') {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise(resolve => {
        rl.question('\nDo you want to proceed with pruning? (y/N) ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });

      if (!confirmed) {
        console.log('Aborted.');
        return;
      }
    }

    for (const relPath of results.missing) {
      delete state.files[relPath];
    }

    // Reconstruct metadata
    state.components = reconstructComponents(state.files, config);
    state.sections = reconstructSections(state, config);

    await saveState(state);
    console.log(`\n✓ Successfully removed ${results.missing.length} missing references from state.`);

  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

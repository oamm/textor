import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig } from '../utils/config.js';
import { loadState, saveState } from '../utils/state.js';
import { calculateHash, isTextorGenerated } from '../utils/filesystem.js';

export async function validateStateCommand(options) {
  try {
    const config = await loadConfig();
    const state = await loadState();
    const results = {
      missing: [],
      modified: [],
      valid: 0
    };

    const files = Object.keys(state.files);
    
    for (const relativePath of files) {
      const fullPath = path.join(process.cwd(), relativePath);
      const fileData = state.files[relativePath];
      
      if (!existsSync(fullPath)) {
        results.missing.push(relativePath);
        continue;
      }
      
      const content = await readFile(fullPath, 'utf-8');
      const currentHash = calculateHash(content, config.hashing?.normalization);
      
      if (currentHash !== fileData.hash) {
        results.modified.push({
          path: relativePath,
          newHash: currentHash
        });
      } else {
        results.valid++;
      }
    }

    console.log('State Validation Results:');
    console.log(`  Valid files: ${results.valid}`);
    
    if (results.missing.length > 0) {
      console.log(`\n  Missing files: ${results.missing.length}`);
      results.missing.forEach(f => console.log(`    - ${f}`));
    }
    
    if (results.modified.length > 0) {
      console.log(`\n  Modified files: ${results.modified.length}`);
      results.modified.forEach(f => console.log(`    - ${f.path}`));
    }
    
    if (options.fix) {
      let fixedCount = 0;
      const signatures = Object.values(config.signatures || {});
      
      // Fix modified files if they still have the Textor signature
      for (const mod of results.modified) {
        const fullPath = path.join(process.cwd(), mod.path);
        if (await isTextorGenerated(fullPath, signatures)) {
          state.files[mod.path].hash = mod.newHash;
          fixedCount++;
        }
      }
      
      // Remove missing files from state
      for (const miss of results.missing) {
        delete state.files[miss];
        fixedCount++;
      }
      
      if (fixedCount > 0) {
        await saveState(state);
        console.log(`\n✓ Fixed ${fixedCount} entries in state.`);
      } else {
        console.log('\nNothing to fix or missing signatures on modified files.');
      }
    } else if (results.missing.length > 0 || results.modified.length > 0) {
      console.log('\nRun with --fix to synchronize state with reality (requires Textor signature to be present).');
    } else {
      console.log('\n✓ State is perfectly in sync.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

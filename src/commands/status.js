import path from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { loadConfig, resolvePath } from '../utils/config.js';
import { loadState } from '../utils/state.js';
import { calculateHash, isTextorGenerated, scanDirectory } from '../utils/filesystem.js';

export async function statusCommand() {
  try {
    const config = await loadConfig();
    const state = await loadState();
    
    const results = {
      missing: [],
      modified: [],
      untracked: [], // Has signature, not in state
      orphaned: [],  // No signature, not in state
      synced: 0
    };

    const roots = [
      resolvePath(config, 'pages'),
      resolvePath(config, 'features'),
      resolvePath(config, 'components')
    ].map(p => path.resolve(p));

    const diskFiles = new Set();
    const configSignatures = Object.values(config.signatures || {});

    for (const root of roots) {
      if (existsSync(root)) {
        await scanDirectory(root, diskFiles);
      }
    }

    // 1. Check state files against disk
    for (const relativePath in state.files) {
      const fullPath = path.join(process.cwd(), relativePath);
      
      if (!existsSync(fullPath)) {
        results.missing.push(relativePath);
        continue;
      }

      diskFiles.delete(relativePath);

      const content = await readFile(fullPath, 'utf-8');
      const currentHash = calculateHash(content, config.hashing?.normalization);
      const fileData = state.files[relativePath];

      if (currentHash !== fileData.hash) {
        results.modified.push(relativePath);
      } else {
        results.synced++;
      }
    }

    // 2. Check remaining disk files
    for (const relativePath of diskFiles) {
      const fullPath = path.join(process.cwd(), relativePath);
      const isGenerated = await isTextorGenerated(fullPath, configSignatures);
      
      if (isGenerated) {
        results.untracked.push(relativePath);
      } else {
        results.orphaned.push(relativePath);
      }
    }

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

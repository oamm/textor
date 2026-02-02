import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { loadState, saveState, reconstructComponents, reconstructSections } from '../utils/state.js';
import { calculateHash, isTextorGenerated, scanDirectory, inferKind } from '../utils/filesystem.js';

export async function syncCommand(options) {
  try {
    const config = await loadConfig();
    const state = await loadState();
    const results = {
      added: [],
      updated: [],
      missing: [],
      untouched: 0
    };

    const roots = [
      resolvePath(config, 'pages'),
      resolvePath(config, 'features'),
      resolvePath(config, 'components')
    ].map(p => path.resolve(p));

    const managedFiles = new Set();
    const configSignatures = Object.values(config.signatures || {});

    for (const root of roots) {
      if (existsSync(root)) {
        await scanDirectory(root, managedFiles);
      } else {
        const relativeRoot = path.relative(process.cwd(), root).replace(/\\/g, '/');
        console.log(`  Warning: Managed directory not found: ${relativeRoot}`);
      }
    }

    const stateFiles = Object.keys(state.files);
    let changed = false;
    
    // 1. Check files in state
    for (const relativePath of stateFiles) {
      const fullPath = path.join(process.cwd(), relativePath);
      
      if (!existsSync(fullPath)) {
        results.missing.push(relativePath);
        continue;
      }

      managedFiles.delete(relativePath); // Remove from managedFiles so we don't process it again in step 2

      const content = await readFile(fullPath, 'utf-8');
      const currentHash = calculateHash(content, config.hashing?.normalization);
      const fileData = state.files[relativePath];

      if (currentHash !== fileData.hash) {
        const isGenerated = await isTextorGenerated(fullPath, configSignatures);
        if (isGenerated || options.force) {
          results.updated.push({ path: relativePath, newHash: currentHash });
        }
      } else {
        results.untouched++;
      }
    }

    // 2. Check files on disk not in state
    let ignoredCount = 0;
    for (const relativePath of managedFiles) {
      const fullPath = path.join(process.cwd(), relativePath);
      const isGenerated = await isTextorGenerated(fullPath, configSignatures);
      
      if (isGenerated || options.includeAll) {
        const content = await readFile(fullPath, 'utf-8');
        const hash = calculateHash(content, config.hashing?.normalization);
        results.added.push({ path: relativePath, hash });
      } else {
        ignoredCount++;
      }
    }

    if (results.added.length > 0 || results.updated.length > 0 || results.missing.length > 0) {
      changed = true;
    }

    // Reporting
    console.log('Sync Analysis:');
    console.log(`  Untouched files: ${results.untouched}`);
    
    if (ignoredCount > 0 && !options.includeAll) {
      console.log(`  Ignored non-generated files: ${ignoredCount} (use --include-all to track them)`);
    }
    
    if (results.added.length > 0) {
      console.log(`\n  New files to track: ${results.added.length}`);
      results.added.forEach(f => console.log(`    + ${f.path}`));
    }
    
    if (results.updated.length > 0) {
      console.log(`\n  Modified files to update: ${results.updated.length}`);
      results.updated.forEach(f => console.log(`    ~ ${f.path}`));
    }
    
    if (results.missing.length > 0) {
      console.log(`\n  Missing files to remove from state: ${results.missing.length}`);
      results.missing.forEach(f => console.log(`    - ${f}`));
    }

    if (options.dryRun) {
      console.log('\nDry run: no changes applied.');
      return;
    }

    if (results.added.length > 0) {
      for (const file of results.added) {
        state.files[file.path] = {
          kind: inferKind(file.path, config),
          hash: file.hash,
          timestamp: new Date().toISOString(),
          synced: true
        };
      }
    }

    if (results.updated.length > 0) {
      for (const file of results.updated) {
        state.files[file.path].hash = file.newHash;
        state.files[file.path].timestamp = new Date().toISOString();
        state.files[file.path].synced = true;
      }
    }

    if (results.missing.length > 0) {
      for (const relPath of results.missing) {
        delete state.files[relPath];
      }
    }

    if (changed) {
      // 3. Reconstruct components and sections
      state.components = reconstructComponents(state.files, config);
      state.sections = reconstructSections(state, config);

      await saveState(state);
      console.log(`\n✓ State synchronized successfully (${results.added.length} added, ${results.updated.length} updated, ${results.missing.length} removed).`);
    } else {
      // Even if no files changed, check if metadata needs reconstruction
      const newComponents = reconstructComponents(state.files, config);
      const newSections = reconstructSections(state, config);
      
      const componentsEqual = JSON.stringify(newComponents) === JSON.stringify(state.components || []);
      const sectionsEqual = JSON.stringify(newSections) === JSON.stringify(state.sections || []);

      if (!componentsEqual || !sectionsEqual) {
        state.components = newComponents;
        state.sections = newSections;
        await saveState(state);
        console.log('\n✓ Metadata (components/sections) reconstructed.');
      } else {
        console.log('\n✓ Everything is already in sync.');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
        process.exit(1);
    }
    throw error;
  }
}

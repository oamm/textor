import path from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolvePath } from './config.js';
import { calculateHash, isTextorGenerated, scanDirectory } from './filesystem.js';

/**
 * Computes the drift between the state and the actual files on disk.
 * 
 * @param {import('./config.js').TextorConfig} config 
 * @param {Object} state 
 * @returns {Promise<{
 *   missing: string[],
 *   modified: string[],
 *   untracked: string[],
 *   orphaned: string[],
 *   synced: number
 * }>}
 */
export async function getProjectStatus(config, state) {
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

    // It exists on disk, so it's not untracked/orphaned
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

  return results;
}

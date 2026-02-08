import path from 'path';
import { readdir, stat, rmdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { safeMove, ensureDir, scanDirectory, calculateHash } from './filesystem.js';
import { getRelativeImportPath } from './naming.js';
import { resolvePath } from './config.js';

/**
 * Updates relative imports in a file after it has been moved.
 */
export async function updateImportsInFile(filePath, oldFilePath, newFilePath) {
  if (!existsSync(filePath)) return;
  
  let content = await readFile(filePath, 'utf-8');
  const oldDir = path.dirname(oldFilePath);
  const newDir = path.dirname(newFilePath);
  
  if (oldDir === newDir) return;
  
  // Find all relative imports
  const relativeImportRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
  let match;
  const replacements = [];
  
  while ((match = relativeImportRegex.exec(content)) !== null) {
    const relativePath = match[1];
    const absoluteTarget = path.resolve(oldDir, relativePath);
    const newRelativePath = getRelativeImportPath(newFilePath, absoluteTarget);
    
    replacements.push({
      full: match[0],
      oldRel: relativePath,
      newRel: newRelativePath
    });
  }
  
  for (const repl of replacements) {
    content = content.replace(repl.full, `from '${repl.newRel}'`);
  }
  
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Moves a directory and its contents, renaming files and updating internal content/imports.
 */
export async function moveDirectory(fromPath, toPath, state, config, options = {}) {
  const { fromName, toName, owner = null, signatures = [] } = options;
  
  if (!existsSync(fromPath)) {
    throw new Error(`Source directory not found: ${fromPath}`);
  }
  
  if (existsSync(toPath) && !options.force) {
    throw new Error(
      `Destination already exists: ${toPath}\n` +
      `Use --force to overwrite.`
    );
  }
  
  await ensureDir(toPath);
  
  const entries = await readdir(fromPath);
  
  for (const entry of entries) {
    let targetEntry = entry;
    
    // Rename files if they match the component name
    if (fromName && toName && fromName !== toName) {
      if (entry.includes(fromName)) {
        targetEntry = entry.replace(fromName, toName);
      }
    }
    
    const fromEntryPath = path.join(fromPath, entry);
    const toEntryPath = path.join(toPath, targetEntry);
    
    const stats = await stat(fromEntryPath);
    
    if (stats.isDirectory()) {
      await moveDirectory(fromEntryPath, toEntryPath, state, config, options);
    } else {
      const normalizedFromRelative = path.relative(process.cwd(), fromEntryPath).replace(/\\/g, '/');
      const fileState = state.files[normalizedFromRelative];
      
      const newHash = await safeMove(fromEntryPath, toEntryPath, {
        force: options.force,
        expectedHash: fileState?.hash,
        acceptChanges: options.acceptChanges,
        normalization: config.hashing?.normalization,
        owner,
        actualOwner: fileState?.owner,
        signatures
      });
      
      // Update internal content (signatures, component names) if renaming
      if (fromName && toName && fromName !== toName) {
        let content = await readFile(toEntryPath, 'utf-8');
        let hasChanged = false;
        
        // Simple replacement of component names
        if (content.includes(fromName)) {
           content = content.replace(new RegExp(fromName, 'g'), toName);
           hasChanged = true;
        }
        
        // Also handle lowercase class names if any
        const fromLower = fromName.toLowerCase();
        const toLower = toName.toLowerCase();
        if (content.includes(fromLower)) {
           content = content.replace(new RegExp(fromLower, 'g'), toLower);
           hasChanged = true;
        }

        if (hasChanged) {
           await writeFile(toEntryPath, content, 'utf-8');
           // Re-calculate hash after content update
           const updatedHash = calculateHash(content, config.hashing?.normalization);
           
           const normalizedToRelative = path.relative(process.cwd(), toEntryPath).replace(/\\/g, '/');
           if (fileState) {
              state.files[normalizedToRelative] = { ...fileState, hash: updatedHash };
              delete state.files[normalizedFromRelative];
           }
        } else {
           // Update state for each file moved normally
           const normalizedToRelative = path.relative(process.cwd(), toEntryPath).replace(/\\/g, '/');
           if (fileState) {
              state.files[normalizedToRelative] = { ...fileState, hash: newHash };
              delete state.files[normalizedFromRelative];
           }
        }
      } else {
        // Update state for each file moved normally
        const normalizedToRelative = path.relative(process.cwd(), toEntryPath).replace(/\\/g, '/');
        if (fileState) {
          state.files[normalizedToRelative] = { ...fileState, hash: newHash };
          delete state.files[normalizedFromRelative];
        }
      }
    }
  }
  
  const remainingFiles = await readdir(fromPath);
  if (remainingFiles.length === 0) {
    await rmdir(fromPath);
  }
}

/**
 * Scans the project and replaces imports of a moved/renamed item.
 */
export async function scanAndReplaceImports(config, state, fromInfo, toInfo, options) {
  const { fromPath: fromItemPath, fromName, type } = fromInfo;
  const { toPath: toItemPath, toName } = toInfo;
  
  const allFiles = new Set();
  await scanDirectory(process.cwd(), allFiles);
  
  const rootPath = resolvePath(config, type === 'component' ? 'components' : 'features');
  
  for (const relPath of allFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    
    // Skip the moved directory itself
    const toFullPath = path.resolve(toItemPath);
    if (fullPath.startsWith(toFullPath)) continue;

    let content = await readFile(fullPath, 'utf-8');
    let changed = false;

    const aliasBase = config.importAliases[type === 'component' ? 'components' : 'features'];
    const ext = type === 'component' ? '' : (config.naming.featureExtension === '.astro' ? '.astro' : '');

    if (aliasBase) {
      const oldAlias = `${aliasBase}/${fromItemPath}`;
      const newAlias = `${aliasBase}/${toItemPath}`;
      
      const oldFullImport = `from '${oldAlias}/${fromName}${ext}'`;
      const newFullImport = `from '${newAlias}/${toName}${ext}'`;
      
      if (content.includes(oldFullImport)) {
        content = content.replace(new RegExp(oldFullImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newFullImport);
        changed = true;
      } else if (content.includes(oldAlias)) {
        content = content.replace(new RegExp(oldAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newAlias);
        changed = true;
      }
    } else {
      const oldDir = path.resolve(rootPath, fromItemPath);
      const newDir = path.resolve(rootPath, toItemPath);
      
      const oldRelPath = getRelativeImportPath(fullPath, oldDir);
      const newRelPath = getRelativeImportPath(fullPath, newDir);
      
      const oldImport = `'${oldRelPath}/${fromName}${ext}'`;
      const newImport = `'${newRelPath}/${toName}${ext}'`;
      
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newImport);
        changed = true;
      }
    }

    if (fromName !== toName && changed) {
       content = content.replace(new RegExp(`\\b${fromName}\\b`, 'g'), toName);
    }

    if (changed) {
      if (options.dryRun) {
        console.log(`  [Scan] Would update imports in ${relPath}`);
      } else {
        await writeFile(fullPath, content, 'utf-8');
        console.log(`  [Scan] Updated imports in ${relPath}`);
        
        if (state.files[relPath]) {
          state.files[relPath].hash = calculateHash(content, config.hashing?.normalization);
        }
      }
    }
  }
}

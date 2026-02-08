import path from 'path';
import { readdir, stat, rmdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeRoute, 
  routeToFilePath, 
  featureToDirectoryPath,
  getFeatureComponentName,
  getRelativeImportPath 
} from '../utils/naming.js';
import { 
  calculateHash,
  safeMove,
  ensureDir,
  updateSignature,
  cleanupEmptyDirs,
  secureJoin,
  scanDirectory
} from '../utils/filesystem.js';
import { loadState, findSection, saveState } from '../utils/state.js';
import { isRepoClean } from '../utils/git.js';

/**
 * Move a section (route + feature).
 * 
 * SCOPE GUARANTEES:
 * - Automatically updates imports in the moved route file.
 * - Automatically updates internal imports/references within the moved feature directory.
 * - Repo-wide scan for import updates is available via the --scan flag.
 * 
 * NON-GOALS (What it won't rewrite):
 * - String literals (unless they match the component name exactly in a JSX context).
 * - Markdown documentation (except for those registered in state).
 * - Dynamic imports with complex template literals.
 */
export async function moveSectionCommand(fromRoute, fromFeature, toRoute, toFeature, options) {
  try {
    const config = await loadConfig();

    if (config.git?.requireCleanRepo && !await isRepoClean()) {
      throw new Error('Git repository is not clean. Please commit or stash your changes before proceeding.');
    }

    const state = await loadState();

    let actualFromRoute = fromRoute;
    let actualFromFeature = fromFeature;
    let actualToRoute = toRoute;
    let actualToFeature = toFeature;

    // Shift arguments if using state
    if (!toRoute && fromRoute && fromFeature) {
        // textor move-section /old-route /new-route
        const section = findSection(state, fromRoute);
        if (section) {
            actualFromRoute = section.route;
            actualFromFeature = section.featurePath;
            actualToRoute = fromFeature; // the second argument was actually the new route
            actualToFeature = toRoute; // which is null
            
            // If toFeature is not provided, try to derive it from the new route
            if (!actualToFeature && actualToRoute) {
                const oldRouteParts = actualFromRoute.split('/').filter(Boolean);
                const newRouteParts = actualToRoute.split('/').filter(Boolean);
                const oldFeatureParts = actualFromFeature.split('/').filter(Boolean);
                
                // If the feature path starts with the old route parts, replace them
                // We compare case-insensitively or via PascalCase to be more helpful
                let match = true;
                for (let i = 0; i < oldRouteParts.length; i++) {
                    const routePart = oldRouteParts[i].toLowerCase();
                    const featurePart = oldFeatureParts[i] ? oldFeatureParts[i].toLowerCase() : null;
                    
                    if (featurePart !== routePart) {
                        match = false;
                        break;
                    }
                }
                
                if (match && oldRouteParts.length > 0) {
                    actualToFeature = [...newRouteParts, ...oldFeatureParts.slice(oldRouteParts.length)].join('/');
                } else {
                    // Otherwise just keep it the same
                    actualToFeature = actualFromFeature;
                }
            }
        }
    }

    const isRouteOnly = options.keepFeature || (!actualToFeature && actualToRoute && !actualFromFeature);
    
    if (isRouteOnly && !actualToRoute) {
      throw new Error('Destination route required for route-only move');
    }
    
    const normalizedFromRoute = normalizeRoute(actualFromRoute);
    const normalizedToRoute = normalizeRoute(actualToRoute);
    const normalizedFromFeature = actualFromFeature ? featureToDirectoryPath(actualFromFeature) : null;
    const normalizedToFeature = actualToFeature ? featureToDirectoryPath(actualToFeature) : null;
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    const configSignatures = Object.values(config.signatures || {});
    
    const fromSection = findSection(state, actualFromRoute);
    const routeExtension = (fromSection && fromSection.extension) || config.naming.routeExtension;
    
    const fromRouteFile = routeToFilePath(normalizedFromRoute, {
      extension: routeExtension,
      mode: config.routing.mode,
      indexFile: config.routing.indexFile
    });
    const toRouteFile = routeToFilePath(normalizedToRoute, {
      extension: routeExtension,
      mode: config.routing.mode,
      indexFile: config.routing.indexFile
    });
    
    const fromRoutePath = secureJoin(pagesRoot, fromRouteFile);
    const toRoutePath = secureJoin(pagesRoot, toRouteFile);
    
    const movedFiles = [];
    
    if (options.dryRun) {
      console.log('Dry run - would move:');
      console.log(`  Route: ${fromRoutePath} -> ${toRoutePath}`);
      
      if (!isRouteOnly && normalizedFromFeature && normalizedToFeature) {
        const fromFeaturePath = secureJoin(featuresRoot, normalizedFromFeature);
        const toFeaturePath = secureJoin(featuresRoot, normalizedToFeature);
        console.log(`  Feature: ${fromFeaturePath} -> ${toFeaturePath}`);
      }
      
      return;
    }
    
    const normalizedFromRouteRelative = path.relative(process.cwd(), fromRoutePath).replace(/\\/g, '/');
    const routeFileState = state.files[normalizedFromRouteRelative];

    const newRouteHash = await safeMove(fromRoutePath, toRoutePath, {
      force: options.force,
      expectedHash: routeFileState?.hash,
      acceptChanges: options.acceptChanges,
      owner: normalizedFromRoute,
      actualOwner: routeFileState?.owner,
      signatures: configSignatures
    });
    movedFiles.push({ from: fromRoutePath, to: toRoutePath });
    
    // Update state for moved route file
    const normalizedToRouteRelative = path.relative(process.cwd(), toRoutePath).replace(/\\/g, '/');
    if (routeFileState) {
      state.files[normalizedToRouteRelative] = { ...routeFileState, hash: newRouteHash };
      delete state.files[normalizedFromRouteRelative];
    }
    
    // Update imports in the moved route file
    const targetFeature = normalizedToFeature || normalizedFromFeature;
    if (targetFeature) {
      const fromFeatureDirPath = secureJoin(featuresRoot, normalizedFromFeature);
      const toFeatureDirPath = secureJoin(featuresRoot, targetFeature);
      const fromFeatureComponentName = getFeatureComponentName(normalizedFromFeature);
      const toFeatureComponentName = getFeatureComponentName(targetFeature);

      // First, update all relative imports in the file because it moved
      await updateImportsInFile(toRoutePath, fromRoutePath, toRoutePath);

      let content = await readFile(toRoutePath, 'utf-8');
      let changed = false;

      // Update component name in JSX tags
      if (fromFeatureComponentName !== toFeatureComponentName) {
        content = content.replace(
          new RegExp(`<${fromFeatureComponentName}`, 'g'),
          `<${toFeatureComponentName}`
        );
        content = content.replace(
          new RegExp(`</${fromFeatureComponentName}`, 'g'),
          `</${toFeatureComponentName}`
        );
        changed = true;
      }

      if (config.importAliases.features) {
        const oldAliasPath = `${config.importAliases.features}/${normalizedFromFeature}`;
        const newAliasPath = `${config.importAliases.features}/${targetFeature}`;
        
        // Flexible regex to match import identifier and path with alias
        const importRegex = new RegExp(`(import\\s+)(${fromFeatureComponentName})(\\s+from\\s+['"])${oldAliasPath}(/[^'"]+)?(['"])`, 'g');
        
        if (importRegex.test(content)) {
          content = content.replace(importRegex, (match, p1, p2, p3, subPath, p5) => {
            let newSubPath = subPath || '';
            if (subPath && subPath.includes(fromFeatureComponentName)) {
              newSubPath = subPath.replace(fromFeatureComponentName, toFeatureComponentName);
            }
            return `${p1}${toFeatureComponentName}${p3}${newAliasPath}${newSubPath}${p5}`;
          });
          changed = true;
        } else if (content.includes(oldAliasPath)) {
          // Fallback for path only replacement
          content = content.replace(new RegExp(oldAliasPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newAliasPath);
          changed = true;
        }
      } else {
        const oldRelativeDir = getRelativeImportPath(toRoutePath, fromFeatureDirPath);
        const newRelativeDir = getRelativeImportPath(toRoutePath, toFeatureDirPath);
        
        // Flexible regex for relative imports
        const relImportRegex = new RegExp(`(import\\s+)(${fromFeatureComponentName})(\\s+from\\s+['"])${oldRelativeDir}(/[^'"]+)?(['"])`, 'g');
        
        if (relImportRegex.test(content)) {
          content = content.replace(relImportRegex, (match, p1, p2, p3, subPath, p5) => {
            let newSubPath = subPath || '';
            if (subPath && subPath.includes(fromFeatureComponentName)) {
              newSubPath = subPath.replace(fromFeatureComponentName, toFeatureComponentName);
            }
            return `${p1}${toFeatureComponentName}${p3}${newRelativeDir}${newSubPath}${p5}`;
          });
          changed = true;
        }
      }

      if (changed) {
        await writeFile(toRoutePath, content, 'utf-8');
        // Update hash in state after changes
        state.files[normalizedToRouteRelative].hash = calculateHash(content, config.hashing?.normalization);
      }
    }
    
    if (!isRouteOnly && normalizedFromFeature && normalizedToFeature && normalizedFromFeature !== normalizedToFeature) {
      const fromFeaturePath = secureJoin(featuresRoot, normalizedFromFeature);
      const toFeaturePath = secureJoin(featuresRoot, normalizedToFeature);
      
      const fromFeatureComponentName = getFeatureComponentName(normalizedFromFeature);
      const toFeatureComponentName = getFeatureComponentName(normalizedToFeature);
      
      if (existsSync(fromFeaturePath)) {
        await moveDirectory(fromFeaturePath, toFeaturePath, state, config, {
          ...options,
          fromName: fromFeatureComponentName,
          toName: toFeatureComponentName,
          owner: normalizedFromRoute,
          signatures: configSignatures
        });
        movedFiles.push({ from: fromFeaturePath, to: toFeaturePath });
        
        await cleanupEmptyDirs(path.dirname(fromFeaturePath), featuresRoot);
      }
    }

    if (options.scan && (normalizedFromFeature || normalizedToFeature)) {
      await scanAndReplaceImports(config, state, {
        fromFeaturePath: normalizedFromFeature,
        fromComponentName: getFeatureComponentName(normalizedFromFeature)
      }, {
        toFeaturePath: normalizedToFeature || normalizedFromFeature,
        toComponentName: getFeatureComponentName(normalizedToFeature || normalizedFromFeature)
      }, options);
    }
    
    await cleanupEmptyDirs(path.dirname(fromRoutePath), pagesRoot);
    
    console.log('✓ Moved:');
    movedFiles.forEach(item => {
      console.log(`  ${item.from}`);
      console.log(`  -> ${item.to}`);
    });

    if (movedFiles.length > 0) {
      const existingSection = fromSection;
      
      // Update section data in state
      state.sections = state.sections.filter(s => s.route !== normalizedFromRoute);
      state.sections.push({
        name: existingSection ? existingSection.name : getFeatureComponentName(normalizedToFeature || normalizedFromFeature),
        route: normalizedToRoute,
        featurePath: normalizedToFeature || normalizedFromFeature,
        layout: existingSection ? existingSection.layout : 'Main',
        extension: routeExtension
      });
      
      await saveState(state);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

async function scanAndReplaceImports(config, state, fromInfo, toInfo, options) {
  const { fromFeaturePath, fromComponentName } = fromInfo;
  const { toFeaturePath, toComponentName } = toInfo;
  
  const allFiles = new Set();
  await scanDirectory(process.cwd(), allFiles);
  
  const featuresRoot = resolvePath(config, 'features');
  
  for (const relPath of allFiles) {
    const fullPath = path.join(process.cwd(), relPath);
    
    // Skip the moved directory itself as it was already handled
    if (fullPath.startsWith(path.resolve(toFeaturePath))) continue;

    let content = await readFile(fullPath, 'utf-8');
    let changed = false;

    const ext = config.naming.featureExtension === '.astro' ? '.astro' : '';

    // Handle Aliases
    if (config.importAliases.features) {
      const oldAlias = `${config.importAliases.features}/${fromFeaturePath}`;
      const newAlias = `${config.importAliases.features}/${toFeaturePath}`;
      
      // Update component name and path if both changed
      const oldFullImport = `from '${oldAlias}/${fromComponentName}${ext}'`;
      const newFullImport = `from '${newAlias}/${toComponentName}${ext}'`;
      
      if (content.includes(oldFullImport)) {
        content = content.replace(new RegExp(oldFullImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newFullImport);
        changed = true;
      } else if (content.includes(oldAlias)) {
        content = content.replace(new RegExp(oldAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newAlias);
        changed = true;
      }
    } else {
      // Handle Relative Imports (more complex)
      // This is best-effort: we look for imports that resolve to the old feature path
      const fromFeatureDir = secureJoin(featuresRoot, fromFeaturePath);
      const toFeatureDir = secureJoin(featuresRoot, toFeaturePath);
      
      const oldRelPath = getRelativeImportPath(fullPath, fromFeatureDir);
      const newRelPath = getRelativeImportPath(fullPath, toFeatureDir);
      
      const oldImport = `'${oldRelPath}/${fromComponentName}${ext}'`;
      const newImport = `'${newRelPath}/${toComponentName}${ext}'`;
      
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newImport);
        changed = true;
      }
    }

    // Update component name in JSX and imports if it changed
    if (fromComponentName !== toComponentName && changed) {
       content = content.replace(new RegExp(`\\b${fromComponentName}\\b`, 'g'), toComponentName);
    }

    if (changed) {
      if (options.dryRun) {
        console.log(`  [Scan] Would update imports in ${relPath}`);
      } else {
        await writeFile(fullPath, content, 'utf-8');
        console.log(`  [Scan] Updated imports in ${relPath}`);
        
        // Update state hash if this file is managed
        if (state.files[relPath]) {
          state.files[relPath].hash = calculateHash(content, config.hashing?.normalization);
        }
      }
    }
  }
}

async function moveDirectory(fromPath, toPath, state, config, options = {}) {
  const { fromName, toName, owner = null } = options;
  
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
        actualOwner: fileState?.owner
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

async function updateImportsInFile(filePath, oldFilePath, newFilePath) {
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

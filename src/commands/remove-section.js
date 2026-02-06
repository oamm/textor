import path from 'path';
import { rename, readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeRoute, 
  routeToFilePath, 
  featureToDirectoryPath,
  getRelativeImportPath
} from '../utils/naming.js';
import { 
  calculateHash,
  safeDelete, 
  safeDeleteDir,
  cleanupEmptyDirs,
  secureJoin 
} from '../utils/filesystem.js';
import { loadState, findSection, saveState } from '../utils/state.js';
import { isRepoClean } from '../utils/git.js';

export async function removeSectionCommand(route, featurePath, options) {
  try {
    const config = await loadConfig();

    if (config.git?.requireCleanRepo && !await isRepoClean()) {
      throw new Error('Git repository is not clean. Please commit or stash your changes before proceeding.');
    }

    const state = await loadState();
    
    let section = findSection(state, route);
    if (!section && featurePath) {
      section = findSection(state, featurePath);
    }

    const targetRoute = section ? section.route : route;
    const targetFeaturePath = section ? section.featurePath : featurePath;

    if (!targetFeaturePath) {
      throw new Error(`Section not found for identifier: ${route}. Please provide both route and featurePath.`);
    }
    
    const normalizedRoute = normalizeRoute(targetRoute);
    const normalizedFeaturePath = featureToDirectoryPath(targetFeaturePath);
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');

    // Find route file in state if possible
    let routeFilePath = null;
    const routeRelPath = Object.keys(state.files).find(f => {
      const data = state.files[f];
      return data.kind === 'route' && data.owner === normalizedRoute;
    });

    if (routeRelPath) {
      routeFilePath = path.resolve(process.cwd(), routeRelPath);
    } else {
      const routeExtension = (section && section.extension) || config.naming.routeExtension;
      const routeFileName = routeToFilePath(normalizedRoute, {
        extension: routeExtension,
        mode: config.routing.mode,
        indexFile: config.routing.indexFile
      });
      routeFilePath = secureJoin(pagesRoot, routeFileName);
    }
    
    const featureDirPath = secureJoin(featuresRoot, normalizedFeaturePath);
    
    const deletedFiles = [];
    const skippedFiles = [];
    const deletedDirs = [];
    
    if (options.dryRun) {
      console.log('Dry run - would delete:');
      
      if (!options.keepRoute) {
        console.log(`  Route: ${routeFilePath}`);
      }
      
      if (!options.keepFeature) {
        console.log(`  Feature: ${featureDirPath}/`);
      }
      
      return;
    }
    
    if (!options.keepRoute) {
      const normalizedPath = path.relative(process.cwd(), routeFilePath).replace(/\\/g, '/');
      const fileState = state.files[normalizedPath];
      const result = await safeDelete(routeFilePath, {
        force: options.force,
        expectedHash: fileState?.hash,
        acceptChanges: options.acceptChanges,
        normalization: config.hashing?.normalization,
        owner: normalizedRoute,
        actualOwner: fileState?.owner
      });
      
      if (result.deleted) {
        deletedFiles.push(routeFilePath);
        delete state.files[normalizedPath];
      } else if (result.message) {
        skippedFiles.push({ path: routeFilePath, reason: result.message });
      }
    }
    
    if (!options.keepFeature) {
      const result = await safeDeleteDir(featureDirPath, {
        force: options.force,
        stateFiles: state.files,
        acceptChanges: options.acceptChanges,
        normalization: config.hashing?.normalization,
        owner: normalizedRoute
      });
      
      if (result.deleted) {
        deletedDirs.push(featureDirPath);
        // Unregister all files that were in this directory
        const dirPrefix = path.relative(process.cwd(), featureDirPath).replace(/\\/g, '/') + '/';
        for (const f in state.files) {
          if (f.startsWith(dirPrefix)) {
            delete state.files[f];
          }
        }
      } else if (result.message) {
        skippedFiles.push({ path: featureDirPath, reason: result.message });
      }
    }
    
    if (!options.keepRoute && deletedFiles.includes(routeFilePath)) {
      await cleanupEmptyDirs(path.dirname(routeFilePath), pagesRoot);
    }
    
    if (!options.keepFeature && deletedDirs.includes(featureDirPath)) {
      await cleanupEmptyDirs(path.dirname(featureDirPath), featuresRoot);
    }
    
    if (deletedFiles.length > 0 || deletedDirs.length > 0) {
      console.log('✓ Deleted:');
      deletedFiles.forEach(file => console.log(`  ${file}`));
      deletedDirs.forEach(dir => console.log(`  ${dir}/`));
    }
    
    if (skippedFiles.length > 0) {
      console.log('\n⚠ Skipped:');
      skippedFiles.forEach(item => {
        console.log(`  ${item.path}`);
        console.log(`    Reason: ${item.reason}`);
      });
    }
    
    if (deletedFiles.length === 0 && deletedDirs.length === 0 && skippedFiles.length === 0) {
      if (section) {
        console.log(`✓ Section ${normalizedRoute} removed from state (files were already missing on disk).`);
        state.sections = state.sections.filter(s => s.route !== normalizedRoute);
        await saveState(state);
      } else {
        console.log('No files to delete.');
      }
    } else {
      // Reorganization (Flattening)
      if (!options.keepRoute && deletedFiles.length > 0 && config.routing.mode === 'flat') {
        const routeParts = normalizedRoute.split('/').filter(Boolean);
        if (routeParts.length > 1) {
          for (let i = routeParts.length - 1; i >= 1; i--) {
            const parentRoute = '/' + routeParts.slice(0, i).join('/');
            const parentDirName = routeParts.slice(0, i).join('/');
            const parentDirPath = secureJoin(pagesRoot, parentDirName);
            
            if (existsSync(parentDirPath)) {
              const filesInDir = await readdir(parentDirPath);
              
              if (filesInDir.length === 1) {
                const loneFile = filesInDir[0];
                const ext = path.extname(loneFile);
                const indexFile = ext === '.astro' ? config.routing.indexFile : `index${ext}`;
                
                if (loneFile === indexFile) {
                  const loneFilePath = path.join(parentDirPath, loneFile);
                  const oldRelative = path.relative(process.cwd(), loneFilePath).replace(/\\/g, '/');

                  if (state.files[oldRelative] && state.files[oldRelative].kind === 'route') {
                    const flatFileName = routeToFilePath(parentRoute, {
                      extension: ext,
                      mode: 'flat'
                    });
                    const flatFilePath = secureJoin(pagesRoot, flatFileName);
                      
                    if (!existsSync(flatFilePath)) {
                      await rename(loneFilePath, flatFilePath);
                        
                      const newRelative = path.relative(process.cwd(), flatFilePath).replace(/\\/g, '/');
                        
                      state.files[newRelative] = { ...state.files[oldRelative] };
                      delete state.files[oldRelative];
                        
                      await updateImportsInFile(flatFilePath, loneFilePath, flatFilePath);

                      // Update hash in state after import updates
                      const content = await readFile(flatFilePath, 'utf-8');
                      state.files[newRelative].hash = calculateHash(content, config.hashing?.normalization);

                      console.log(`✓ Reorganized ${oldRelative} to ${newRelative} (flattened)`);
                      await cleanupEmptyDirs(parentDirPath, pagesRoot);
                    }
                  }
                }
              }
            }
          }
        }
      }

      state.sections = state.sections.filter(s => s.route !== normalizedRoute);
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

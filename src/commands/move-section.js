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
import { 
  updateImportsInFile,
  moveDirectory,
  scanAndReplaceImports
} from '../utils/refactor.js';

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

    // Shift arguments if using state or if called with fewer arguments
    if (!toRoute && fromRoute && fromFeature) {
        // textor move-section /old-route /new-route
        actualFromRoute = fromRoute;
        actualToRoute = fromFeature;
        actualFromFeature = undefined;
        actualToFeature = undefined;
    }

    // Lookup missing info from state
    if (actualFromRoute && !actualFromFeature) {
        const section = findSection(state, actualFromRoute);
        if (section) {
            actualFromFeature = section.featurePath;
        }
    } else if (!actualFromRoute && actualFromFeature) {
        const section = findSection(state, actualFromFeature);
        if (section) {
            actualFromRoute = section.route;
        }
    }

    // If toFeature is not provided, try to derive it from the new route if route moved
    if (!actualToFeature && actualToRoute && actualFromRoute && actualFromRoute !== actualToRoute && actualFromFeature) {
        const oldRouteParts = actualFromRoute.split('/').filter(Boolean);
        const newRouteParts = actualToRoute.split('/').filter(Boolean);
        const oldFeatureParts = actualFromFeature.split('/').filter(Boolean);
        
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
            actualToFeature = actualFromFeature;
        }
    } else if (!actualToFeature) {
        actualToFeature = actualFromFeature;
    }

    if (!actualToRoute) {
        actualToRoute = actualFromRoute;
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
    
    const fromRoutePath = fromRouteFile ? secureJoin(pagesRoot, fromRouteFile) : null;
    const toRoutePath = toRouteFile ? secureJoin(pagesRoot, toRouteFile) : null;
    
    const movedFiles = [];
    
    if (options.dryRun) {
      console.log('Dry run - would move:');
      if (fromRoutePath && toRoutePath && fromRoutePath !== toRoutePath) {
        console.log(`  Route: ${fromRoutePath} -> ${toRoutePath}`);
      }
      
      if (!isRouteOnly && normalizedFromFeature && normalizedToFeature) {
        const fromFeaturePath = secureJoin(featuresRoot, normalizedFromFeature);
        const toFeaturePath = secureJoin(featuresRoot, normalizedToFeature);
        console.log(`  Feature: ${fromFeaturePath} -> ${toFeaturePath}`);
      }
      
      return;
    }
    
    let normalizedToRouteRelative = null;
    if (fromRoutePath && toRoutePath) {
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
      
      if (fromRoutePath !== toRoutePath) {
        movedFiles.push({ from: fromRoutePath, to: toRoutePath });
      }
      
      // Update state for moved route file
      normalizedToRouteRelative = path.relative(process.cwd(), toRoutePath).replace(/\\/g, '/');
      if (routeFileState) {
        state.files[normalizedToRouteRelative] = { ...routeFileState, hash: newRouteHash };
        if (fromRoutePath !== toRoutePath) {
          delete state.files[normalizedFromRouteRelative];
        }
      }
      
      // Update imports in the route file (even if it didn't move, as feature might have)
      const targetFeature = normalizedToFeature || normalizedFromFeature;
      if (targetFeature && existsSync(toRoutePath)) {
        const fromFeatureDirPath = secureJoin(featuresRoot, normalizedFromFeature);
        const toFeatureDirPath = secureJoin(featuresRoot, targetFeature);
        const fromFeatureComponentName = getFeatureComponentName(normalizedFromFeature);
        const toFeatureComponentName = getFeatureComponentName(targetFeature);

        // First, update all relative imports in the file because it moved (or stayed)
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
          if (state.files[normalizedToRouteRelative]) {
            state.files[normalizedToRouteRelative].hash = calculateHash(content, config.hashing?.normalization);
          }
        }
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
        fromPath: normalizedFromFeature,
        fromName: getFeatureComponentName(normalizedFromFeature),
        type: 'feature'
      }, {
        toPath: normalizedToFeature || normalizedFromFeature,
        toName: getFeatureComponentName(normalizedToFeature || normalizedFromFeature)
      }, options);
    }
    
    if (fromRoutePath && toRoutePath && fromRoutePath !== toRoutePath) {
      await cleanupEmptyDirs(path.dirname(fromRoutePath), pagesRoot);
    }
    
    console.log('✓ Moved:');
    movedFiles.forEach(item => {
      console.log(`  ${item.from}`);
      console.log(`  -> ${item.to}`);
    });

    if (movedFiles.length > 0) {
      const existingSection = fromSection;
      
      // Update ownership in state if route moved
      if (normalizedFromRoute && normalizedToRoute && normalizedFromRoute !== normalizedToRoute) {
        for (const f in state.files) {
          if (state.files[f].owner === normalizedFromRoute) {
            state.files[f].owner = normalizedToRoute;
          }
        }
      }

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




import path from 'path';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeRoute, 
  routeToFilePath, 
  featureToDirectoryPath
} from '../utils/naming.js';
import { 
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
    
    let targetRoute = route;
    let targetFeaturePath = featurePath;
    let section = findSection(state, route);

    if (!targetFeaturePath) {
      if (section) {
        targetRoute = section.route;
        targetFeaturePath = section.featurePath;
      } else {
        throw new Error(`Section not found for identifier: ${route}. Please provide both route and featurePath.`);
      }
    }
    
    const normalizedRoute = normalizeRoute(targetRoute);
    const normalizedFeaturePath = featureToDirectoryPath(targetFeaturePath);
    
    const routeExtension = (section && section.extension) || config.naming.routeExtension;
    const routeFileName = routeToFilePath(normalizedRoute, {
      extension: routeExtension,
      mode: config.routing.mode,
      indexFile: config.routing.indexFile
    });
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    
    const routeFilePath = secureJoin(pagesRoot, routeFileName);
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
      console.log('No files to delete.');
    } else {
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

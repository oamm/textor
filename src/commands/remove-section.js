import path from 'path';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeRoute, 
  routeToFilePath, 
  featureToDirectoryPath,
  getFeatureFileName 
} from '../utils/naming.js';
import { 
  safeDelete, 
  safeDeleteDir,
  cleanupEmptyDirs 
} from '../utils/filesystem.js';

export async function removeSectionCommand(route, featurePath, options) {
  try {
    const config = await loadConfig();
    
    const normalizedRoute = normalizeRoute(route);
    const normalizedFeaturePath = featureToDirectoryPath(featurePath);
    
    const routeFileName = routeToFilePath(normalizedRoute, config.naming.routeExtension);
    const featureFileName = getFeatureFileName(normalizedFeaturePath, config.naming.featureExtension);
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    
    const routeFilePath = path.join(pagesRoot, routeFileName);
    const featureDirPath = path.join(featuresRoot, normalizedFeaturePath);
    const featureFilePath = path.join(featureDirPath, featureFileName);
    
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
      const result = await safeDelete(routeFilePath, options.force);
      
      if (result.deleted) {
        deletedFiles.push(routeFilePath);
      } else if (result.message) {
        skippedFiles.push({ path: routeFilePath, reason: result.message });
      }
    }
    
    if (!options.keepFeature) {
      const result = await safeDeleteDir(featureDirPath, options.force);
      
      if (result.deleted) {
        deletedDirs.push(featureDirPath);
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
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

import path from 'path';
import { readdir, stat, rmdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeRoute, 
  routeToFilePath, 
  featureToDirectoryPath,
  getFeatureFileName,
  getFeatureComponentName,
  getRelativeImportPath 
} from '../utils/naming.js';
import { 
  safeMove,
  ensureDir,
  updateSignature,
  cleanupEmptyDirs
} from '../utils/filesystem.js';

export async function moveSectionCommand(fromRoute, fromFeature, toRoute, toFeature, options) {
  try {
    const config = await loadConfig();
    
    const isRouteOnly = options.keepFeature || (!toFeature && toRoute);
    
    if (isRouteOnly && !toRoute) {
      throw new Error('Destination route required for route-only move');
    }
    
    const normalizedFromRoute = normalizeRoute(fromRoute);
    const normalizedToRoute = normalizeRoute(toRoute);
    const normalizedFromFeature = fromFeature ? featureToDirectoryPath(fromFeature) : null;
    const normalizedToFeature = toFeature ? featureToDirectoryPath(toFeature) : null;
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    
    const fromRouteFile = routeToFilePath(normalizedFromRoute, config.naming.routeExtension);
    const toRouteFile = routeToFilePath(normalizedToRoute, config.naming.routeExtension);
    
    const fromRoutePath = path.join(pagesRoot, fromRouteFile);
    const toRoutePath = path.join(pagesRoot, toRouteFile);
    
    const movedFiles = [];
    
    if (options.dryRun) {
      console.log('Dry run - would move:');
      console.log(`  Route: ${fromRoutePath} -> ${toRoutePath}`);
      
      if (!isRouteOnly && normalizedFromFeature && normalizedToFeature) {
        const fromFeaturePath = path.join(featuresRoot, normalizedFromFeature);
        const toFeaturePath = path.join(featuresRoot, normalizedToFeature);
        console.log(`  Feature: ${fromFeaturePath} -> ${toFeaturePath}`);
      }
      
      return;
    }
    
    await safeMove(fromRoutePath, toRoutePath, options.force);
    movedFiles.push({ from: fromRoutePath, to: toRoutePath });
    
    // Update imports in the moved route file
    const targetFeature = normalizedToFeature || normalizedFromFeature;
    if (targetFeature) {
      const fromFeatureDirPath = path.join(featuresRoot, normalizedFromFeature);
      const toFeatureDirPath = path.join(featuresRoot, targetFeature);
      const fromFeatureComponentName = getFeatureComponentName(normalizedFromFeature);
      const toFeatureComponentName = getFeatureComponentName(targetFeature);

      // Update component name in JSX
      if (fromFeatureComponentName !== toFeatureComponentName) {
        let content = await readFile(toRoutePath, 'utf-8');
        content = content.replace(
          new RegExp(`<${fromFeatureComponentName}`, 'g'),
          `<${toFeatureComponentName}`
        );
        content = content.replace(
          new RegExp(`</${fromFeatureComponentName}`, 'g'),
          `</${toFeatureComponentName}`
        );
        await writeFile(toRoutePath, content, 'utf-8');
      }

      if (config.importAliases.features) {
        if (normalizedFromFeature !== targetFeature) {
          const oldAliasPath = `${config.importAliases.features}/${normalizedFromFeature}`;
          const newAliasPath = `${config.importAliases.features}/${targetFeature}`;
          
          // Replace both the path and the component name if they are different
          await updateSignature(toRoutePath, 
            `import ${fromFeatureComponentName} from '${oldAliasPath}/${fromFeatureComponentName}'`, 
            `import ${toFeatureComponentName} from '${newAliasPath}/${toFeatureComponentName}'`
          );
          
          // Fallback for prefix only replacement
          await updateSignature(toRoutePath, oldAliasPath, newAliasPath);
        } else if (fromFeatureComponentName !== toFeatureComponentName) {
          // Name changed but path didn't
          const aliasPath = `${config.importAliases.features}/${targetFeature}`;
          await updateSignature(toRoutePath,
            `import ${fromFeatureComponentName} from '${aliasPath}/${fromFeatureComponentName}'`,
            `import ${toFeatureComponentName} from '${aliasPath}/${toFeatureComponentName}'`
          );
        }
      } else {
        const oldRelativeDir = getRelativeImportPath(fromRoutePath, fromFeatureDirPath);
        const newRelativeDir = getRelativeImportPath(toRoutePath, toFeatureDirPath);
        
        const oldImportPath = `import ${fromFeatureComponentName} from '${oldRelativeDir}/${fromFeatureComponentName}'`;
        const newImportPath = `import ${toFeatureComponentName} from '${newRelativeDir}/${toFeatureComponentName}'`;
        
        if (oldImportPath !== newImportPath) {
          await updateSignature(toRoutePath, oldImportPath, newImportPath);
        }
      }
    }
    
    if (!isRouteOnly && normalizedFromFeature && normalizedToFeature) {
      const fromFeaturePath = path.join(featuresRoot, normalizedFromFeature);
      const toFeaturePath = path.join(featuresRoot, normalizedToFeature);
      
      if (existsSync(fromFeaturePath)) {
        await moveDirectory(fromFeaturePath, toFeaturePath, options.force);
        movedFiles.push({ from: fromFeaturePath, to: toFeaturePath });
        
        await cleanupEmptyDirs(path.dirname(fromFeaturePath), featuresRoot);
      }
    }
    
    await cleanupEmptyDirs(path.dirname(fromRoutePath), pagesRoot);
    
    console.log('✓ Moved:');
    movedFiles.forEach(item => {
      console.log(`  ${item.from}`);
      console.log(`  -> ${item.to}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function moveDirectory(fromPath, toPath, force = false) {
  if (!existsSync(fromPath)) {
    throw new Error(`Source directory not found: ${fromPath}`);
  }
  
  if (existsSync(toPath) && !force) {
    throw new Error(
      `Destination already exists: ${toPath}\n` +
      `Use --force to overwrite.`
    );
  }
  
  await ensureDir(toPath);
  
  const entries = await readdir(fromPath);
  
  for (const entry of entries) {
    const fromEntryPath = path.join(fromPath, entry);
    const toEntryPath = path.join(toPath, entry);
    
    const stats = await stat(fromEntryPath);
    
    if (stats.isDirectory()) {
      await moveDirectory(fromEntryPath, toEntryPath, force);
    } else {
      await safeMove(fromEntryPath, toEntryPath, force);
    }
  }
  
  const remainingFiles = await readdir(fromPath);
  if (remainingFiles.length === 0) {
    await rmdir(fromPath);
  }
}

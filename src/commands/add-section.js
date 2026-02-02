import path from 'path';
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
  ensureNotExists, 
  writeFileWithSignature,
  ensureDir,
  secureJoin 
} from '../utils/filesystem.js';
import { 
  generateRouteTemplate, 
  generateFeatureTemplate,
  generateScriptsIndexTemplate 
} from '../utils/templates.js';
import { addSectionToState } from '../utils/state.js';

export async function addSectionCommand(route, featurePath, options) {
  try {
    const config = await loadConfig();
    
    const normalizedRoute = normalizeRoute(route);
    const normalizedFeaturePath = featureToDirectoryPath(featurePath);
    
    const routeFileName = routeToFilePath(normalizedRoute, config.naming.routeExtension);
    const featureComponentName = getFeatureComponentName(normalizedFeaturePath);
    const featureFileName = getFeatureFileName(normalizedFeaturePath, config.naming.featureExtension);
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    const layoutsRoot = resolvePath(config, 'layouts');
    
    const routeFilePath = secureJoin(pagesRoot, routeFileName);
    const featureDirPath = secureJoin(featuresRoot, normalizedFeaturePath);
    const featureFilePath = secureJoin(featureDirPath, featureFileName);
    const scriptsIndexPath = secureJoin(featureDirPath, config.features.scriptsIndexFile);
    const componentsDirPath = secureJoin(featureDirPath, 'sub-components');
    
    if (options.dryRun) {
      console.log('Dry run - would create:');
      console.log(`  Route: ${routeFilePath}`);
      console.log(`  Feature: ${featureFilePath}`);
      
      if (config.features.createSubComponentsDir) {
        console.log(`  Sub-components: ${componentsDirPath}/`);
      }
      
      if (config.features.createScriptsDir) {
        console.log(`  Scripts: ${scriptsIndexPath}`);
      }
      
      return;
    }

    await ensureNotExists(routeFilePath, options.force);
    await ensureNotExists(featureFilePath, options.force);
    
    let layoutImportPath;
    if (config.importAliases.layouts) {
      layoutImportPath = `${config.importAliases.layouts}/${options.layout}.astro`;
    } else {
      const layoutFilePath = secureJoin(layoutsRoot, `${options.layout}.astro`);
      layoutImportPath = getRelativeImportPath(routeFilePath, layoutFilePath);
    }

    let featureImportPath;
    if (config.importAliases.features) {
      featureImportPath = `${config.importAliases.features}/${normalizedFeaturePath}/${featureComponentName}`;
    } else {
      const relativeFeatureDir = getRelativeImportPath(routeFilePath, featureDirPath);
      featureImportPath = `${relativeFeatureDir}/${featureComponentName}`;
    }
    
    let scriptImportPath;
    if (config.features.createScriptsDir) {
      scriptImportPath = getRelativeImportPath(featureFilePath, scriptsIndexPath);
    }

    const routeContent = generateRouteTemplate(
      options.layout,
      layoutImportPath,
      featureImportPath,
      featureComponentName
    );
    
    const featureContent = generateFeatureTemplate(featureComponentName, scriptImportPath);
    
    await writeFileWithSignature(
      routeFilePath,
      routeContent,
      config.signatures.astro
    );
    
    await ensureDir(featureDirPath);
    
    await writeFileWithSignature(
      featureFilePath,
      featureContent,
      config.signatures.astro
    );
    
    if (config.features.createSubComponentsDir) {
      await ensureDir(componentsDirPath);
    }
    
    if (config.features.createScriptsDir) {
      await writeFileWithSignature(
        scriptsIndexPath,
        generateScriptsIndexTemplate(),
        config.signatures.typescript
      );
    }
    
    console.log('✓ Section created successfully:');
    console.log(`  Route: ${routeFilePath}`);
    console.log(`  Feature: ${featureFilePath}`);
    
    if (config.features.createSubComponentsDir) {
      console.log(`  Sub-components: ${componentsDirPath}/`);
    }
    
    if (config.features.createScriptsDir) {
      console.log(`  Scripts: ${scriptsIndexPath}`);
    }
    
    await addSectionToState({
      name: options.name || featureComponentName,
      route: normalizedRoute,
      featurePath: normalizedFeaturePath,
      layout: options.layout
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

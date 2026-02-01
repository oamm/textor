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
  ensureDir 
} from '../utils/filesystem.js';
import { 
  generateRouteTemplate, 
  generateFeatureTemplate,
  generateScriptsIndexTemplate 
} from '../utils/templates.js';

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
    
    const routeFilePath = path.join(pagesRoot, routeFileName);
    const featureDirPath = path.join(featuresRoot, normalizedFeaturePath);
    const featureFilePath = path.join(featureDirPath, featureFileName);
    
    await ensureNotExists(routeFilePath, false);
    await ensureNotExists(featureFilePath, false);
    
    let layoutImportPath;
    if (config.importAliases.layouts) {
      layoutImportPath = `${config.importAliases.layouts}/${options.layout}.astro`;
    } else {
      const layoutFilePath = path.join(layoutsRoot, `${options.layout}.astro`);
      layoutImportPath = getRelativeImportPath(routeFilePath, layoutFilePath);
    }

    let featureImportPath;
    if (config.importAliases.features) {
      featureImportPath = `${config.importAliases.features}/${normalizedFeaturePath}/${featureComponentName}`;
    } else {
      const relativeFeatureDir = getRelativeImportPath(routeFilePath, featureDirPath);
      featureImportPath = `${relativeFeatureDir}/${featureComponentName}`;
    }
    
    const routeContent = generateRouteTemplate(
      options.layout,
      layoutImportPath,
      featureImportPath,
      featureComponentName
    );
    
    const featureContent = generateFeatureTemplate(featureComponentName);
    
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
    
    if (config.features.createComponentsDir) {
      const componentsDirPath = path.join(featureDirPath, 'Components');
      await ensureDir(componentsDirPath);
    }
    
    if (config.features.createScriptsDir) {
      const scriptsIndexPath = path.join(featureDirPath, config.features.scriptsIndexFile);
      await writeFileWithSignature(
        scriptsIndexPath,
        generateScriptsIndexTemplate(),
        config.signatures.typescript
      );
    }
    
    console.log('✓ Section created successfully:');
    console.log(`  Route: ${routeFilePath}`);
    console.log(`  Feature: ${featureFilePath}`);
    
    if (config.features.createComponentsDir) {
      console.log(`  Components: ${path.join(featureDirPath, 'Components')}/`);
    }
    
    if (config.features.createScriptsDir) {
      console.log(`  Scripts: ${path.join(featureDirPath, config.features.scriptsIndexFile)}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

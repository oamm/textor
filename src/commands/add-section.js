import path from 'path';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeRoute, 
  routeToFilePath, 
  featureToDirectoryPath,
  getFeatureFileName,
  getFeatureComponentName,
  getRelativeImportPath,
  getHookFileName,
  getHookFunctionName
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
  generateScriptsIndexTemplate,
  generateHookTemplate,
  generateContextTemplate,
  generateTestTemplate,
  generateConfigTemplate,
  generateConstantsTemplate,
  generateIndexTemplate,
  generateTypesTemplate,
  generateApiTemplate,
  generateEndpointTemplate,
  generateServiceTemplate,
  generateSchemaTemplate,
  generateReadmeTemplate,
  generateStoriesTemplate
} from '../utils/templates.js';
import { addSectionToState } from '../utils/state.js';

export async function addSectionCommand(route, featurePath, options) {
  try {
    const config = await loadConfig();
    
    const normalizedRoute = normalizeRoute(route);
    const normalizedFeaturePath = featureToDirectoryPath(featurePath);
    
    const routeExtension = options.endpoint ? '.ts' : config.naming.routeExtension;
    const routeFileName = routeToFilePath(normalizedRoute, routeExtension);
    const featureComponentName = getFeatureComponentName(normalizedFeaturePath);
    const featureFileName = getFeatureFileName(normalizedFeaturePath, config.naming.featureExtension);
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    const layoutsRoot = resolvePath(config, 'layouts');
    
    const routeFilePath = secureJoin(pagesRoot, routeFileName);
    const featureDirPath = secureJoin(featuresRoot, normalizedFeaturePath);
    const featureFilePath = secureJoin(featureDirPath, featureFileName);
    const scriptsIndexPath = secureJoin(featureDirPath, config.features.scriptsIndexFile);
    const subComponentsDir = secureJoin(featureDirPath, 'sub-components');
    const testsDir = secureJoin(featureDirPath, '__tests__');
    const contextDirInside = secureJoin(featureDirPath, 'context');
    const hooksDirInside = secureJoin(featureDirPath, 'hooks');
    const typesDirInside = secureJoin(featureDirPath, 'types');
    const apiDirInside = secureJoin(featureDirPath, 'api');
    const servicesDirInside = secureJoin(featureDirPath, 'services');
    const schemasDirInside = secureJoin(featureDirPath, 'schemas');
    
    const shouldCreateSubComponentsDir = options.subComponentsDir !== undefined ? options.subComponentsDir : config.features.createSubComponentsDir;
    const shouldCreateScriptsDir = options.scriptsDir !== undefined ? options.scriptsDir : config.features.createScriptsDir;
    const shouldCreateApi = options.api !== undefined ? options.api : config.features.createApi;
    const shouldCreateServices = options.services !== undefined ? options.services : config.features.createServices;
    const shouldCreateSchemas = options.schemas !== undefined ? options.schemas : config.features.createSchemas;
    const shouldCreateHooks = options.hooks !== undefined ? options.hooks : config.features.createHooks;
    const shouldCreateContext = options.context !== undefined ? options.context : config.features.createContext;
    const shouldCreateTests = options.tests !== undefined ? options.tests : config.features.createTests;
    const shouldCreateTypes = options.types !== undefined ? options.types : config.features.createTypes;
    const shouldCreateReadme = options.readme !== undefined ? options.readme : config.features.createReadme;
    const shouldCreateStories = options.stories !== undefined ? options.stories : config.features.createStories;
    const shouldCreateIndex = options.index !== undefined ? options.index : config.features.createIndex;

    const indexFilePath = path.join(featureDirPath, 'index.ts');
    const contextFilePath = path.join(contextDirInside, `${featureComponentName}Context.tsx`);
    const hookFilePath = path.join(hooksDirInside, getHookFileName(featureComponentName, config.naming.hookExtension));
    const testFilePath = path.join(testsDir, `${featureComponentName}${config.naming.testExtension}`);
    const typesFilePath = path.join(typesDirInside, 'index.ts');
    const apiFilePath = path.join(apiDirInside, 'index.ts');
    const servicesFilePath = path.join(servicesDirInside, 'index.ts');
    const schemasFilePath = path.join(schemasDirInside, 'index.ts');
    const readmeFilePath = path.join(featureDirPath, 'README.md');
    const storiesFilePath = path.join(featureDirPath, `${featureComponentName}.stories.tsx`);

    const createdFiles = [];

    if (options.dryRun) {
      console.log('Dry run - would create:');
      console.log(`  Route: ${routeFilePath}`);
      console.log(`  Feature: ${featureFilePath}`);
      
      if (shouldCreateIndex) console.log(`  Index: ${indexFilePath}`);
      if (shouldCreateSubComponentsDir) console.log(`  Sub-components: ${subComponentsDir}/`);
      if (shouldCreateScriptsDir) console.log(`  Scripts: ${scriptsIndexPath}`);
      if (shouldCreateApi) console.log(`  Api: ${apiFilePath}`);
      if (shouldCreateServices) console.log(`  Services: ${servicesFilePath}`);
      if (shouldCreateSchemas) console.log(`  Schemas: ${schemasFilePath}`);
      if (shouldCreateHooks) console.log(`  Hooks: ${hookFilePath}`);
      if (shouldCreateContext) console.log(`  Context: ${contextFilePath}`);
      if (shouldCreateTests) console.log(`  Tests: ${testFilePath}`);
      if (shouldCreateTypes) console.log(`  Types: ${typesFilePath}`);
      if (shouldCreateReadme) console.log(`  Readme: ${readmeFilePath}`);
      if (shouldCreateStories) console.log(`  Stories: ${storiesFilePath}`);
      
      return;
    }

    await ensureNotExists(routeFilePath, options.force);
    await ensureNotExists(featureFilePath, options.force);
    
    if (shouldCreateIndex) await ensureNotExists(indexFilePath, options.force);
    if (shouldCreateContext) await ensureNotExists(contextFilePath, options.force);
    if (shouldCreateHooks) await ensureNotExists(hookFilePath, options.force);
    if (shouldCreateTests) await ensureNotExists(testFilePath, options.force);
    if (shouldCreateTypes) await ensureNotExists(typesFilePath, options.force);
    if (shouldCreateApi) await ensureNotExists(apiFilePath, options.force);
    if (shouldCreateServices) await ensureNotExists(servicesFilePath, options.force);
    if (shouldCreateSchemas) await ensureNotExists(schemasFilePath, options.force);
    if (shouldCreateReadme) await ensureNotExists(readmeFilePath, options.force);
    if (shouldCreateStories) await ensureNotExists(storiesFilePath, options.force);
    if (shouldCreateScriptsDir) await ensureNotExists(scriptsIndexPath, options.force);
    
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

    let routeContent;
    let routeSignature;
    
    if (options.endpoint) {
      routeContent = generateEndpointTemplate(featureComponentName);
      routeSignature = config.signatures.typescript;
    } else {
      routeContent = generateRouteTemplate(
        options.layout,
        layoutImportPath,
        featureImportPath,
        featureComponentName
      );
      routeSignature = config.signatures.astro;
    }
    
    const featureContent = generateFeatureTemplate(featureComponentName, scriptImportPath);
    
    await writeFileWithSignature(
      routeFilePath,
      routeContent,
      routeSignature
    );
    
    await ensureDir(featureDirPath);
    
    if (shouldCreateSubComponentsDir) await ensureDir(subComponentsDir);
    if (shouldCreateApi) await ensureDir(apiDirInside);
    if (shouldCreateServices) await ensureDir(servicesDirInside);
    if (shouldCreateSchemas) await ensureDir(schemasDirInside);
    if (shouldCreateHooks) await ensureDir(hooksDirInside);
    if (shouldCreateContext) await ensureDir(contextDirInside);
    if (shouldCreateTests) await ensureDir(testsDir);
    if (shouldCreateTypes) await ensureDir(typesDirInside);

    await writeFileWithSignature(
      featureFilePath,
      featureContent,
      config.signatures.astro
    );
    
    if (shouldCreateScriptsDir) {
      await writeFileWithSignature(
        scriptsIndexPath,
        generateScriptsIndexTemplate(),
        config.signatures.typescript
      );
    }

    if (shouldCreateIndex) {
      const indexContent = generateIndexTemplate(featureComponentName, config.naming.featureExtension);
      await writeFileWithSignature(
        indexFilePath,
        indexContent,
        config.signatures.typescript
      );
    }

    if (shouldCreateApi) {
      const apiContent = generateApiTemplate(featureComponentName);
      await writeFileWithSignature(apiFilePath, apiContent, config.signatures.typescript);
    }

    if (shouldCreateServices) {
      const servicesContent = generateServiceTemplate(featureComponentName);
      await writeFileWithSignature(servicesFilePath, servicesContent, config.signatures.typescript);
    }

    if (shouldCreateSchemas) {
      const schemasContent = generateSchemaTemplate(featureComponentName);
      await writeFileWithSignature(schemasFilePath, schemasContent, config.signatures.typescript);
    }

    if (shouldCreateHooks) {
      const hookName = getHookFunctionName(featureComponentName);
      const hookContent = generateHookTemplate(featureComponentName, hookName);
      await writeFileWithSignature(hookFilePath, hookContent, config.signatures.typescript);
    }

    if (shouldCreateContext) {
      const contextContent = generateContextTemplate(featureComponentName);
      await writeFileWithSignature(contextFilePath, contextContent, config.signatures.typescript);
    }

    if (shouldCreateTests) {
      const relativeFeaturePath = `./${featureComponentName}${config.naming.featureExtension}`;
      const testContent = generateTestTemplate(featureComponentName, relativeFeaturePath);
      await writeFileWithSignature(testFilePath, testContent, config.signatures.typescript);
    }

    if (shouldCreateTypes) {
      const typesContent = generateTypesTemplate(featureComponentName);
      await writeFileWithSignature(typesFilePath, typesContent, config.signatures.typescript);
    }

    if (shouldCreateReadme) {
      const readmeContent = generateReadmeTemplate(featureComponentName);
      await writeFileWithSignature(readmeFilePath, readmeContent, config.signatures.astro);
    }

    if (shouldCreateStories) {
      const relativePath = `./${featureComponentName}${config.naming.featureExtension}`;
      const storiesContent = generateStoriesTemplate(featureComponentName, relativePath);
      await writeFileWithSignature(storiesFilePath, storiesContent, config.signatures.typescript);
    }
    
    console.log('✓ Section created successfully:');
    console.log(`  Route: ${routeFilePath}`);
    console.log(`  Feature: ${featureFilePath}`);
    
    if (shouldCreateIndex) console.log(`  Index: ${indexFilePath}`);
    if (shouldCreateSubComponentsDir) console.log(`  Sub-components: ${subComponentsDir}/`);
    if (shouldCreateScriptsDir) console.log(`  Scripts: ${scriptsIndexPath}`);
    if (shouldCreateApi) console.log(`  Api: ${apiFilePath}`);
    if (shouldCreateServices) console.log(`  Services: ${servicesFilePath}`);
    if (shouldCreateSchemas) console.log(`  Schemas: ${schemasFilePath}`);
    if (shouldCreateHooks) console.log(`  Hooks: ${hookFilePath}`);
    if (shouldCreateContext) console.log(`  Context: ${contextFilePath}`);
    if (shouldCreateTests) console.log(`  Tests: ${testFilePath}`);
    if (shouldCreateTypes) console.log(`  Types: ${typesFilePath}`);
    if (shouldCreateReadme) console.log(`  Readme: ${readmeFilePath}`);
    if (shouldCreateStories) console.log(`  Stories: ${storiesFilePath}`);
    
    await addSectionToState({
      name: options.name || featureComponentName,
      route: normalizedRoute,
      featurePath: normalizedFeaturePath,
      layout: options.layout,
      extension: routeExtension
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

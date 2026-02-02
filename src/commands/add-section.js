import path from 'path';
import { loadConfig, resolvePath, getEffectiveOptions } from '../utils/config.js';
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
  secureJoin,
  formatFiles
} from '../utils/filesystem.js';
import { 
  generateRouteTemplate, 
  generateFeatureTemplate,
  generateScriptsIndexTemplate,
  generateHookTemplate,
  generateContextTemplate,
  generateTestTemplate,
  generateIndexTemplate,
  generateTypesTemplate,
  generateApiTemplate,
  generateEndpointTemplate,
  generateServiceTemplate,
  generateSchemaTemplate,
  generateReadmeTemplate,
  generateStoriesTemplate
} from '../utils/templates.js';
import { addSectionToState, registerFile } from '../utils/state.js';

export async function addSectionCommand(route, featurePath, options) {
  try {
    const config = await loadConfig();
    const effectiveOptions = getEffectiveOptions(options, config, 'features');
    
    const normalizedRoute = normalizeRoute(route);
    const normalizedFeaturePath = featureToDirectoryPath(featurePath);
    
    const routeExtension = options.endpoint ? '.ts' : config.naming.routeExtension;
    const routeFileName = routeToFilePath(normalizedRoute, {
      extension: routeExtension,
      mode: config.routing.mode,
      indexFile: config.routing.indexFile
    });
    
    const featureComponentName = getFeatureComponentName(normalizedFeaturePath);
    const featureFileName = getFeatureFileName(normalizedFeaturePath, {
      extension: config.naming.featureExtension,
      strategy: effectiveOptions.entry
    });
    
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
    
    const {
      framework,
      createSubComponentsDir: shouldCreateSubComponentsDir,
      createScriptsDir: shouldCreateScriptsDir,
      createApi: shouldCreateApi,
      createServices: shouldCreateServices,
      createSchemas: shouldCreateSchemas,
      createHooks: shouldCreateHooks,
      createContext: shouldCreateContext,
      createTests: shouldCreateTests,
      createTypes: shouldCreateTypes,
      createReadme: shouldCreateReadme,
      createStories: shouldCreateStories,
      createIndex: shouldCreateIndex
    } = effectiveOptions;

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
    
    let layoutImportPath = null;
    if (options.layout !== 'none') {
      if (config.importAliases.layouts) {
        layoutImportPath = `${config.importAliases.layouts}/${options.layout}.astro`;
      } else {
        const layoutFilePath = secureJoin(layoutsRoot, `${options.layout}.astro`);
        layoutImportPath = getRelativeImportPath(routeFilePath, layoutFilePath);
      }
    }

    let featureImportPath;
    if (config.importAliases.features) {
      const entryPart = effectiveOptions.entry === 'index' ? '' : `/${featureComponentName}`;
      // In Astro, we can often omit the extension for .tsx files, but not for .astro files if using aliases sometimes.
      // However, to be safe, we use the configured extension.
      featureImportPath = `${config.importAliases.features}/${normalizedFeaturePath}${entryPart}${config.naming.featureExtension}`;
    } else {
      const relativeFeatureFile = getRelativeImportPath(routeFilePath, featureFilePath);
      // Remove extension for import
      featureImportPath = relativeFeatureFile.replace(/\.[^/.]+$/, '');
    }
    
    let scriptImportPath;
    if (shouldCreateScriptsDir) {
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
    
    const featureContent = generateFeatureTemplate(featureComponentName, scriptImportPath, framework);
    
    const routeHash = await writeFileWithSignature(
      routeFilePath,
      routeContent,
      routeSignature
    );
    await registerFile(routeFilePath, { kind: 'route', template: options.endpoint ? 'endpoint' : 'route', hash: routeHash });
    
    const writtenFiles = [routeFilePath];

    await ensureDir(featureDirPath);
    
    if (shouldCreateSubComponentsDir) await ensureDir(subComponentsDir);
    if (shouldCreateApi) await ensureDir(apiDirInside);
    if (shouldCreateServices) await ensureDir(servicesDirInside);
    if (shouldCreateSchemas) await ensureDir(schemasDirInside);
    if (shouldCreateHooks) await ensureDir(hooksDirInside);
    if (shouldCreateContext) await ensureDir(contextDirInside);
    if (shouldCreateTests) await ensureDir(testsDir);
    if (shouldCreateTypes) await ensureDir(typesDirInside);

    const featureSignature = config.naming.featureExtension === '.astro'
      ? config.signatures.astro
      : (config.signatures.tsx || config.signatures.typescript);

    const featureHash = await writeFileWithSignature(
      featureFilePath,
      featureContent,
      featureSignature
    );
    await registerFile(featureFilePath, { kind: 'feature', template: 'feature', hash: featureHash });
    writtenFiles.push(featureFilePath);

    if (shouldCreateScriptsDir) {
      const hash = await writeFileWithSignature(
        scriptsIndexPath,
        generateScriptsIndexTemplate(),
        config.signatures.typescript
      );
      await registerFile(scriptsIndexPath, { kind: 'feature-file', template: 'scripts-index', hash });
      writtenFiles.push(scriptsIndexPath);
    }

    if (shouldCreateIndex) {
      const indexContent = generateIndexTemplate(featureComponentName, config.naming.featureExtension);
      const hash = await writeFileWithSignature(
        indexFilePath,
        indexContent,
        config.signatures.typescript
      );
      await registerFile(indexFilePath, { kind: 'feature-file', template: 'index', hash });
      writtenFiles.push(indexFilePath);
    }

    if (shouldCreateApi) {
      const apiContent = generateApiTemplate(featureComponentName);
      const hash = await writeFileWithSignature(apiFilePath, apiContent, config.signatures.typescript);
      await registerFile(apiFilePath, { kind: 'feature-file', template: 'api', hash });
      writtenFiles.push(apiFilePath);
    }

    if (shouldCreateServices) {
      const servicesContent = generateServiceTemplate(featureComponentName);
      const hash = await writeFileWithSignature(servicesFilePath, servicesContent, config.signatures.typescript);
      await registerFile(servicesFilePath, { kind: 'feature-file', template: 'service', hash });
      writtenFiles.push(servicesFilePath);
    }

    if (shouldCreateSchemas) {
      const schemasContent = generateSchemaTemplate(featureComponentName);
      const hash = await writeFileWithSignature(schemasFilePath, schemasContent, config.signatures.typescript);
      await registerFile(schemasFilePath, { kind: 'feature-file', template: 'schema', hash });
      writtenFiles.push(schemasFilePath);
    }

    if (shouldCreateHooks) {
      const hookName = getHookFunctionName(featureComponentName);
      const hookContent = generateHookTemplate(featureComponentName, hookName);
      const hash = await writeFileWithSignature(hookFilePath, hookContent, config.signatures.typescript);
      await registerFile(hookFilePath, { kind: 'feature-file', template: 'hook', hash });
      writtenFiles.push(hookFilePath);
    }

    if (shouldCreateContext) {
      const contextContent = generateContextTemplate(featureComponentName);
      const hash = await writeFileWithSignature(contextFilePath, contextContent, config.signatures.typescript);
      await registerFile(contextFilePath, { kind: 'feature-file', template: 'context', hash });
      writtenFiles.push(contextFilePath);
    }

    if (shouldCreateTests) {
      const relativeFeaturePath = `./${path.basename(featureFilePath)}`;
      const testContent = generateTestTemplate(featureComponentName, relativeFeaturePath);
      const hash = await writeFileWithSignature(testFilePath, testContent, config.signatures.typescript);
      await registerFile(testFilePath, { kind: 'feature-file', template: 'test', hash });
      writtenFiles.push(testFilePath);
    }

    if (shouldCreateTypes) {
      const typesContent = generateTypesTemplate(featureComponentName);
      const hash = await writeFileWithSignature(typesFilePath, typesContent, config.signatures.typescript);
      await registerFile(typesFilePath, { kind: 'feature-file', template: 'types', hash });
      writtenFiles.push(typesFilePath);
    }

    if (shouldCreateReadme) {
      const readmeContent = generateReadmeTemplate(featureComponentName);
      const hash = await writeFileWithSignature(readmeFilePath, readmeContent, config.signatures.astro);
      await registerFile(readmeFilePath, { kind: 'feature-file', template: 'readme', hash });
      writtenFiles.push(readmeFilePath);
    }

    if (shouldCreateStories) {
      const relativePath = `./${path.basename(featureFilePath)}`;
      const storiesContent = generateStoriesTemplate(featureComponentName, relativePath);
      const hash = await writeFileWithSignature(storiesFilePath, storiesContent, config.signatures.typescript);
      await registerFile(storiesFilePath, { kind: 'feature-file', template: 'stories', hash });
      writtenFiles.push(storiesFilePath);
    }
    
    // Formatting
    if (config.formatting.tool !== 'none') {
        await formatFiles(writtenFiles, config.formatting.tool);
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

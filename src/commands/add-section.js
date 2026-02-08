import path from 'path';
import { rename, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
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
  calculateHash,
  ensureNotExists, 
  isTextorGenerated,
  writeFileWithSignature,
  getSignature,
  ensureDir,
  secureJoin,
  formatFiles
} from '../utils/filesystem.js';
import { resolvePatternedPath } from '../utils/patterns.js';
import { 
  generateRouteTemplate, 
  mergeRouteTemplate,
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
  generateStoriesTemplate,
  enrichData
} from '../utils/templates.js';
import { addSectionToState, registerFile, loadState, saveState } from '../utils/state.js';
import { stageFiles } from '../utils/git.js';

export async function addSectionCommand(route, featurePath, options) {
  try {
    const config = await loadConfig();

    // Handle optional route
    if (typeof featurePath === 'object' || featurePath === undefined) {
      options = featurePath || options || {};
      featurePath = route;
      route = null;
    }
    
    const effectiveOptions = getEffectiveOptions(options, config, 'features');
    
    const normalizedRoute = normalizeRoute(route);
    const normalizedFeaturePath = featureToDirectoryPath(featurePath);
    
    const pagesRoot = resolvePath(config, 'pages');
    const featuresRoot = resolvePath(config, 'features');
    const layoutsRoot = resolvePath(config, 'layouts');
    
    const routeExtension = options.endpoint ? '.ts' : config.naming.routeExtension;
    
    // Check if we should use nested mode even if config says flat
    // (because the directory already exists, suggesting it should be an index file)
    let effectiveRoutingMode = config.routing.mode;
    if (normalizedRoute && effectiveRoutingMode === 'flat') {
      const routeDirName = routeToFilePath(normalizedRoute, {
        extension: '',
        mode: 'flat'
      });
      const routeDirPath = secureJoin(pagesRoot, routeDirName);
      if (existsSync(routeDirPath)) {
        effectiveRoutingMode = 'nested';
      }
    }

    const routeFileName = normalizedRoute ? routeToFilePath(normalizedRoute, {
      extension: routeExtension,
      mode: effectiveRoutingMode,
      indexFile: config.routing.indexFile
    }) : null;
    
    const featureComponentName = getFeatureComponentName(normalizedFeaturePath);
    const featureFileName = getFeatureFileName(normalizedFeaturePath, {
      extension: config.naming.featureExtension,
      strategy: effectiveOptions.entry
    });
    
    const routeFilePath = routeFileName ? secureJoin(pagesRoot, routeFileName) : null;
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
      layout,
      layoutProps: configLayoutProps,
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

    const featurePatterns = config.filePatterns?.features || {};
    const patternData = {
      componentName: featureComponentName,
      hookName: getHookFunctionName(featureComponentName),
      hookExtension: config.naming.hookExtension,
      testExtension: config.naming.testExtension,
      featureExtension: config.naming.featureExtension,
      componentExtension: config.naming.componentExtension
    };

    const indexFilePath = resolvePatternedPath(
      featureDirPath,
      featurePatterns.index,
      patternData,
      'index.ts',
      'filePatterns.features.index'
    );
    const contextFilePath = resolvePatternedPath(
      contextDirInside,
      featurePatterns.context,
      patternData,
      `${featureComponentName}Context.tsx`,
      'filePatterns.features.context'
    );
    const hookFilePath = resolvePatternedPath(
      hooksDirInside,
      featurePatterns.hook,
      patternData,
      getHookFileName(featureComponentName, config.naming.hookExtension),
      'filePatterns.features.hook'
    );
    const testFilePath = resolvePatternedPath(
      testsDir,
      featurePatterns.test,
      patternData,
      `${featureComponentName}${config.naming.testExtension}`,
      'filePatterns.features.test'
    );
    const typesFilePath = resolvePatternedPath(
      typesDirInside,
      featurePatterns.types,
      patternData,
      'index.ts',
      'filePatterns.features.types'
    );
    const apiFilePath = resolvePatternedPath(
      apiDirInside,
      featurePatterns.api,
      patternData,
      'index.ts',
      'filePatterns.features.api'
    );
    const servicesFilePath = resolvePatternedPath(
      servicesDirInside,
      featurePatterns.services,
      patternData,
      'index.ts',
      'filePatterns.features.services'
    );
    const schemasFilePath = resolvePatternedPath(
      schemasDirInside,
      featurePatterns.schemas,
      patternData,
      'index.ts',
      'filePatterns.features.schemas'
    );
    const readmeFilePath = resolvePatternedPath(
      featureDirPath,
      featurePatterns.readme,
      patternData,
      'README.md',
      'filePatterns.features.readme'
    );
    const storiesFilePath = resolvePatternedPath(
      featureDirPath,
      featurePatterns.stories,
      patternData,
      `${featureComponentName}.stories.tsx`,
      'filePatterns.features.stories'
    );

    const routeParts = normalizedRoute ? normalizedRoute.split('/').filter(Boolean) : [];
    const reorganizations = [];

    if (normalizedRoute && routeParts.length > 1 && config.routing.mode === 'flat') {
      const possibleExtensions = ['.astro', '.ts', '.js', '.md', '.mdx', '.html'];
      for (let i = 1; i < routeParts.length; i++) {
        const parentRoute = '/' + routeParts.slice(0, i).join('/');
        
        for (const ext of possibleExtensions) {
          const parentRouteFileName = routeToFilePath(parentRoute, {
            extension: ext,
            mode: 'flat'
          });
          const parentRouteFilePath = secureJoin(pagesRoot, parentRouteFileName);
          
          if (existsSync(parentRouteFilePath)) {
            const indexFile = ext === '.astro' ? config.routing.indexFile : `index${ext}`;
            const newParentRouteFileName = routeToFilePath(parentRoute, {
              extension: ext,
              mode: 'nested',
              indexFile: indexFile
            });
            const newParentRouteFilePath = secureJoin(pagesRoot, newParentRouteFileName);
            
            if (!existsSync(newParentRouteFilePath)) {
              reorganizations.push({
                from: parentRouteFilePath,
                to: newParentRouteFilePath,
                route: parentRoute
              });
            }
          }
        }
      }
    }

    if (options.dryRun) {
      console.log('Dry run - would create:');
      if (routeFilePath) console.log(`  Route: ${routeFilePath}`);
      console.log(`  Feature: ${featureFilePath}`);

      for (const reorg of reorganizations) {
        console.log(`  Reorganize: ${reorg.from} -> ${reorg.to}`);
      }
      
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

    if (reorganizations.length > 0) {
      const state = await loadState();
      for (const reorg of reorganizations) {
        await ensureDir(path.dirname(reorg.to));
        await rename(reorg.from, reorg.to);
        
        const oldRelative = path.relative(process.cwd(), reorg.from).replace(/\\/g, '/');
        const newRelative = path.relative(process.cwd(), reorg.to).replace(/\\/g, '/');
        
        if (state.files[oldRelative]) {
          state.files[newRelative] = { ...state.files[oldRelative] };
          delete state.files[oldRelative];
        }

        // Update imports in the moved file
        await updateImportsInFile(reorg.to, reorg.from, reorg.to);
        
        // Update hash in state after import updates
        if (state.files[newRelative]) {
          const content = await readFile(reorg.to, 'utf-8');
          state.files[newRelative].hash = calculateHash(content, config.hashing?.normalization);
        }
        
        console.log(`✓ Reorganized ${oldRelative} to ${newRelative}`);
      }
      await saveState(state);
    }

    if (routeFilePath) {
      if (existsSync(routeFilePath)) {
        const configSignatures = Object.values(config.signatures || {});
        const isGenerated = await isTextorGenerated(routeFilePath, configSignatures);
        if (!isGenerated && !options.force) {
          if (routeFilePath.endsWith('.astro')) {
            console.log(`⚠ File already exists and is not managed by Textor. Adopting and merging: ${routeFilePath}`);
          } else {
            throw new Error(`File already exists: ${routeFilePath}\nUse --force to overwrite.`);
          }
        }
      }
    }

    const featureExists = existsSync(featureFilePath);
    if (featureExists && !options.force) {
        console.log(`ℹ Feature already exists at ${featureFilePath}. Entering additive mode.`);
    }

    // Check sub-items only if not in force mode
    if (!options.force) {
        if (shouldCreateIndex && existsSync(indexFilePath)) console.log(`  - Skipping existing index: ${indexFilePath}`);
        if (shouldCreateContext && existsSync(contextFilePath)) console.log(`  - Skipping existing context: ${contextFilePath}`);
        if (shouldCreateHooks && existsSync(hookFilePath)) console.log(`  - Skipping existing hook: ${hookFilePath}`);
        if (shouldCreateTests && existsSync(testFilePath)) console.log(`  - Skipping existing test: ${testFilePath}`);
        if (shouldCreateTypes && existsSync(typesFilePath)) console.log(`  - Skipping existing types: ${typesFilePath}`);
        if (shouldCreateApi && existsSync(apiFilePath)) console.log(`  - Skipping existing api: ${apiFilePath}`);
        if (shouldCreateServices && existsSync(servicesFilePath)) console.log(`  - Skipping existing services: ${servicesFilePath}`);
        if (shouldCreateSchemas && existsSync(schemasFilePath)) console.log(`  - Skipping existing schemas: ${schemasFilePath}`);
        if (shouldCreateReadme && existsSync(readmeFilePath)) console.log(`  - Skipping existing readme: ${readmeFilePath}`);
        if (shouldCreateStories && existsSync(storiesFilePath)) console.log(`  - Skipping existing stories: ${storiesFilePath}`);
        if (shouldCreateScriptsDir && existsSync(scriptsIndexPath)) console.log(`  - Skipping existing scripts: ${scriptsIndexPath}`);
    }
    
    let layoutImportPath = null;
    const cliProps = options.prop || {};
    const rawLayoutProps = { ...configLayoutProps, ...cliProps };
    const layoutProps = {};
    
    // Resolve variables in layoutProps
    const substitutionData = enrichData({
        componentName: featureComponentName,
        layoutName: layout,
        featureComponentName: featureComponentName
    });

    for (const [key, value] of Object.entries(rawLayoutProps)) {
        if (typeof value === 'string') {
            let resolvedValue = value;
            for (const [varKey, varValue] of Object.entries(substitutionData)) {
                const regex = new RegExp(`{{${varKey}}}`, 'g');
                resolvedValue = resolvedValue.replace(regex, varValue);
                const underscoreRegex = new RegExp(`__${varKey}__`, 'g');
                resolvedValue = resolvedValue.replace(underscoreRegex, varValue);
            }
            layoutProps[key] = resolvedValue;
        } else {
            layoutProps[key] = value;
        }
    }

    if (routeFilePath && layout !== 'none') {
      if (config.importAliases.layouts) {
        layoutImportPath = `${config.importAliases.layouts}/${layout}.astro`;
      } else {
        const layoutFilePath = secureJoin(layoutsRoot, `${layout}.astro`);
        layoutImportPath = getRelativeImportPath(routeFilePath, layoutFilePath);
      }
    }

    let featureImportPath = null;
    if (routeFilePath) {
      if (config.importAliases.features) {
        const entryPart = effectiveOptions.entry === 'index' ? '/index' : `/${featureComponentName}`;
        // In Astro, we can often omit the extension for .tsx files, but not for .astro files if using aliases sometimes.
        // However, to be safe, we use the configured extension.
        featureImportPath = `${config.importAliases.features}/${normalizedFeaturePath}${entryPart}${config.naming.featureExtension}`;
      } else {
        const relativeFeatureFile = getRelativeImportPath(routeFilePath, featureFilePath);
        // Remove extension for import if it's not an .astro file
        if (config.naming.featureExtension === '.astro') {
          featureImportPath = relativeFeatureFile;
        } else {
          featureImportPath = relativeFeatureFile.replace(/\.[^/.]+$/, '');
        }
      }
    }
    
    let scriptImportPath;
    if (shouldCreateScriptsDir) {
      scriptImportPath = getRelativeImportPath(featureFilePath, scriptsIndexPath);
    }

    let routeContent;
    let routeSignature;
    
    if (routeFilePath) {
      if (options.endpoint) {
        routeContent = generateEndpointTemplate(featureComponentName);
        routeSignature = getSignature(config, 'typescript');
      } else {
        routeSignature = getSignature(config, 'astro');
        
        if (existsSync(routeFilePath)) {
          const existingContent = await readFile(routeFilePath, 'utf-8');
          // Strip existing signature if present
          let contentToMerge = existingContent;
          if (existingContent.startsWith(routeSignature)) {
            contentToMerge = existingContent.slice(routeSignature.length).trimStart();
          } else {
            // Check for generic signature if specific one doesn't match
            const genericSignature = '@generated by Textor';
            if (existingContent.includes(genericSignature)) {
              const lines = existingContent.split('\n');
              if (lines[0].includes(genericSignature)) {
                lines.shift();
                contentToMerge = lines.join('\n').trimStart();
              }
            }
          }
          
          routeContent = mergeRouteTemplate(
            contentToMerge,
            featureImportPath,
            featureComponentName,
            layout
          );
        } else {
          routeContent = generateRouteTemplate(
            layout,
            layoutImportPath,
            featureImportPath,
            featureComponentName,
            routeExtension,
            layoutProps
          );
        }
      }
    }
    
    const featureContent = generateFeatureTemplate(featureComponentName, scriptImportPath, framework, config.naming.featureExtension);
    
    const writtenFiles = [];

    if (routeFilePath) {
      const routeHash = await writeFileWithSignature(
        routeFilePath,
        routeContent,
        routeSignature,
        config.hashing?.normalization
      );
      await registerFile(routeFilePath, { 
        kind: 'route', 
        template: options.endpoint ? 'endpoint' : 'route', 
        hash: routeHash,
        owner: normalizedRoute 
      });
      writtenFiles.push(routeFilePath);
    }

    await ensureDir(featureDirPath);
    
    if (shouldCreateSubComponentsDir) await ensureDir(subComponentsDir);
    if (shouldCreateApi) await ensureDir(apiDirInside);
    if (shouldCreateServices) await ensureDir(servicesDirInside);
    if (shouldCreateSchemas) await ensureDir(schemasDirInside);
    if (shouldCreateHooks) await ensureDir(hooksDirInside);
    if (shouldCreateContext) await ensureDir(contextDirInside);
    if (shouldCreateTests) await ensureDir(testsDir);
    if (shouldCreateTypes) await ensureDir(typesDirInside);

    const featureSignature = getSignature(config, config.naming.featureExtension === '.astro' ? 'astro' : 'tsx');

    if (!featureExists || options.force) {
      const featureHash = await writeFileWithSignature(
        featureFilePath,
        featureContent,
        featureSignature,
        config.hashing?.normalization
      );
      await registerFile(featureFilePath, { 
        kind: 'feature', 
        template: 'feature', 
        hash: featureHash,
        owner: normalizedRoute 
      });
      writtenFiles.push(featureFilePath);
    }

    if (shouldCreateScriptsDir && (!existsSync(scriptsIndexPath) || options.force)) {
      const hash = await writeFileWithSignature(
        scriptsIndexPath,
        generateScriptsIndexTemplate(),
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(scriptsIndexPath, { 
        kind: 'feature-file', 
        template: 'scripts-index', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(scriptsIndexPath);
    }

    if (shouldCreateIndex && (!existsSync(indexFilePath) || options.force)) {
      const indexContent = generateIndexTemplate(featureComponentName, config.naming.featureExtension);
      const hash = await writeFileWithSignature(
        indexFilePath,
        indexContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(indexFilePath, { 
        kind: 'feature-file', 
        template: 'index', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(indexFilePath);
    }

    if (shouldCreateApi && (!existsSync(apiFilePath) || options.force)) {
      const apiContent = generateApiTemplate(featureComponentName);
      const hash = await writeFileWithSignature(
        apiFilePath, 
        apiContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(apiFilePath, { 
        kind: 'feature-file', 
        template: 'api', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(apiFilePath);
    }

    if (shouldCreateServices && (!existsSync(servicesFilePath) || options.force)) {
      const servicesContent = generateServiceTemplate(featureComponentName);
      const hash = await writeFileWithSignature(
        servicesFilePath, 
        servicesContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(servicesFilePath, { 
        kind: 'feature-file', 
        template: 'service', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(servicesFilePath);
    }

    if (shouldCreateSchemas && (!existsSync(schemasFilePath) || options.force)) {
      const schemasContent = generateSchemaTemplate(featureComponentName);
      const hash = await writeFileWithSignature(
        schemasFilePath, 
        schemasContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(schemasFilePath, { 
        kind: 'feature-file', 
        template: 'schema', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(schemasFilePath);
    }

    if (shouldCreateHooks && (!existsSync(hookFilePath) || options.force)) {
      const hookName = getHookFunctionName(featureComponentName);
      const hookContent = generateHookTemplate(featureComponentName, hookName);
      const hash = await writeFileWithSignature(
        hookFilePath, 
        hookContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(hookFilePath, { 
        kind: 'feature-file', 
        template: 'hook', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(hookFilePath);
    }

    if (shouldCreateContext && (!existsSync(contextFilePath) || options.force)) {
      const contextContent = generateContextTemplate(featureComponentName);
      const hash = await writeFileWithSignature(
        contextFilePath, 
        contextContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(contextFilePath, { 
        kind: 'feature-file', 
        template: 'context', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(contextFilePath);
    }

    if (shouldCreateTests && (!existsSync(testFilePath) || options.force)) {
      const relativeFeaturePath = `./${path.basename(featureFilePath)}`;
      const testContent = generateTestTemplate(featureComponentName, relativeFeaturePath);
      const hash = await writeFileWithSignature(
        testFilePath, 
        testContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(testFilePath, { 
        kind: 'feature-file', 
        template: 'test', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(testFilePath);
    }

    if (shouldCreateTypes && (!existsSync(typesFilePath) || options.force)) {
      const typesContent = generateTypesTemplate(featureComponentName);
      const hash = await writeFileWithSignature(
        typesFilePath, 
        typesContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(typesFilePath, { 
        kind: 'feature-file', 
        template: 'types', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(typesFilePath);
    }

    if (shouldCreateReadme && (!existsSync(readmeFilePath) || options.force)) {
      const readmeContent = generateReadmeTemplate(featureComponentName);
      const hash = await writeFileWithSignature(
        readmeFilePath, 
        readmeContent, 
        getSignature(config, 'astro'),
        config.hashing?.normalization
      );
      await registerFile(readmeFilePath, { 
        kind: 'feature-file', 
        template: 'readme', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(readmeFilePath);
    }

    if (shouldCreateStories && (!existsSync(storiesFilePath) || options.force)) {
      const relativePath = `./${path.basename(featureFilePath)}`;
      const storiesContent = generateStoriesTemplate(featureComponentName, relativePath);
      const hash = await writeFileWithSignature(
        storiesFilePath, 
        storiesContent, 
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(storiesFilePath, { 
        kind: 'feature-file', 
        template: 'stories', 
        hash,
        owner: normalizedRoute 
      });
      writtenFiles.push(storiesFilePath);
    }
    
    // Formatting
    if (config.formatting.tool !== 'none') {
        await formatFiles(writtenFiles, config.formatting.tool);
    }

    console.log('✓ Section created successfully:');
    if (routeFilePath) console.log(`  Route: ${routeFilePath}`);
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
      layout: layout,
      extension: routeExtension
    });

    if (config.git?.stageChanges) {
      await stageFiles(writtenFiles);
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

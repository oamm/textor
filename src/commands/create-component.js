import path from 'path';
import { existsSync } from 'fs';
import { loadConfig, resolvePath, getEffectiveOptions } from '../utils/config.js';
import { 
  normalizeComponentName,
  getHookFileName,
  getHookFunctionName 
} from '../utils/naming.js';
import { 
  ensureNotExists, 
  writeFileWithSignature,
  getSignature,
  ensureDir,
  secureJoin,
  formatFiles 
} from '../utils/filesystem.js';
import { resolvePatternedPath } from '../utils/patterns.js';
import {
  generateComponentTemplate,
  generateHookTemplate,
  generateContextTemplate,
  generateTestTemplate,
  generateConfigTemplate,
  generateConstantsTemplate,
  generateIndexTemplate,
  generateTypesTemplate,
  generateApiTemplate,
  generateServiceTemplate,
  generateSchemaTemplate,
  generateReadmeTemplate,
  generateStoriesTemplate
} from '../utils/templates.js';
import { addComponentToState, registerFile } from '../utils/state.js';
import { stageFiles } from '../utils/git.js';

export async function createComponentCommand(componentName, options) {
  try {
    const config = await loadConfig();
    const effectiveOptions = getEffectiveOptions(options, config, 'components');
    
    const normalizedName = normalizeComponentName(componentName);
    
    const componentsRoot = resolvePath(config, 'components');
    
    const componentDir = secureJoin(componentsRoot, normalizedName);
    const subComponentsDir = secureJoin(componentDir, 'sub-components');
    const testsDir = secureJoin(componentDir, '__tests__');
    const configDirInside = secureJoin(componentDir, 'config');
    const constantsDirInside = secureJoin(componentDir, 'constants');
    const contextDirInside = secureJoin(componentDir, 'context');
    const hooksDirInside = secureJoin(componentDir, 'hooks');
    const typesDirInside = secureJoin(componentDir, 'types');
    const apiDirInside = secureJoin(componentDir, 'api');
    const servicesDirInside = secureJoin(componentDir, 'services');
    const schemasDirInside = secureJoin(componentDir, 'schemas');
    
    const {
      framework,
      createContext: shouldCreateContext,
      createHook: shouldCreateHook,
      createTests: shouldCreateTests,
      createConfig: shouldCreateConfig,
      createConstants: shouldCreateConstants,
      createTypes: shouldCreateTypes,
      createSubComponentsDir: shouldCreateSubComponentsDir,
      createApi: shouldCreateApi,
      createServices: shouldCreateServices,
      createSchemas: shouldCreateSchemas,
      createReadme: shouldCreateReadme,
      createStories: shouldCreateStories
    } = effectiveOptions;

    const componentPatterns = config.filePatterns?.components || {};
    const patternData = {
      componentName: normalizedName,
      hookName: getHookFunctionName(normalizedName),
      hookExtension: config.naming.hookExtension,
      testExtension: config.naming.testExtension,
      componentExtension: config.naming.componentExtension,
      featureExtension: config.naming.featureExtension
    };
    
    const componentFilePath = path.join(componentDir, `${normalizedName}${config.naming.componentExtension}`);
    const indexFilePath = resolvePatternedPath(
      componentDir,
      componentPatterns.index,
      patternData,
      'index.ts',
      'filePatterns.components.index'
    );
    const contextFilePath = resolvePatternedPath(
      contextDirInside,
      componentPatterns.context,
      patternData,
      `${normalizedName}Context.tsx`,
      'filePatterns.components.context'
    );
    const hookFilePath = resolvePatternedPath(
      hooksDirInside,
      componentPatterns.hook,
      patternData,
      getHookFileName(normalizedName, config.naming.hookExtension),
      'filePatterns.components.hook'
    );
    const testFilePath = resolvePatternedPath(
      testsDir,
      componentPatterns.test,
      patternData,
      `${normalizedName}${config.naming.testExtension}`,
      'filePatterns.components.test'
    );
    const configFilePath = resolvePatternedPath(
      configDirInside,
      componentPatterns.config,
      patternData,
      'index.ts',
      'filePatterns.components.config'
    );
    const constantsFilePath = resolvePatternedPath(
      constantsDirInside,
      componentPatterns.constants,
      patternData,
      'index.ts',
      'filePatterns.components.constants'
    );
    const typesFilePath = resolvePatternedPath(
      typesDirInside,
      componentPatterns.types,
      patternData,
      'index.ts',
      'filePatterns.components.types'
    );
    const apiFilePath = resolvePatternedPath(
      apiDirInside,
      componentPatterns.api,
      patternData,
      'index.ts',
      'filePatterns.components.api'
    );
    const servicesFilePath = resolvePatternedPath(
      servicesDirInside,
      componentPatterns.services,
      patternData,
      'index.ts',
      'filePatterns.components.services'
    );
    const schemasFilePath = resolvePatternedPath(
      schemasDirInside,
      componentPatterns.schemas,
      patternData,
      'index.ts',
      'filePatterns.components.schemas'
    );
    const readmeFilePath = resolvePatternedPath(
      componentDir,
      componentPatterns.readme,
      patternData,
      'README.md',
      'filePatterns.components.readme'
    );
    const storiesFilePath = resolvePatternedPath(
      componentDir,
      componentPatterns.stories,
      patternData,
      `${normalizedName}.stories.tsx`,
      'filePatterns.components.stories'
    );
    
    if (options.dryRun) {
      console.log('Dry run - would create:');
      console.log(`  Component: ${componentFilePath}`);
      console.log(`  Index: ${indexFilePath}`);
      
      if (shouldCreateContext) console.log(`  Context: ${contextFilePath}`);
      if (shouldCreateHook) console.log(`  Hook: ${hookFilePath}`);
      if (shouldCreateTests) console.log(`  Tests: ${testFilePath}`);
      if (shouldCreateConfig) console.log(`  Config: ${configFilePath}`);
      if (shouldCreateConstants) console.log(`  Constants: ${constantsFilePath}`);
      if (shouldCreateTypes) console.log(`  Types: ${typesFilePath}`);
      if (shouldCreateApi) console.log(`  Api: ${apiFilePath}`);
      if (shouldCreateServices) console.log(`  Services: ${servicesFilePath}`);
      if (shouldCreateSchemas) console.log(`  Schemas: ${schemasFilePath}`);
      if (shouldCreateReadme) console.log(`  Readme: ${readmeFilePath}`);
      if (shouldCreateStories) console.log(`  Stories: ${storiesFilePath}`);
      if (shouldCreateSubComponentsDir) console.log(`  Sub-components: ${subComponentsDir}/`);
      
      return;
    }
    
    const componentExists = existsSync(componentFilePath);
    if (componentExists && !options.force) {
        console.log(`ℹ Component already exists at ${componentFilePath}. Entering additive mode.`);
    }

    // Check sub-items only if not in force mode
    if (!options.force) {
        if (existsSync(indexFilePath)) console.log(`  - Skipping existing index: ${indexFilePath}`);
        if (shouldCreateContext && existsSync(contextFilePath)) console.log(`  - Skipping existing context: ${contextFilePath}`);
        if (shouldCreateHook && existsSync(hookFilePath)) console.log(`  - Skipping existing hook: ${hookFilePath}`);
        if (shouldCreateTests && existsSync(testFilePath)) console.log(`  - Skipping existing test: ${testFilePath}`);
        if (shouldCreateConfig && existsSync(configFilePath)) console.log(`  - Skipping existing config: ${configFilePath}`);
        if (shouldCreateConstants && existsSync(constantsFilePath)) console.log(`  - Skipping existing constants: ${constantsFilePath}`);
        if (shouldCreateTypes && existsSync(typesFilePath)) console.log(`  - Skipping existing types: ${typesFilePath}`);
        if (shouldCreateApi && existsSync(apiFilePath)) console.log(`  - Skipping existing api: ${apiFilePath}`);
        if (shouldCreateServices && existsSync(servicesFilePath)) console.log(`  - Skipping existing services: ${servicesFilePath}`);
        if (shouldCreateSchemas && existsSync(schemasFilePath)) console.log(`  - Skipping existing schemas: ${schemasFilePath}`);
        if (shouldCreateReadme && existsSync(readmeFilePath)) console.log(`  - Skipping existing readme: ${readmeFilePath}`);
        if (shouldCreateStories && existsSync(storiesFilePath)) console.log(`  - Skipping existing stories: ${storiesFilePath}`);
    }
    
    await ensureDir(componentDir);
    
    if (shouldCreateSubComponentsDir) await ensureDir(subComponentsDir);
    if (shouldCreateContext) await ensureDir(contextDirInside);
    if (shouldCreateHook) await ensureDir(hooksDirInside);
    if (shouldCreateTests) await ensureDir(testsDir);
    if (shouldCreateConfig) await ensureDir(configDirInside);
    if (shouldCreateConstants) await ensureDir(constantsDirInside);
    if (shouldCreateTypes) await ensureDir(typesDirInside);
    if (shouldCreateApi) await ensureDir(apiDirInside);
    if (shouldCreateServices) await ensureDir(servicesDirInside);
    if (shouldCreateSchemas) await ensureDir(schemasDirInside);
    
    const componentContent = generateComponentTemplate(normalizedName, framework, config.naming.componentExtension);
    const signature = getSignature(config, config.naming.componentExtension === '.astro' ? 'astro' : 'tsx');

    const writtenFiles = [];

    if (!componentExists || options.force) {
      const componentHash = await writeFileWithSignature(
        componentFilePath,
        componentContent,
        signature,
        config.hashing?.normalization
      );
      await registerFile(componentFilePath, { 
        kind: 'component', 
        template: 'component', 
        hash: componentHash,
        owner: normalizedName 
      });
      writtenFiles.push(componentFilePath);
    }
    
    if (!existsSync(indexFilePath) || options.force) {
      const indexContent = generateIndexTemplate(normalizedName, config.naming.componentExtension);
      const indexHash = await writeFileWithSignature(
        indexFilePath,
        indexContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(indexFilePath, { 
        kind: 'component-file', 
        template: 'index', 
        hash: indexHash,
        owner: normalizedName 
      });
      writtenFiles.push(indexFilePath);
    }
    
    if (shouldCreateTypes && (!existsSync(typesFilePath) || options.force)) {
      const typesContent = generateTypesTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        typesFilePath,
        typesContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(typesFilePath, { 
        kind: 'component-file', 
        template: 'types', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(typesFilePath);
    }
    
    if (shouldCreateContext && (!existsSync(contextFilePath) || options.force)) {
      const contextContent = generateContextTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        contextFilePath,
        contextContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(contextFilePath, { 
        kind: 'component-file', 
        template: 'context', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(contextFilePath);
    }
    
    if (shouldCreateHook && (!existsSync(hookFilePath) || options.force)) {
      const hookName = getHookFunctionName(normalizedName);
      const hookContent = generateHookTemplate(normalizedName, hookName);
      const hash = await writeFileWithSignature(
        hookFilePath,
        hookContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(hookFilePath, { 
        kind: 'component-file', 
        template: 'hook', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(hookFilePath);
    }
    
    if (shouldCreateTests && (!existsSync(testFilePath) || options.force)) {
      const relativeComponentPath = `../${normalizedName}${config.naming.componentExtension}`;
      const testContent = generateTestTemplate(normalizedName, relativeComponentPath);
      const hash = await writeFileWithSignature(
        testFilePath,
        testContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(testFilePath, { 
        kind: 'component-file', 
        template: 'test', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(testFilePath);
    }
    
    if (shouldCreateConfig && (!existsSync(configFilePath) || options.force)) {
      const configContent = generateConfigTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        configFilePath,
        configContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(configFilePath, { 
        kind: 'component-file', 
        template: 'config', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(configFilePath);
    }
    
    if (shouldCreateConstants && (!existsSync(constantsFilePath) || options.force)) {
      const constantsContent = generateConstantsTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        constantsFilePath,
        constantsContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(constantsFilePath, { 
        kind: 'component-file', 
        template: 'constants', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(constantsFilePath);
    }

    if (shouldCreateApi && (!existsSync(apiFilePath) || options.force)) {
      const apiContent = generateApiTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        apiFilePath,
        apiContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(apiFilePath, { 
        kind: 'component-file', 
        template: 'api', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(apiFilePath);
    }

    if (shouldCreateServices && (!existsSync(servicesFilePath) || options.force)) {
      const servicesContent = generateServiceTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        servicesFilePath,
        servicesContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(servicesFilePath, { 
        kind: 'component-file', 
        template: 'service', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(servicesFilePath);
    }

    if (shouldCreateSchemas && (!existsSync(schemasFilePath) || options.force)) {
      const schemasContent = generateSchemaTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        schemasFilePath,
        schemasContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(schemasFilePath, { 
        kind: 'component-file', 
        template: 'schema', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(schemasFilePath);
    }

    if (shouldCreateReadme && (!existsSync(readmeFilePath) || options.force)) {
      const readmeContent = generateReadmeTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        readmeFilePath,
        readmeContent,
        getSignature(config, 'astro'),
        config.hashing?.normalization
      );
      await registerFile(readmeFilePath, { 
        kind: 'component-file', 
        template: 'readme', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(readmeFilePath);
    }

    if (shouldCreateStories && (!existsSync(storiesFilePath) || options.force)) {
      const relativePath = `./${normalizedName}${config.naming.componentExtension}`;
      const storiesContent = generateStoriesTemplate(normalizedName, relativePath);
      const hash = await writeFileWithSignature(
        storiesFilePath,
        storiesContent,
        getSignature(config, 'typescript'),
        config.hashing?.normalization
      );
      await registerFile(storiesFilePath, { 
        kind: 'component-file', 
        template: 'stories', 
        hash,
        owner: normalizedName 
      });
      writtenFiles.push(storiesFilePath);
    }
    
    // Formatting
    if (config.formatting.tool !== 'none') {
        await formatFiles(writtenFiles, config.formatting.tool);
    }
    
    console.log('✓ Component created successfully:');
    console.log(`  Component: ${componentFilePath}`);
    console.log(`  Index: ${indexFilePath}`);
    
    if (shouldCreateContext) console.log(`  Context: ${contextFilePath}`);
    if (shouldCreateHook) console.log(`  Hook: ${hookFilePath}`);
    if (shouldCreateTests) console.log(`  Tests: ${testFilePath}`);
    if (shouldCreateConfig) console.log(`  Config: ${configFilePath}`);
    if (shouldCreateConstants) console.log(`  Constants: ${constantsFilePath}`);
    if (shouldCreateTypes) console.log(`  Types: ${typesFilePath}`);
    if (shouldCreateApi) console.log(`  Api: ${apiFilePath}`);
    if (shouldCreateServices) console.log(`  Services: ${servicesFilePath}`);
    if (shouldCreateSchemas) console.log(`  Schemas: ${schemasFilePath}`);
    if (shouldCreateReadme) console.log(`  Readme: ${readmeFilePath}`);
    if (shouldCreateStories) console.log(`  Stories: ${storiesFilePath}`);
    if (shouldCreateSubComponentsDir) console.log(`  Sub-components: ${subComponentsDir}/`);
    
    await addComponentToState({
      name: normalizedName,
      path: componentDir
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

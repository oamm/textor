import path from 'path';
import { loadConfig, resolvePath, getEffectiveOptions } from '../utils/config.js';
import { 
  normalizeComponentName,
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
    
    const componentFilePath = path.join(componentDir, `${normalizedName}${config.naming.componentExtension}`);
    const indexFilePath = path.join(componentDir, 'index.ts');
    const contextFilePath = path.join(contextDirInside, `${normalizedName}Context.tsx`);
    const hookFilePath = path.join(hooksDirInside, getHookFileName(normalizedName, config.naming.hookExtension));
    const testFilePath = path.join(testsDir, `${normalizedName}${config.naming.testExtension}`);
    const configFilePath = path.join(configDirInside, 'index.ts');
    const constantsFilePath = path.join(constantsDirInside, 'index.ts');
    const typesFilePath = path.join(typesDirInside, 'index.ts');
    const apiFilePath = path.join(apiDirInside, 'index.ts');
    const servicesFilePath = path.join(servicesDirInside, 'index.ts');
    const schemasFilePath = path.join(schemasDirInside, 'index.ts');
    const readmeFilePath = path.join(componentDir, 'README.md');
    const storiesFilePath = path.join(componentDir, `${normalizedName}.stories.tsx`);
    
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
    
    await ensureNotExists(componentFilePath, options.force);
    await ensureNotExists(indexFilePath, options.force);
    
    if (shouldCreateContext) await ensureNotExists(contextFilePath, options.force);
    if (shouldCreateHook) await ensureNotExists(hookFilePath, options.force);
    if (shouldCreateTests) await ensureNotExists(testFilePath, options.force);
    if (shouldCreateConfig) await ensureNotExists(configFilePath, options.force);
    if (shouldCreateConstants) await ensureNotExists(constantsFilePath, options.force);
    if (shouldCreateTypes) await ensureNotExists(typesFilePath, options.force);
    if (shouldCreateApi) await ensureNotExists(apiFilePath, options.force);
    if (shouldCreateServices) await ensureNotExists(servicesFilePath, options.force);
    if (shouldCreateSchemas) await ensureNotExists(schemasFilePath, options.force);
    if (shouldCreateReadme) await ensureNotExists(readmeFilePath, options.force);
    if (shouldCreateStories) await ensureNotExists(storiesFilePath, options.force);
    
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
    
    const componentContent = generateComponentTemplate(normalizedName);
    const componentHash = await writeFileWithSignature(
      componentFilePath,
      componentContent,
      config.signatures.astro
    );
    await registerFile(componentFilePath, { kind: 'component', template: 'component', hash: componentHash });
    
    const writtenFiles = [componentFilePath];

    const indexContent = generateIndexTemplate(normalizedName, config.naming.componentExtension);
    const indexHash = await writeFileWithSignature(
      indexFilePath,
      indexContent,
      config.signatures.typescript
    );
    await registerFile(indexFilePath, { kind: 'component-file', template: 'index', hash: indexHash });
    writtenFiles.push(indexFilePath);
    
    if (shouldCreateTypes) {
      const typesContent = generateTypesTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        typesFilePath,
        typesContent,
        config.signatures.typescript
      );
      await registerFile(typesFilePath, { kind: 'component-file', template: 'types', hash });
      writtenFiles.push(typesFilePath);
    }
    
    if (shouldCreateContext) {
      const contextContent = generateContextTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        contextFilePath,
        contextContent,
        config.signatures.typescript
      );
      await registerFile(contextFilePath, { kind: 'component-file', template: 'context', hash });
      writtenFiles.push(contextFilePath);
    }
    
    if (shouldCreateHook) {
      const hookName = getHookFunctionName(normalizedName);
      const hookContent = generateHookTemplate(normalizedName, hookName);
      const hash = await writeFileWithSignature(
        hookFilePath,
        hookContent,
        config.signatures.typescript
      );
      await registerFile(hookFilePath, { kind: 'component-file', template: 'hook', hash });
      writtenFiles.push(hookFilePath);
    }
    
    if (shouldCreateTests) {
      const relativeComponentPath = `../${normalizedName}${config.naming.componentExtension}`;
      const testContent = generateTestTemplate(normalizedName, relativeComponentPath);
      const hash = await writeFileWithSignature(
        testFilePath,
        testContent,
        config.signatures.typescript
      );
      await registerFile(testFilePath, { kind: 'component-file', template: 'test', hash });
      writtenFiles.push(testFilePath);
    }
    
    if (shouldCreateConfig) {
      const configContent = generateConfigTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        configFilePath,
        configContent,
        config.signatures.typescript
      );
      await registerFile(configFilePath, { kind: 'component-file', template: 'config', hash });
      writtenFiles.push(configFilePath);
    }
    
    if (shouldCreateConstants) {
      const constantsContent = generateConstantsTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        constantsFilePath,
        constantsContent,
        config.signatures.typescript
      );
      await registerFile(constantsFilePath, { kind: 'component-file', template: 'constants', hash });
      writtenFiles.push(constantsFilePath);
    }

    if (shouldCreateApi) {
      const apiContent = generateApiTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        apiFilePath,
        apiContent,
        config.signatures.typescript
      );
      await registerFile(apiFilePath, { kind: 'component-file', template: 'api', hash });
      writtenFiles.push(apiFilePath);
    }

    if (shouldCreateServices) {
      const servicesContent = generateServiceTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        servicesFilePath,
        servicesContent,
        config.signatures.typescript
      );
      await registerFile(servicesFilePath, { kind: 'component-file', template: 'service', hash });
      writtenFiles.push(servicesFilePath);
    }

    if (shouldCreateSchemas) {
      const schemasContent = generateSchemaTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        schemasFilePath,
        schemasContent,
        config.signatures.typescript
      );
      await registerFile(schemasFilePath, { kind: 'component-file', template: 'schema', hash });
      writtenFiles.push(schemasFilePath);
    }

    if (shouldCreateReadme) {
      const readmeContent = generateReadmeTemplate(normalizedName);
      const hash = await writeFileWithSignature(
        readmeFilePath,
        readmeContent,
        config.signatures.astro
      );
      await registerFile(readmeFilePath, { kind: 'component-file', template: 'readme', hash });
      writtenFiles.push(readmeFilePath);
    }

    if (shouldCreateStories) {
      const relativePath = `./${normalizedName}${config.naming.componentExtension}`;
      const storiesContent = generateStoriesTemplate(normalizedName, relativePath);
      const hash = await writeFileWithSignature(
        storiesFilePath,
        storiesContent,
        config.signatures.typescript
      );
      await registerFile(storiesFilePath, { kind: 'component-file', template: 'stories', hash });
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
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

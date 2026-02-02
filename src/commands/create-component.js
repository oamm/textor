import path from 'path';
import { loadConfig, resolvePath } from '../utils/config.js';
import { 
  normalizeComponentName,
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
import { addComponentToState } from '../utils/state.js';

export async function createComponentCommand(componentName, options) {
  try {
    const config = await loadConfig();
    
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
    
    const createdFiles = [];
    
    const shouldCreateContext = options.context !== undefined ? options.context : config.components.createContext;
    const shouldCreateHook = options.hook !== undefined ? options.hook : config.components.createHook;
    const shouldCreateTests = options.tests !== undefined ? options.tests : config.components.createTests;
    const shouldCreateConfig = options.config !== undefined ? options.config : config.components.createConfig;
    const shouldCreateConstants = options.constants !== undefined ? options.constants : config.components.createConstants;
    const shouldCreateTypes = options.types !== undefined ? options.types : config.components.createTypes;
    const shouldCreateSubComponentsDir = options.subComponentsDir !== undefined ? options.subComponentsDir : config.components.createSubComponentsDir;
    const shouldCreateApi = options.api !== undefined ? options.api : config.components.createApi;
    const shouldCreateServices = options.services !== undefined ? options.services : config.components.createServices;
    const shouldCreateSchemas = options.schemas !== undefined ? options.schemas : config.components.createSchemas;
    const shouldCreateReadme = options.readme !== undefined ? options.readme : config.components.createReadme;
    const shouldCreateStories = options.stories !== undefined ? options.stories : config.components.createStories;
    
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
    await writeFileWithSignature(
      componentFilePath,
      componentContent,
      config.signatures.astro
    );
    createdFiles.push(componentFilePath);

    const indexContent = generateIndexTemplate(normalizedName, config.naming.componentExtension);
    await writeFileWithSignature(
      indexFilePath,
      indexContent,
      config.signatures.typescript
    );
    createdFiles.push(indexFilePath);
    
    if (shouldCreateTypes) {
      const typesContent = generateTypesTemplate(normalizedName);
      await writeFileWithSignature(
        typesFilePath,
        typesContent,
        config.signatures.typescript
      );
      createdFiles.push(typesFilePath);
    }
    
    if (shouldCreateContext) {
      const contextContent = generateContextTemplate(normalizedName);
      await writeFileWithSignature(
        contextFilePath,
        contextContent,
        config.signatures.typescript
      );
      createdFiles.push(contextFilePath);
    }
    
    if (shouldCreateHook) {
      const hookName = getHookFunctionName(normalizedName);
      const hookContent = generateHookTemplate(normalizedName, hookName);
      await writeFileWithSignature(
        hookFilePath,
        hookContent,
        config.signatures.typescript
      );
      createdFiles.push(hookFilePath);
    }
    
    if (shouldCreateTests) {
      const relativeComponentPath = `../${normalizedName}${config.naming.componentExtension}`;
      const testContent = generateTestTemplate(normalizedName, relativeComponentPath);
      await writeFileWithSignature(
        testFilePath,
        testContent,
        config.signatures.typescript
      );
      createdFiles.push(testFilePath);
    }
    
    if (shouldCreateConfig) {
      const configContent = generateConfigTemplate(normalizedName);
      await writeFileWithSignature(
        configFilePath,
        configContent,
        config.signatures.typescript
      );
      createdFiles.push(configFilePath);
    }
    
    if (shouldCreateConstants) {
      const constantsContent = generateConstantsTemplate(normalizedName);
      await writeFileWithSignature(
        constantsFilePath,
        constantsContent,
        config.signatures.typescript
      );
      createdFiles.push(constantsFilePath);
    }

    if (shouldCreateApi) {
      const apiContent = generateApiTemplate(normalizedName);
      await writeFileWithSignature(
        apiFilePath,
        apiContent,
        config.signatures.typescript
      );
      createdFiles.push(apiFilePath);
    }

    if (shouldCreateServices) {
      const servicesContent = generateServiceTemplate(normalizedName);
      await writeFileWithSignature(
        servicesFilePath,
        servicesContent,
        config.signatures.typescript
      );
      createdFiles.push(servicesFilePath);
    }

    if (shouldCreateSchemas) {
      const schemasContent = generateSchemaTemplate(normalizedName);
      await writeFileWithSignature(
        schemasFilePath,
        schemasContent,
        config.signatures.typescript
      );
      createdFiles.push(schemasFilePath);
    }

    if (shouldCreateReadme) {
      const readmeContent = generateReadmeTemplate(normalizedName);
      await writeFileWithSignature(
        readmeFilePath,
        readmeContent,
        config.signatures.astro
      );
      createdFiles.push(readmeFilePath);
    }

    if (shouldCreateStories) {
      const relativePath = `./${normalizedName}${config.naming.componentExtension}`;
      const storiesContent = generateStoriesTemplate(normalizedName, relativePath);
      await writeFileWithSignature(
        storiesFilePath,
        storiesContent,
        config.signatures.typescript
      );
      createdFiles.push(storiesFilePath);
    }
    
    console.log('✓ Component created successfully:');
    createdFiles.forEach(file => console.log(`  ${file}`));
    
    if (shouldCreateSubComponentsDir) {
      console.log(`  Sub-components: ${subComponentsDir}/`);
    }
    
    await addComponentToState({
      name: normalizedName,
      path: componentDir
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

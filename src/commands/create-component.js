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
  generateTypesTemplate
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
    
    const createdFiles = [];
    
    const shouldCreateContext = options.context !== false && config.components.createContext;
    const shouldCreateHook = options.hook !== false && config.components.createHook;
    const shouldCreateTests = options.tests !== false && config.components.createTests;
    const shouldCreateConfig = options.config !== false && config.components.createConfig;
    const shouldCreateConstants = options.constants !== false && config.components.createConstants;
    const shouldCreateTypes = config.components.createTypes;
    const shouldCreateSubComponentsDir = options.subComponentsDir !== false && config.components.createSubComponentsDir;
    
    const componentFilePath = path.join(componentDir, `${normalizedName}${config.naming.componentExtension}`);
    const indexFilePath = path.join(componentDir, 'index.ts');
    const contextFilePath = path.join(contextDirInside, `${normalizedName}Context.tsx`);
    const hookFilePath = path.join(hooksDirInside, getHookFileName(normalizedName, config.naming.hookExtension));
    const testFilePath = path.join(testsDir, `${normalizedName}${config.naming.testExtension}`);
    const configFilePath = path.join(configDirInside, 'index.ts');
    const constantsFilePath = path.join(constantsDirInside, 'index.ts');
    const typesFilePath = path.join(typesDirInside, 'index.ts');
    
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
    
    await ensureDir(componentDir);
    
    if (shouldCreateSubComponentsDir) await ensureDir(subComponentsDir);
    if (shouldCreateContext) await ensureDir(contextDirInside);
    if (shouldCreateHook) await ensureDir(hooksDirInside);
    if (shouldCreateTests) await ensureDir(testsDir);
    if (shouldCreateConfig) await ensureDir(configDirInside);
    if (shouldCreateConstants) await ensureDir(constantsDirInside);
    if (shouldCreateTypes) await ensureDir(typesDirInside);
    
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

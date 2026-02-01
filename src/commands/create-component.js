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
  ensureDir 
} from '../utils/filesystem.js';
import {
  generateComponentTemplate,
  generateHookTemplate,
  generateContextTemplate,
  generateTestTemplate,
  generateConfigTemplate,
  generateConstantsTemplate
} from '../utils/templates.js';

export async function createComponentCommand(componentName, options) {
  try {
    const config = await loadConfig();
    
    const normalizedName = normalizeComponentName(componentName);
    
    const componentsRoot = resolvePath(config, 'components');
    
    let componentDir;
    if (options.componentsDir === false || !config.components.createComponentsDir) {
      componentDir = path.join(componentsRoot, normalizedName);
    } else {
      componentDir = path.join(componentsRoot, normalizedName, 'Components');
    }
    
    const createdFiles = [];
    
    const shouldCreateContext = options.context !== false && config.components.createContext;
    const shouldCreateHook = options.hook !== false && config.components.createHook;
    const shouldCreateTests = options.tests !== false && config.components.createTests;
    const shouldCreateConfig = options.config !== false && config.components.createConfig;
    const shouldCreateConstants = options.constants !== false && config.components.createConstants;
    
    const componentFilePath = path.join(componentDir, `${normalizedName}${config.naming.componentExtension}`);
    const contextFilePath = path.join(componentDir, `${normalizedName}Context.tsx`);
    const hookFilePath = path.join(componentDir, getHookFileName(normalizedName, config.naming.hookExtension));
    const testFilePath = path.join(componentDir, `${normalizedName}${config.naming.testExtension}`);
    const configFilePath = path.join(componentDir, `${normalizedName}Config.ts`);
    const constantsFilePath = path.join(componentDir, `${normalizedName}Constants.ts`);
    
    if (options.dryRun) {
      console.log('Dry run - would create:');
      console.log(`  Component: ${componentFilePath}`);
      
      if (shouldCreateContext) console.log(`  Context: ${contextFilePath}`);
      if (shouldCreateHook) console.log(`  Hook: ${hookFilePath}`);
      if (shouldCreateTests) console.log(`  Tests: ${testFilePath}`);
      if (shouldCreateConfig) console.log(`  Config: ${configFilePath}`);
      if (shouldCreateConstants) console.log(`  Constants: ${constantsFilePath}`);
      
      return;
    }
    
    await ensureNotExists(componentFilePath, options.force);
    
    if (shouldCreateContext) await ensureNotExists(contextFilePath, options.force);
    if (shouldCreateHook) await ensureNotExists(hookFilePath, options.force);
    if (shouldCreateTests) await ensureNotExists(testFilePath, options.force);
    if (shouldCreateConfig) await ensureNotExists(configFilePath, options.force);
    if (shouldCreateConstants) await ensureNotExists(constantsFilePath, options.force);
    
    await ensureDir(componentDir);
    
    const componentContent = generateComponentTemplate(normalizedName);
    await writeFileWithSignature(
      componentFilePath,
      componentContent,
      config.signatures.astro
    );
    createdFiles.push(componentFilePath);
    
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
      const relativeComponentPath = `./${normalizedName}${config.naming.componentExtension}`;
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
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

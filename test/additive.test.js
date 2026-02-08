import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { createComponentCommand } from '../src/commands/create-component.js';
import { addItemCommand } from '../src/commands/add-item.js';
import { saveState } from '../src/utils/state.js';

const TEST_DIR = path.join(process.cwd(), 'temp-additive-test');

describe('Additive Scaffolding', () => {
  const originalCwd = process.cwd;

  beforeEach(async () => {
    process.cwd = () => TEST_DIR;
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_DIR, { recursive: true });
    await initCommand({ force: true });
    await saveState({ sections: [], components: [], files: {} });
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('add-section should support additive updates for features', async () => {
    await addSectionCommand('/test', 'test-feat', {});
    const featureFile = path.join(TEST_DIR, 'src/features/test-feat/TestFeat.astro');
    expect(existsSync(featureFile)).toBe(true);
    const initialContent = await readFile(featureFile, 'utf-8');
    
    // Now add API to the existing feature
    await addSectionCommand('/test', 'test-feat', { api: true });
    
    expect(existsSync(path.join(TEST_DIR, 'src/features/test-feat/api/index.ts'))).toBe(true);
    
    // Ensure the main feature file was NOT overwritten
    const currentContent = await readFile(featureFile, 'utf-8');
    expect(currentContent).toBe(initialContent);
  });

  it('create-component should support additive updates for components', async () => {
    await createComponentCommand('Button', {});
    const componentFile = path.join(TEST_DIR, 'src/components/Button/Button.tsx');
    expect(existsSync(componentFile)).toBe(true);
    const initialContent = await readFile(componentFile, 'utf-8');
    
    // Now add stories to the existing component
    await createComponentCommand('Button', { stories: true });
    
    expect(existsSync(path.join(TEST_DIR, 'src/components/Button/Button.stories.tsx'))).toBe(true);
    
    // Ensure the main component file was NOT overwritten
    const currentContent = await readFile(componentFile, 'utf-8');
    expect(currentContent).toBe(initialContent);
  });

  it('should overwrite existing files if --force is used', async () => {
    await createComponentCommand('Button', {});
    const componentFile = path.join(TEST_DIR, 'src/components/Button/Button.tsx');
    const initialContent = await readFile(componentFile, 'utf-8');
    
    // Manually modify the file
    await writeFile(componentFile, 'MODIFIED', 'utf-8');
    
    // Running without force should skip it
    await createComponentCommand('Button', { force: false });
    expect(await readFile(componentFile, 'utf-8')).toBe('MODIFIED');
    
    // Running with force should overwrite it
    await createComponentCommand('Button', { force: true });
    expect(await readFile(componentFile, 'utf-8')).not.toBe('MODIFIED');
    expect(await readFile(componentFile, 'utf-8')).toBe(initialContent);
  });

  it('should support the unified add command for features', async () => {
    await addSectionCommand('/test', 'test-feat', {});
    
    // Use the new add command to add a hook
    await addItemCommand('hook', 'test-feat', {});
    
    expect(existsSync(path.join(TEST_DIR, 'src/features/test-feat/hooks/useTestFeat.ts'))).toBe(true);
  });

  it('should support the unified add command for components', async () => {
    await createComponentCommand('Button', {});
    
    // Use the new add command to add readme
    await addItemCommand('readme', 'Button', {});
    
    expect(existsSync(path.join(TEST_DIR, 'src/components/Button/README.md'))).toBe(true);
  });
});

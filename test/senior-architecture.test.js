import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { createComponentCommand } from '../src/commands/create-component.js';

const TEST_DIR = path.join(process.cwd(), 'temp-senior-test');

describe('Senior Level Architecture', () => {
  const originalCwd = process.cwd;

  beforeEach(async () => {
    process.cwd = () => TEST_DIR;
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_DIR, { recursive: true });
    await initCommand({ force: true });
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('add-section should support senior folders', async () => {
    await addSectionCommand('/dashboard', 'users/dashboard', { 
      layout: 'Main',
      api: true,
      services: true,
      schemas: true,
      tests: true,
      readme: true,
      stories: true,
      hooks: true,
      context: true,
      types: true,
      index: true
    });

    const featureDir = path.join(TEST_DIR, 'src/features/users/dashboard');
    
    expect(existsSync(path.join(featureDir, 'api/index.ts'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'services/index.ts'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'schemas/index.ts'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'hooks/useUsersDashboard.ts'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'context/UsersDashboardContext.tsx'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'types/index.ts'))).toBe(true);
    expect(existsSync(path.join(featureDir, '__tests__/UsersDashboard.test.tsx'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'README.md'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'UsersDashboard.stories.tsx'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'index.ts'))).toBe(true);
    expect(existsSync(path.join(featureDir, 'UsersDashboard.astro'))).toBe(true);

    const apiContent = await readFile(path.join(featureDir, 'api/index.ts'), 'utf-8');
    expect(apiContent).toContain('export function GET({ params, request })');
    expect(apiContent).toContain('name: "UsersDashboard"');
  });

  it('create-component should support senior folders', async () => {
    await createComponentCommand('DataCard', {
      api: true,
      services: true,
      schemas: true,
      readme: true,
      stories: true
    });

    const componentDir = path.join(TEST_DIR, 'src/components/DataCard');
    
    expect(existsSync(path.join(componentDir, 'api/index.ts'))).toBe(true);
    expect(existsSync(path.join(componentDir, 'services/index.ts'))).toBe(true);
    expect(existsSync(path.join(componentDir, 'schemas/index.ts'))).toBe(true);
    expect(existsSync(path.join(componentDir, 'README.md'))).toBe(true);
    expect(existsSync(path.join(componentDir, 'DataCard.stories.tsx'))).toBe(true);
    
    // Check default ones are still there
    expect(existsSync(path.join(componentDir, 'hooks/useDataCard.ts'))).toBe(true);
    expect(existsSync(path.join(componentDir, 'context/DataCardContext.tsx'))).toBe(true);
  });
});

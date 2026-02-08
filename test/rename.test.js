import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { renameCommand } from '../src/commands/rename.js';
import { createComponentCommand } from '../src/commands/create-component.js';
import { loadState } from '../src/utils/state.js';

const TEST_DIR = path.join(process.cwd(), 'temp-rename-test');

describe('Rename Command', () => {
  const originalCwd = process.cwd;

  beforeEach(async () => {
    process.cwd = () => TEST_DIR;
    if (existsSync(TEST_DIR)) {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    }
    await fs.mkdir(TEST_DIR, { recursive: true });
    await initCommand({ force: true });
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    if (existsSync(TEST_DIR)) {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should rename a route (keeping the feature)', async () => {
    await addSectionCommand('/old-route', 'MyFeature', {});
    expect(existsSync(path.join(TEST_DIR, 'src/pages/old-route.astro'))).toBe(true);

    await renameCommand('route', '/old-route', '/new-route', {});

    expect(existsSync(path.join(TEST_DIR, 'src/pages/old-route.astro'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/pages/new-route.astro'))).toBe(true);
    
    // Feature should still exist at original path because we didn't tell it to move
    // and /old-route doesn't match MyFeature enough for automatic move in this case 
    // (though moveSectionCommand might have some logic for it, let's check)
    expect(existsSync(path.join(TEST_DIR, 'src/features/MyFeature/MyFeature.astro'))).toBe(true);
    
    const state = await loadState();
    const section = state.sections.find(s => s.route === '/new-route');
    expect(section).toBeDefined();
    expect(section.featurePath).toBe('MyFeature');
  });

  it('should rename a feature and update its component names', async () => {
    await addSectionCommand('/test', 'OldFeature', { entry: 'pascal' });
    const oldFeatureFile = path.join(TEST_DIR, 'src/features/OldFeature/OldFeature.astro');
    expect(existsSync(oldFeatureFile)).toBe(true);

    await renameCommand('feature', 'OldFeature', 'NewFeature', {});

    expect(existsSync(path.join(TEST_DIR, 'src/features/OldFeature'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/features/NewFeature/NewFeature.astro'))).toBe(true);

    const featureContent = await fs.readFile(path.join(TEST_DIR, 'src/features/NewFeature/NewFeature.astro'), 'utf-8');
    expect(featureContent).toContain('Feature: NewFeature');
    
    const routeContent = await fs.readFile(path.join(TEST_DIR, 'src/pages/test.astro'), 'utf-8');
    expect(routeContent).toContain("import NewFeature from '../features/NewFeature/NewFeature.astro'");
    expect(routeContent).toContain("<NewFeature />");
    
    const state = await loadState();
    const section = state.sections.find(s => s.featurePath === 'NewFeature');
    expect(section).toBeDefined();
  });

  it('should rename a component', async () => {
    await createComponentCommand('OldComponent', {});
    const oldCompFile = path.join(TEST_DIR, 'src/components/OldComponent/OldComponent.tsx');
    expect(existsSync(oldCompFile)).toBe(true);

    await renameCommand('component', 'OldComponent', 'NewComponent', {});

    expect(existsSync(path.join(TEST_DIR, 'src/components/OldComponent'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/components/NewComponent/NewComponent.tsx'))).toBe(true);

    const compContent = await fs.readFile(path.join(TEST_DIR, 'src/components/NewComponent/NewComponent.tsx'), 'utf-8');
    expect(compContent).toContain('export default function NewComponent');
    
    const state = await loadState();
    const component = state.components.find(c => c.name === 'NewComponent');
    expect(component).toBeDefined();
    expect(component.path).toBe('src/components/NewComponent');
  });
  
  it('should correct typos using rename', async () => {
    // Accidentally created with typo
    await addSectionCommand('/lgoin', 'auth/lgoin', { entry: 'pascal' });
    
    // Rename route
    await renameCommand('route', '/lgoin', '/login', {});
    expect(existsSync(path.join(TEST_DIR, 'src/pages/login.astro'))).toBe(true);
    
    // Rename feature
    await renameCommand('feature', 'auth/lgoin', 'auth/login', {});
    expect(existsSync(path.join(TEST_DIR, 'src/features/auth/login/AuthLogin.astro'))).toBe(true);
    
    const routeContent = await fs.readFile(path.join(TEST_DIR, 'src/pages/login.astro'), 'utf-8');
    expect(routeContent).toContain("import AuthLogin from '../features/auth/login/AuthLogin.astro'");
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { removeSectionCommand } from '../src/commands/remove-section.js';
import { moveSectionCommand } from '../src/commands/move-section.js';
import { createComponentCommand } from '../src/commands/create-component.js';
import { removeComponentCommand } from '../src/commands/remove-component.js';

const TEST_DIR = path.join(process.cwd(), 'temp-state-test');

describe('State Management', () => {
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

  it('should save section to state and allow removal by route only', async () => {
    await addSectionCommand('/users', 'users/catalog', { layout: 'Main' });
    
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    expect(existsSync(statePath)).toBe(true);
    
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].route).toBe('/users');
    expect(state.sections[0].featurePath).toBe('users/catalog');
    expect(state.files).toBeDefined();
    // Should have at least route and feature file
    expect(Object.keys(state.files).length).toBeGreaterThanOrEqual(2);

    // Remove by route only
    await removeSectionCommand('/users', null, {});
    
    const updatedState = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(updatedState.sections).toHaveLength(0);
    expect(Object.keys(updatedState.files)).toHaveLength(0);
    expect(existsSync(path.join(TEST_DIR, 'src/pages/users.astro'))).toBe(false);
  });

  it('should save component to state and allow removal by name', async () => {
    await createComponentCommand('Button', {});
    
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.components).toHaveLength(1);
    expect(state.components[0].name).toBe('Button');
    expect(state.files).toBeDefined();
    expect(Object.keys(state.files).length).toBeGreaterThan(0);

    await removeComponentCommand('Button', {});
    
    const updatedState = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(updatedState.components).toHaveLength(0);
    expect(Object.keys(updatedState.files)).toHaveLength(0);
    expect(existsSync(path.join(TEST_DIR, 'src/components/Button'))).toBe(false);
  });

  it('should allow moving section using state lookup', async () => {
    await addSectionCommand('/old', 'old/feature', { layout: 'Main' });
    
    // move using only routes
    await moveSectionCommand('/old', '/new', null, null, {});
    
    expect(existsSync(path.join(TEST_DIR, 'src/pages/old.astro'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/pages/new.astro'))).toBe(true);
    expect(existsSync(path.join(TEST_DIR, 'src/features/old/feature'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/features/new/feature'))).toBe(true);
    
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].route).toBe('/new');
  });

  it('should support custom names for sections', async () => {
    await addSectionCommand('/products', 'shop/products', { layout: 'Main', name: 'ProductsCatalog' });
    
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.sections[0].name).toBe('ProductsCatalog');

    // Remove by name
    await removeSectionCommand('ProductsCatalog', null, {});
    expect(existsSync(path.join(TEST_DIR, 'src/pages/products.astro'))).toBe(false);
  });
});

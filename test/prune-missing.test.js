import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { pruneMissingCommand } from '../src/commands/prune-missing.js';

const TEST_DIR = path.join(process.cwd(), 'temp-prune-test');

describe('Prune Missing Command', () => {
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
    vi.restoreAllMocks();
  });

  it('should remove missing files from state', async () => {
    // 1. Add a section
    await addSectionCommand('/test', 'test-feat', {});
    const routePath = 'src/pages/test.astro';
    const featurePath = 'src/features/test-feat/TestFeat.astro';
    
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    let state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.files[routePath]).toBeDefined();
    expect(state.files[featurePath]).toBeDefined();

    // 2. Delete one file from disk
    await rm(path.join(TEST_DIR, routePath));

    // 3. Run prune-missing
    await pruneMissingCommand({});

    // 4. Verify it was removed from state but the other remains
    state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.files[routePath]).toBeUndefined();
    expect(state.files[featurePath]).toBeDefined();
  });

  it('should not change state if dry-run is used', async () => {
    await addSectionCommand('/test', 'test-feat', {});
    const routePath = 'src/pages/test.astro';
    await rm(path.join(TEST_DIR, routePath));

    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const initialState = await readFile(statePath, 'utf-8');

    await pruneMissingCommand({ dryRun: true });

    const finalState = await readFile(statePath, 'utf-8');
    expect(finalState).toBe(initialState);
    
    const state = JSON.parse(finalState);
    expect(state.files[routePath]).toBeDefined();
  });

  it('should say "No missing references found" if everything is in sync', async () => {
    await addSectionCommand('/test', 'test-feat', {});
    
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await pruneMissingCommand({});
    
    expect(logSpy).toHaveBeenCalledWith('No missing references found.');
  });

  it('should reconstruct components and sections after pruning', async () => {
    // 1. Add a section
    await addSectionCommand('/test', 'test-feat', {});
    
    // 2. Delete ALL files of that section from disk
    const featureDir = path.join(TEST_DIR, 'src/features/test-feat');
    const routeFile = path.join(TEST_DIR, 'src/pages/test.astro');
    await rm(featureDir, { recursive: true, force: true });
    await rm(routeFile);

    // 3. Run prune-missing
    await pruneMissingCommand({});

    // 4. Verify section is gone from state metadata
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.sections).toHaveLength(0);
    expect(state.files).toEqual({});
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { adoptCommand } from '../src/commands/adopt.js';
import { saveState } from '../src/utils/state.js';

const TEST_DIR = path.join(process.cwd(), 'temp-adopt-new-spec-test');

describe('Adopt Command New Specification', () => {
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

  it('should support adopt component componentName', async () => {
    const compPath = path.join(TEST_DIR, 'src/components/NewComp');
    await mkdir(compPath, { recursive: true });
    await writeFile(path.join(compPath, 'NewComp.astro'), '<div>New</div>', 'utf-8');

    // This should work with the new signature: adopt component NewComp
    await adoptCommand('component', 'NewComp', null, {});

    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    expect(state.files['src/components/NewComp/NewComp.astro']).toBeDefined();
    expect(state.components.find(c => c.name === 'NewComp')).toBeDefined();
  });

  it('should support adopt feature path featureName', async () => {
    const externalPath = path.join(TEST_DIR, 'legacy/my-feat');
    await mkdir(externalPath, { recursive: true });
    await writeFile(path.join(externalPath, 'Legacy.astro'), '<div>Legacy</div>', 'utf-8');

    // This should work with the new signature: adopt feature legacy/my-feat new-feat
    await adoptCommand('feature', 'legacy/my-feat', 'new-feat', {});

    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    
    // Check if files moved
    expect(existsSync(path.join(TEST_DIR, 'src/features/new-feat/Legacy.astro'))).toBe(true);
    expect(existsSync(externalPath)).toBe(false);

    expect(state.files['src/features/new-feat/Legacy.astro']).toBeDefined();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import * as gitUtils from '../src/utils/git.js';

const TEST_DIR = path.join(process.cwd(), 'temp-git-test');

describe('Git Staging', () => {
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

  it('should stage files when stageChanges is true', async () => {
    // 1. Enable stageChanges in config
    const configPath = path.join(TEST_DIR, '.textor', 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    config.git = { stageChanges: true };
    await writeFile(configPath, JSON.stringify(config));
    
    // 2. Mock stageFiles
    const stageSpy = vi.spyOn(gitUtils, 'stageFiles').mockResolvedValue();
    
    // 3. Add a section
    await addSectionCommand('/test', 'test-feat', {});
    
    // 4. Verify stageFiles was called with the written files
    expect(stageSpy).toHaveBeenCalled();
    const stagedFiles = stageSpy.mock.calls[0][0].map(f => path.relative(TEST_DIR, f).replace(/\\/g, '/'));
    expect(stagedFiles).toContain('src/pages/test.astro');
    expect(stagedFiles).toContain('src/features/test-feat/TestFeat.astro');
  });

  it('should NOT stage files when stageChanges is false', async () => {
    const stageSpy = vi.spyOn(gitUtils, 'stageFiles');
    await addSectionCommand('/test', 'test-feat', {});
    expect(stageSpy).not.toHaveBeenCalled();
  });
});

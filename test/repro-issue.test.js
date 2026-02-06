import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { addSectionCommand } from '../src/commands/add-section.js';
import { saveConfig } from '../src/utils/config.js';
import { loadState, saveState } from '../src/utils/state.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import path from 'path';

const TEST_DIR = path.join(process.cwd(), 'test-standalone-feature');

function fp(rel) {
  return path.join(TEST_DIR, rel);
}

describe('Standalone Feature Creation', () => {
  const originalCwd = process.cwd;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Mock cwd to point to TEST_DIR
    process.cwd = () => TEST_DIR;

    // Minimal config
    mkdirSync(path.join(TEST_DIR, '.textor'), { recursive: true });
    const defaultConfig = {
      paths: {
        pages: 'src/pages',
        features: 'src/features',
        components: 'src/components',
        layouts: 'src/layouts'
      },
      routing: { mode: 'flat', indexFile: 'index.astro' },
      naming: {
        routeExtension: '.astro',
        featureExtension: '.astro',
        componentExtension: '.tsx',
        hookExtension: '.ts',
        testExtension: '.test.tsx'
      },
      signatures: { astro: '<!-- @generated -->', typescript: '// @generated' },
      importAliases: {},
      features: { entry: 'pascal', createScriptsDir: true, scriptsIndexFile: 'scripts/index.ts', createSubComponentsDir: true },
      components: {},
      formatting: { tool: 'none' },
      defaultPreset: 'standard',
      presets: { standard: { features: {}, components: {} } }
    };
    await saveConfig(defaultConfig, true);
    await saveState({ sections: [], components: [], files: {} });
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('creates a feature without a route and tracks it in state', async () => {
    await addSectionCommand(undefined, 'auth/login', {});

    // Route file should not exist
    expect(existsSync(fp('src/pages/auth/login.astro'))).toBe(false);

    // Feature file should exist
    expect(existsSync(fp('src/features/auth/login/AuthLogin.astro'))).toBe(true);

    const state = await loadState();
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].route).toBe(null);
    expect(state.sections[0].featurePath).toBe('auth/login');
  });
});

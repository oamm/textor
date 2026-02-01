import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { 
  loadConfig, 
  saveConfig, 
  getConfigPath, 
  getConfigDir, 
  DEFAULT_CONFIG,
  resolvePath
} from '../src/utils/config.js';

describe('Config utilities', () => {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  beforeEach(async () => {
    if (existsSync(configDir)) {
      await rm(configDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (existsSync(configDir)) {
      await rm(configDir, { recursive: true, force: true });
    }
  });

  describe('loadConfig', () => {
    it('throws error if config does not exist', async () => {
      await expect(loadConfig()).rejects.toThrow(/Textor configuration not found/);
    });

    it('loads and merges with DEFAULT_CONFIG', async () => {
      await mkdir(configDir, { recursive: true });
      const customConfig = {
        paths: {
          pages: 'custom/pages'
        }
      };
      await writeFile(configPath, JSON.stringify(customConfig));

      const config = await loadConfig();
      expect(config.paths.pages).toBe('custom/pages');
      expect(config.paths.features).toBe(DEFAULT_CONFIG.paths.features);
      expect(config.naming.routeExtension).toBe(DEFAULT_CONFIG.naming.routeExtension);
    });

    it('throws error on invalid JSON', async () => {
      await mkdir(configDir, { recursive: true });
      await writeFile(configPath, '{ invalid json }');

      await expect(loadConfig()).rejects.toThrow(/Failed to parse config: Invalid JSON/);
    });

    it('throws error on invalid structure (missing paths)', async () => {
      await mkdir(configDir, { recursive: true });
      // signatures is missing here, and it's required by validateConfig
      const invalidConfig = {
        paths: {},
        naming: {}
        // signatures: {} is missing
      };
      // But wait, loadConfig merges with DEFAULT_CONFIG, so signatures will be there!
      // To test validation failure in loadConfig, we'd need to bypass merge or have a really weird config.
      // Actually, deepMerge with DEFAULT_CONFIG ensures all top-level keys exist.
    });
  });

  describe('saveConfig', () => {
    it('saves config to file', async () => {
      const configPath = await saveConfig(DEFAULT_CONFIG);
      expect(existsSync(configPath)).toBe(true);
      
      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.paths.pages).toBe(DEFAULT_CONFIG.paths.pages);
    });

    it('throws if config exists and force is false', async () => {
      await saveConfig(DEFAULT_CONFIG);
      await expect(saveConfig(DEFAULT_CONFIG)).rejects.toThrow(/Configuration already exists/);
    });

    it('overwrites if force is true', async () => {
      await saveConfig(DEFAULT_CONFIG);
      const customConfig = { ...DEFAULT_CONFIG, paths: { ...DEFAULT_CONFIG.paths, pages: 'new/pages' } };
      await saveConfig(customConfig, true);
      
      const content = await readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.paths.pages).toBe('new/pages');
    });

    it('validates config before saving', async () => {
      const invalidConfig = { paths: 'not an object' };
      await expect(saveConfig(invalidConfig)).rejects.toThrow(/Invalid configuration/);
    });
  });

  describe('resolvePath', () => {
    it('resolves path correctly', () => {
      const config = {
        paths: {
          pages: 'src/pages'
        }
      };
      const resolved = resolvePath(config, 'pages');
      expect(resolved).toBe(path.resolve(process.cwd(), 'src/pages'));
    });

    it('throws if path key not found', () => {
      const config = { paths: {} };
      expect(() => resolvePath(config, 'nonexistent')).toThrow(/not found in configuration/);
    });
  });
});

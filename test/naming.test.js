import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rmdir, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { toPascalCase, toCamelCase, getFeatureComponentName, normalizeRoute, routeToFilePath } from '../src/utils/naming.js';

describe('Naming utilities', () => {
  describe('toPascalCase', () => {
    it('converts slash-separated paths to PascalCase', () => {
      expect(toPascalCase('users/catalog')).toBe('UsersCatalog');
      expect(toPascalCase('auth/sign-in')).toBe('AuthSignIn');
      expect(toPascalCase('admin/user-management')).toBe('AdminUserManagement');
    });

    it('handles single segments', () => {
      expect(toPascalCase('users')).toBe('Users');
      expect(toPascalCase('auth')).toBe('Auth');
    });

    it('handles underscore-separated paths', () => {
      expect(toPascalCase('user_profile')).toBe('UserProfile');
    });

    it('respects existing camelCase or PascalCase', () => {
      expect(toPascalCase('myComponent')).toBe('MyComponent');
      expect(toPascalCase('MyComponent')).toBe('MyComponent');
      expect(toPascalCase('users/MyCatalog')).toBe('UsersMyCatalog');
    });
  });

  describe('toCamelCase', () => {
    it('converts to camelCase', () => {
      expect(toCamelCase('users/catalog')).toBe('usersCatalog');
      expect(toCamelCase('auth/sign-in')).toBe('authSignIn');
    });
  });

  describe('normalizeRoute', () => {
    it('ensures route starts with /', () => {
      expect(normalizeRoute('users')).toBe('/users');
      expect(normalizeRoute('/users')).toBe('/users');
    });

    it('removes trailing slash except for root', () => {
      expect(normalizeRoute('/users/')).toBe('/users');
      expect(normalizeRoute('/')).toBe('/');
    });
  });

  describe('routeToFilePath', () => {
    it('converts routes to file paths', () => {
      expect(routeToFilePath('/users')).toBe('users.astro');
      expect(routeToFilePath('/auth/signin')).toBe('auth/signin.astro');
      expect(routeToFilePath('/')).toBe('index.astro');
    });
  });
});

describe('Config utilities', () => {
  const testDir = path.join(process.cwd(), '.test-textor');
  const testConfigPath = path.join(testDir, 'config.json');

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  afterEach(async () => {
    if (existsSync(testConfigPath)) {
      await unlink(testConfigPath);
    }
    if (existsSync(testDir)) {
      await rmdir(testDir);
    }
  });

  it('creates valid config structure', async () => {
    const config = {
      paths: {
        pages: 'src/pages',
        features: 'src/features'
      }
    };

    await writeFile(testConfigPath, JSON.stringify(config, null, 2));
    
    expect(existsSync(testConfigPath)).toBe(true);
    
    const content = await readFile(testConfigPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.paths.pages).toBe('src/pages');
    expect(parsed.paths.features).toBe('src/features');
  });
});

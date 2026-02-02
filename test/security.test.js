import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';

const TEST_DIR = path.resolve('temp-security-test');

describe('Security', () => {
  const originalCwd = process.cwd;

  beforeEach(async () => {
    process.cwd = () => TEST_DIR;
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    
    // Create basic structure
    mkdirSync(path.join(TEST_DIR, 'src'));
    mkdirSync(path.join(TEST_DIR, 'src/pages'));
    mkdirSync(path.join(TEST_DIR, 'src/features'));
    mkdirSync(path.join(TEST_DIR, 'src/layouts'));
    
    await initCommand({ force: true });
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should not allow creating sections outside of pages directory', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      await addSectionCommand('/../../traversal', 'Traversal', { layout: 'Main' });
    } catch (error) {
      if (error.message !== 'process.exit called') throw error;
    }
    
    expect(logSpy).toHaveBeenCalledWith('Error:', expect.stringContaining('Path traversal attempt detected'));
    expect(exitSpy).toHaveBeenCalledWith(1);
    
    const outsideFile = path.resolve(TEST_DIR, 'traversal.astro');
    expect(existsSync(outsideFile)).toBe(false);
    
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should handle special replacement patterns in templates safely', async () => {
    // Create an override template that uses a variable
    const templatesDir = path.join(TEST_DIR, '.textor/templates');
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(path.join(templatesDir, 'feature.astro'), '---// {{componentName}}---');
    
    // '$&' in JS replacement strings means "the whole matched string"
    await addSectionCommand('/special', 'special_$&', { layout: 'Main' });
    
    const featureFile = path.join(TEST_DIR, 'src/features/special_$&/Special$&.astro');
    const content = readFileSync(featureFile, 'utf-8');
    
    // If it was unsafe, it might have replaced {{componentName}} with '{{componentName}}'
    // because '$&' matches '{{componentName}}'
    // If it is safe, it should be 'Special$&'
    expect(content).toContain('// Special$&');
  });
});

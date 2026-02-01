import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEMP_PROJECT = 'temp-improvements-test';

describe('New Improvements', () => {
  const fullTempPath = path.resolve(TEMP_PROJECT);
  
  beforeEach(() => {
    if (fs.existsSync(fullTempPath)) {
      fs.rmSync(fullTempPath, { recursive: true, force: true });
    }
    fs.mkdirSync(fullTempPath);
    
    // Create basic structure
    fs.mkdirSync(path.join(fullTempPath, 'src'));
    fs.mkdirSync(path.join(fullTempPath, 'src/pages'));
    fs.mkdirSync(path.join(fullTempPath, 'src/features'));
    fs.mkdirSync(path.join(fullTempPath, 'src/layouts'));
    fs.mkdirSync(path.join(fullTempPath, 'src/components'));
    
    // Initialize textor
    const binPath = path.resolve('bin', 'textor.js');
    execSync(`node ${binPath} init`, { stdio: 'ignore', cwd: fullTempPath });
  });

  afterEach(() => {
    fs.rmSync(fullTempPath, { recursive: true, force: true });
  });

  it('add-section supports --dry-run', () => {
    const binPath = path.resolve('bin', 'textor.js');
    const output = execSync(`node ${binPath} add-section home Home --dry-run`, { cwd: fullTempPath }).toString();
    
    expect(output).toContain('Dry run - would create:');
    expect(output).toContain('home.astro');
    expect(output).toContain('Home.astro');
    
    // Verify files were NOT created
    expect(fs.existsSync(path.join(fullTempPath, 'src/pages/home.astro'))).toBe(false);
  });

  it('list-sections shows managed sections', () => {
    const binPath = path.resolve('bin', 'textor.js');
    
    // Create a section first
    execSync(`node ${binPath} add-section about About`, { stdio: 'ignore', cwd: fullTempPath });
    
    const output = execSync(`node ${binPath} list-sections`, { cwd: fullTempPath }).toString();
    
    expect(output).toContain('Managed Sections:');
    expect(output).toContain('- about (about.astro)');
    expect(output).toContain('Import: ../features/About/About');
  });

  it('template overrides work', () => {
    const binPath = path.resolve('bin', 'textor.js');
    
    // Create override directory and file
    const templatesDir = path.join(fullTempPath, '.textor/templates');
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(path.join(templatesDir, 'feature.astro'), '---// CUSTOM TEMPLATE {{componentName}}---<div>CUSTOM</div>');
    
    // Add a section
    execSync(`node ${binPath} add-section custom Custom`, { stdio: 'ignore', cwd: fullTempPath });
    
    const content = fs.readFileSync(path.join(fullTempPath, 'src/features/Custom/Custom.astro'), 'utf-8');
    expect(content).toContain('CUSTOM TEMPLATE Custom');
    expect(content).toContain('<div>CUSTOM</div>');
  });

  it('config validation catches invalid extensions', () => {
    const binPath = path.resolve('bin', 'textor.js');
    
    // Modify config to have invalid extension
    const configPath = path.join(fullTempPath, '.textor/config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.naming.routeExtension = 'astro'; // Missing dot
    fs.writeFileSync(configPath, JSON.stringify(config));
    
    try {
      execSync(`node ${binPath} list-sections`, { stdio: 'pipe', cwd: fullTempPath });
      expect.fail('Should have failed due to invalid config');
    } catch (error) {
      expect(error.stderr.toString()).toContain('should start with a dot');
    }
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEMP_PROJECT = 'temp-list-senior-test';

describe('list-sections with senior architecture', () => {
  const fullTempPath = path.resolve(TEMP_PROJECT);
  const binPath = path.resolve('bin', 'textor.js');
  
  beforeEach(() => {
    if (fs.existsSync(fullTempPath)) {
      fs.rmSync(fullTempPath, { recursive: true, force: true });
    }
    fs.mkdirSync(fullTempPath);
    execSync(`node ${binPath} init`, { cwd: fullTempPath });
  });

  afterEach(() => {
    fs.rmSync(fullTempPath, { recursive: true, force: true });
  });

  it('should list architecture details for senior sections and components', () => {
    // 1. Add a senior section
    execSync(`node ${binPath} add-section /dashboard dashboard --preset senior`, { cwd: fullTempPath });
    
    // 2. Add a standard component
    execSync(`node ${binPath} create-component Button --preset standard`, { cwd: fullTempPath });

    const output = execSync(`node ${binPath} list-sections`, { cwd: fullTempPath }).toString();
    
    // Verify Section details
    expect(output).toContain('Dashboard [/dashboard]');
    expect(output).toContain('Architecture: API, Services, Schemas, Hooks, Context, Types, Scripts, Sub-components, Tests, Docs, Stories');
    
    // Verify Component details
    expect(output).toContain('Button');
    expect(output).toContain('Architecture: Hooks, Context, Types, Sub-components, Tests, Config, Constants');
  });
});

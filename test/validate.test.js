import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEMP_PROJECT = 'temp-validate-test';

describe('validate-state command', () => {
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

  it('should detect modified and missing files', () => {
    // 1. Create a section
    execSync(`node ${binPath} add-section /test test`, { cwd: fullTempPath });
    
    // 2. Modify a file
    const routePath = path.join(fullTempPath, 'src/pages/test.astro');
    fs.appendFileSync(routePath, '\n// manual edit');
    
    // 3. Delete a file
    const featurePath = path.join(fullTempPath, 'src/features/test/Test.astro');
    fs.unlinkSync(featurePath);

    const output = execSync(`node ${binPath} validate-state`, { cwd: fullTempPath }).toString();
    
    expect(output).toContain('Modified files: 1');
    expect(output).toContain('src/pages/test.astro');
    expect(output).toContain('Missing files: 1');
    expect(output).toContain('src/features/test/Test.astro');
  });

  it('should fix state with --fix', () => {
    // 1. Create a section
    execSync(`node ${binPath} add-section /test test`, { cwd: fullTempPath });
    
    // 2. Modify a file (keeping signature)
    const routePath = path.join(fullTempPath, 'src/pages/test.astro');
    fs.appendFileSync(routePath, '\n// manual edit');
    
    // 3. Fix state
    execSync(`node ${binPath} validate-state --fix`, { cwd: fullTempPath });
    
    // 4. Validate again
    const output = execSync(`node ${binPath} validate-state`, { cwd: fullTempPath }).toString();
    expect(output).toContain('State is perfectly in sync');
  });
});

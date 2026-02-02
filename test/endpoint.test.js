import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { addSectionCommand } from '../src/commands/add-section.js';
import { moveSectionCommand } from '../src/commands/move-section.js';
import { listSectionsCommand } from '../src/commands/list-sections.js';
import { initCommand } from '../src/commands/init.js';

const TEST_DIR = path.join(process.cwd(), 'temp-endpoint-test');

describe('Endpoint support', () => {
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
  });

  it('should create a .ts endpoint when --endpoint is used', async () => {
    await addSectionCommand('/api/users', 'users', { endpoint: true, api: true });

    const routePath = path.join(TEST_DIR, 'src/pages/api/users.ts');
    expect(existsSync(routePath)).toBe(true);

    const content = await readFile(routePath, 'utf-8');
    expect(content).toContain('export function GET({ params, request })');
    expect(content).toContain('JSON.stringify({');
    expect(content).toContain('name: "Users"');

    const apiPath = path.join(TEST_DIR, 'src/features/users/api/index.ts');
    expect(existsSync(apiPath)).toBe(true);
    const apiContent = await readFile(apiPath, 'utf-8');
    expect(apiContent).toContain('export function GET({ params, request })');
  });

  it('should correctly move a .ts endpoint', async () => {
    await addSectionCommand('/api/old', 'api/old', { endpoint: true });
    
    await moveSectionCommand('/api/old', '/api/new', null, null, {});

    expect(existsSync(path.join(TEST_DIR, 'src/pages/api/old.ts'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/pages/api/new.ts'))).toBe(true);
    
    const content = await readFile(path.join(TEST_DIR, 'src/pages/api/new.ts'), 'utf-8');
    expect(content).toContain('export function GET');
  });

  it('should list .ts endpoints in list-sections', async () => {
    await addSectionCommand('/api/users', 'users', { endpoint: true });
    
    // Capture console.log
    const logs = [];
    const originalLog = console.log;
    console.log = (msg) => logs.push(msg);
    
    await listSectionsCommand();
    
    console.log = originalLog;
    
    const allLogs = logs.join('\n');
    expect(allLogs).toContain('Users [/api/users] (api/users.ts)');
  });
});

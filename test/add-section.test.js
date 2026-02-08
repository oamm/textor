import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { saveState } from '../src/utils/state.js';

const TEST_DIR = path.join(process.cwd(), 'temp-add-multiple-sections-test');

describe('Add Multiple Sections to same route', () => {
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

  it('should add multiple features to the same route without overriding', async () => {
    // 1. Add first feature
    await addSectionCommand('/test', 'feature1', {});
    const routePath = path.join(TEST_DIR, 'src/pages/test.astro');
    
    expect(existsSync(routePath)).toBe(true);
    let content = await readFile(routePath, 'utf-8');
    expect(content).toContain("import Feature1 from '../features/feature1/Feature1.astro';");
    expect(content).toContain("<Feature1 />");

    // 2. Add second feature to same route
    await addSectionCommand('/test', 'feature2', {});
    
    content = await readFile(routePath, 'utf-8');
    expect(content).toContain("import Feature1 from '../features/feature1/Feature1.astro';");
    expect(content).toContain("import Feature2 from '../features/feature2/Feature2.astro';");
    expect(content).toContain("<Feature1 />");
    expect(content).toContain("<Feature2 />");

    // Verify it's still wrapped in the layout
    expect(content).toContain("<Main>");
    expect(content).toContain("</Main>");

    // 3. Add a third one
    await addSectionCommand('/test', 'feature3', {});
    content = await readFile(routePath, 'utf-8');
    expect(content).toContain("import Feature3 from '../features/feature3/Feature3.astro';");
    expect(content).toContain("<Feature3 />");
    
    // Count occurrences of features
    const feature1Count = (content.match(/<Feature1 \/>/g) || []).length;
    const feature2Count = (content.match(/<Feature2 \/>/g) || []).length;
    const feature3Count = (content.match(/<Feature3 \/>/g) || []).length;
    expect(feature1Count).toBe(1);
    expect(feature2Count).toBe(1);
    expect(feature3Count).toBe(1);

    // Verify state
    const statePath = path.join(TEST_DIR, '.textor', 'state.json');
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    const testSections = state.sections.filter(s => s.route === '/test');
    expect(testSections.length).toBe(3);
  });
});

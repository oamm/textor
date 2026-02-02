import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { initCommand } from '../src/commands/init.js';
import { addSectionCommand } from '../src/commands/add-section.js';
import { moveSectionCommand } from '../src/commands/move-section.js';

const TEST_DIR = path.join(process.cwd(), 'temp-move-rename-test');

describe('Move Section with Renaming', () => {
  const originalCwd = process.cwd;

  beforeEach(async () => {
    process.cwd = () => TEST_DIR;
    if (existsSync(TEST_DIR)) {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    }
    await fs.mkdir(TEST_DIR, { recursive: true });
    await initCommand({ force: true });
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    if (existsSync(TEST_DIR)) {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should rename feature file and update component name when moving section', async () => {
    // 1. Add a section
    await addSectionCommand('/old', 'OldFeature', { 
        layout: 'Main', 
        entry: 'pascal', // Strategy 'pascal' ensures filename matches component name
        hooks: true 
    });

    const oldFeatureFile = path.join(TEST_DIR, 'src/features/OldFeature/OldFeature.astro');
    const oldHookFile = path.join(TEST_DIR, 'src/features/OldFeature/hooks/useOldFeature.ts');
    
    expect(existsSync(oldFeatureFile)).toBe(true);
    expect(existsSync(oldHookFile)).toBe(true);

    // 2. Move section to new route and new feature name
    await moveSectionCommand('/old', 'OldFeature', '/new', 'NewFeature', {});

    const newFeatureDir = path.join(TEST_DIR, 'src/features/NewFeature');
    const newFeatureFile = path.join(TEST_DIR, 'src/features/NewFeature/NewFeature.astro');
    const newHookFile = path.join(TEST_DIR, 'src/features/NewFeature/hooks/useNewFeature.ts');

    // Currently, this is expected to FAIL because it doesn't rename files yet
    // It will probably be at src/features/NewFeature/OldFeature.astro
    
    expect(existsSync(path.join(TEST_DIR, 'src/features/OldFeature'))).toBe(false);
    expect(existsSync(newFeatureDir)).toBe(true);
    
    // These are the desired behaviors:
    expect(existsSync(newFeatureFile)).toBe(true);
    expect(existsSync(newHookFile)).toBe(true);
    
    const featureContent = await fs.readFile(newFeatureFile, 'utf-8');
    expect(featureContent).toContain('Feature: NewFeature'); 
    
    const routeContent = await fs.readFile(path.join(TEST_DIR, 'src/pages/new.astro'), 'utf-8');
    expect(routeContent).toContain("import NewFeature from '../features/NewFeature/NewFeature'");
    expect(routeContent).toContain("<NewFeature />");
  });

  it('should automatically derive new feature name from new route in state-aware move', async () => {
    // 1. Add a section where route and feature path match (case-insensitively)
    await addSectionCommand('/products', 'products', { layout: 'Main' });
    
    // 2. Move using only routes
    await moveSectionCommand('/products', '/shop', null, null, {});
    
    expect(existsSync(path.join(TEST_DIR, 'src/pages/products.astro'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/pages/shop.astro'))).toBe(true);
    
    // Feature should have been moved from 'products' to 'shop' automatically
    expect(existsSync(path.join(TEST_DIR, 'src/features/products'))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, 'src/features/shop'))).toBe(true);
    
    const featureFile = path.join(TEST_DIR, 'src/features/shop/Shop.astro');
    expect(existsSync(featureFile)).toBe(true);
    
    const content = await fs.readFile(featureFile, 'utf-8');
    expect(content).toContain('Feature: Shop');
  });
});

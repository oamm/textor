import { describe, it, expect } from 'vitest';
import { generateIndexTemplate } from '../src/utils/templates.js';

describe('Index Template Generation', () => {
  it('should include component export for .tsx files', () => {
    const content = generateIndexTemplate('MyComponent', '.tsx');
    expect(content).toContain("export { default as MyComponent } from './MyComponent.tsx';");
    expect(content).toContain("export * from './types';");
  });

  it('should NOT include component export for .astro files', () => {
    const content = generateIndexTemplate('MyFeature', '.astro');
    expect(content).not.toContain("export { default as MyFeature } from './MyFeature.astro';");
    expect(content).toContain("export * from './types';");
  });
});

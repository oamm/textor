import { existsSync, readFileSync } from 'fs';
import path from 'path';

function getTemplateOverride(templateName, data = {}) {
  const overridePath = path.join(process.cwd(), '.textor', 'templates', `${templateName}.astro`);
  if (existsSync(overridePath)) {
    let content = readFileSync(overridePath, 'utf-8');
    for (const [key, value] of Object.entries(data)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return content;
  }
  return null;
}

export function generateRouteTemplate(layoutName, layoutImportPath, featureImportPath, featureComponentName) {
  const override = getTemplateOverride('route', {
    layoutName,
    layoutImportPath,
    featureImportPath,
    featureComponentName
  });
  if (override) return override;

  return `---
import ${layoutName} from '${layoutImportPath}';
import ${featureComponentName} from '${featureImportPath}';
---

<${layoutName}>
  <${featureComponentName} />
</${layoutName}>
`;
}

export function generateFeatureTemplate(componentName) {
  const override = getTemplateOverride('feature', { componentName });
  if (override) return override;

  return `---
// Feature: ${componentName}
---

<div class="${componentName.toLowerCase()}">
  <h1>${componentName}</h1>
</div>
`;
}

export function generateScriptsIndexTemplate() {
  return `export {};
`;
}

export function generateComponentTemplate(componentName) {
  const override = getTemplateOverride('component', { componentName });
  if (override) return override;

  return `---
export type Props = {
  // Add props here
}

const props = Astro.props;
---

<div class="${componentName.toLowerCase()}">
  <!-- ${componentName} implementation -->
</div>
`;
}

export function generateHookTemplate(componentName, hookName) {
  const override = getTemplateOverride('hook', { componentName, hookName });
  if (override) return override;

  return `import { useState } from 'react';

export function ${hookName}() {
  // Add hook logic here
  
  return {
    // Return hook values
  };
}
`;
}

export function generateContextTemplate(componentName) {
  const override = getTemplateOverride('context', { componentName });
  if (override) return override;

  return `import { createContext, useContext } from 'react';

//@ts-ignore
type ${componentName}ContextValue = {
  // Add context value types here
}

const ${componentName}Context = createContext<${componentName}ContextValue | undefined>(undefined);

export function ${componentName}Provider({ children }: { children: React.ReactNode }) {
  const value: ${componentName}ContextValue = {
    // Provide context values
  };

  return (
    <${componentName}Context.Provider value={value}>
      {children}
    </${componentName}Context.Provider>
  );
}

export function use${componentName}Context() {
  const context = useContext(${componentName}Context);
  if (context === undefined) {
    throw new Error('use${componentName}Context must be used within ${componentName}Provider');
  }
  return context;
}
`;
}

export function generateTestTemplate(componentName, componentPath) {
  const override = getTemplateOverride('test', { componentName, componentPath });
  if (override) return override;

  return `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ${componentName} from '${componentPath}';

describe('${componentName}', () => {
  it('renders without crashing', () => {
    render(<${componentName} />);
    expect(screen.getByText('${componentName}')).toBeInTheDocument();
  });
});
`;
}

export function generateConfigTemplate(componentName) {
  return `export const ${componentName}Config = {
  // Add configuration here
};
`;
}

export function generateConstantsTemplate(componentName) {
  return `export const ${componentName.toUpperCase()}_CONSTANTS = {
  // Add constants here
};
`;
}

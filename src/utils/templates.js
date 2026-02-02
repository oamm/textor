import { existsSync, readFileSync } from 'fs';
import path from 'path';

function getTemplateOverride(templateName, data = {}) {
  const overridePath = path.join(process.cwd(), '.textor', 'templates', `${templateName}.astro`);
  if (existsSync(overridePath)) {
    let content = readFileSync(overridePath, 'utf-8');
    for (const [key, value] of Object.entries(data)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), () => value);
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

export function generateFeatureTemplate(componentName, scriptImportPath) {
  const override = getTemplateOverride('feature', { componentName, scriptImportPath });
  if (override) return override;

  const scriptTag = scriptImportPath ? `\n<script src="${scriptImportPath}"></script>` : '';

  return `---
// Feature: ${componentName}
---

<div class="${componentName.toLowerCase()}">
  <h1>${componentName}</h1>
</div>${scriptTag}
`;
}

export function generateScriptsIndexTemplate() {
  const override = getTemplateOverride('scripts-index');
  if (override) return override;

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
  const override = getTemplateOverride('config', { componentName });
  if (override) return override;

  return `export const ${componentName}Config = {
  // Add configuration here
};
`;
}

export function generateConstantsTemplate(componentName) {
  const override = getTemplateOverride('constants', { componentName });
  if (override) return override;

  return `export const ${componentName.toUpperCase()}_CONSTANTS = {
  // Add constants here
};
`;
}

export function generateIndexTemplate(componentName, componentExtension) {
  const override = getTemplateOverride('index', { componentName, componentExtension });
  if (override) return override;

  return `export { default as ${componentName} } from './${componentName}${componentExtension}';
export * from './types';
`;
}

export function generateTypesTemplate(componentName) {
  const override = getTemplateOverride('types', { componentName });
  if (override) return override;

  return `export type ${componentName}Props = {
  // Add props types here
};
`;
}

export function generateApiTemplate(componentName) {
  const override = getTemplateOverride('api', { componentName });
  if (override) return override;

  return `export function GET({ params, request }) {
  return new Response(
    JSON.stringify({
      name: "${componentName}",
      url: "https://astro.build/",
    }),
  );
}
`;
}

export function generateEndpointTemplate(componentName) {
  const override = getTemplateOverride('endpoint', { componentName });
  if (override) return override;

  return `export function GET({ params, request }) {
  return new Response(
    JSON.stringify({
      name: "${componentName}",
      url: "https://astro.build/",
    }),
  );
}
`;
}

export function generateServiceTemplate(componentName) {
  const override = getTemplateOverride('service', { componentName });
  if (override) return override;

  return `// ${componentName} business logic and transformers
export function format${componentName}Data(data: any) {
  return data;
}
`;
}

export function generateSchemaTemplate(componentName) {
  const override = getTemplateOverride('schema', { componentName });
  if (override) return override;

  return `// ${componentName} validation schemas
// import { z } from 'zod';

// export const ${componentName}Schema = z.object({
//   id: z.string(),
// });
`;
}

export function generateReadmeTemplate(componentName) {
  const override = getTemplateOverride('readme', { componentName });
  if (override) return override;

  return `# ${componentName}

## Description
Brief description of what this feature/component does.

## Props/Usage
How to use this and what are its requirements.
`;
}

export function generateStoriesTemplate(componentName, componentPath) {
  const override = getTemplateOverride('stories', { componentName, componentPath });
  if (override) return override;

  return `import type { Meta, StoryObj } from '@storybook/react';
import ${componentName} from '${componentPath}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
};

export default meta;
type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {
  args: {
    // Default props
  },
};
`;
}

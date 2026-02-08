import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { toPascalCase, toCamelCase, toKebabCase, toSnakeCase, toScreamingSnakeCase } from './naming.js';

export function enrichData(data) {
  const enriched = { ...data };
  const nameKeys = ['componentName', 'featureComponentName', 'layoutName'];
  for (const key of nameKeys) {
    if (data[key] && typeof data[key] === 'string') {
      enriched[`${key}Camel`] = toCamelCase(data[key]);
      enriched[`${key}Kebab`] = toKebabCase(data[key]);
      enriched[`${key}Snake`] = toSnakeCase(data[key]);
      enriched[`${key}Upper`] = toScreamingSnakeCase(data[key]);
      enriched[`${key}Pascal`] = toPascalCase(data[key]);
    }
  }
  return enriched;
}

function getTemplateOverride(templateName, extension, data = {}) {
  const overridePath = path.join(process.cwd(), '.textor', 'templates', `${templateName}${extension}`);
  if (existsSync(overridePath)) {
    let content = readFileSync(overridePath, 'utf-8');
    const finalData = enrichData(data);
    for (const [key, value] of Object.entries(finalData)) {
      const replacement = () => value || '';
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), replacement);
      content = content.replace(new RegExp(`__${key}__`, 'g'), replacement);
    }
    return content;
  }
  return null;
}

/**
 * Route Template Variables:
 * - layoutName: The name of the layout component
 * - layoutImportPath: Path to import the layout
 * - featureImportPath: Path to import the feature component
 * - featureComponentName: Name of the feature component
 * - layoutProps: Optional properties for the layout
 */
export function generateRouteTemplate(layoutName, layoutImportPath, featureImportPath, featureComponentName, extension = '.astro', layoutProps = {}) {
  const override = getTemplateOverride('route', extension, {
    layoutName,
    layoutImportPath,
    featureImportPath,
    featureComponentName,
    ...layoutProps
  });
  if (override) return override;

  if (layoutName === 'none') {
    return `---
import ${featureComponentName} from '${featureImportPath}';
---

<${featureComponentName} />
`;
  }

  const propsStr = Object.entries(layoutProps)
    .map(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
        return `${key}=${value}`;
      }
      if (typeof value === 'string') {
        return `${key}="${value}"`;
      }
      return `${key}={${JSON.stringify(value)}}`;
    })
    .join(' ');

  const layoutOpening = propsStr ? `<${layoutName} ${propsStr}>` : `<${layoutName}>`;

  return `---
import ${layoutName} from '${layoutImportPath}';
import ${featureComponentName} from '${featureImportPath}';
---

${layoutOpening}
  <${featureComponentName} />
</${layoutName}>
`;
}

export function mergeRouteTemplate(existingContent, featureImportPath, featureComponentName, layoutName) {
  let content = existingContent;
  
  // 1. Add import
  const importLine = `import ${featureComponentName} from '${featureImportPath}';`;
  if (!content.includes(importLine)) {
    // Find the second --- which marks the end of frontmatter
    const lines = content.split('\n');
    let frontMatterEndLine = -1;
    let dashCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        dashCount++;
        if (dashCount === 2) {
          frontMatterEndLine = i;
          break;
        }
      }
    }

    if (frontMatterEndLine !== -1) {
      lines.splice(frontMatterEndLine, 0, importLine);
      content = lines.join('\n');
    } else if (content.includes('---')) {
      // If only one --- found, maybe it's just the start? 
      // But standard Astro has two. 
      // Fallback: insert at the beginning if no frontmatter end found
      content = importLine + '\n' + content;
    }
  }

  // 2. Add component usage
  const componentTag = `<${featureComponentName} />`;
  if (!content.includes(componentTag)) {
    if (layoutName && layoutName !== 'none') {
      const layoutEndTag = `</${layoutName}>`;
      if (content.includes(layoutEndTag)) {
        const lines = content.split('\n');
        let layoutEndLine = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes(layoutEndTag)) {
            layoutEndLine = i;
            break;
          }
        }
        if (layoutEndLine !== -1) {
          lines.splice(layoutEndLine, 0, `  ${componentTag}`);
          content = lines.join('\n');
        }
      } else {
        // Layout might be self-closing or missing end tag? 
        // If it's Textor generated it should have it.
        content += `\n${componentTag}\n`;
      }
    } else {
      content += `\n${componentTag}\n`;
    }
  }

  return content;
}

/**
 * Feature Template Variables:
 * - componentName: Name of the feature component
 * - scriptImportPath: Path to the feature's client-side script
 */
export function generateFeatureTemplate(componentName, scriptImportPath, framework = 'astro', extension) {
  const templateExtension = extension || (framework === 'astro' ? '.astro' : '.tsx');
  const override = getTemplateOverride('feature', templateExtension, { componentName, scriptImportPath });
  if (override) return override;

  if (framework === 'react') {
    return `export type ${componentName}Props = {
  // Add props here
}

export default function ${componentName}({ }: ${componentName}Props) {
  return (
    <div className="${componentName.toLowerCase()}">
      <h1>${componentName}</h1>
    </div>
  );
}
`;
  }

  const scriptTag = scriptImportPath ? `\n<script src="${scriptImportPath}"></script>` : '';

  return `---
// Feature: ${componentName}
---

<div class="${componentName.toLowerCase()}">
  <h1>${componentName}</h1>
</div>${scriptTag}
`;
}

/**
 * Scripts Index Template (no variables)
 */
export function generateScriptsIndexTemplate() {
  const override = getTemplateOverride('scripts-index', '.ts');
  if (override) return override;

  return `export {};
`;
}

/**
 * Component Template Variables:
 * - componentName: Name of the component
 */
export function generateComponentTemplate(componentName, framework = 'react', extension) {
  const templateExtension = extension || (framework === 'astro' ? '.astro' : '.tsx');
  const override = getTemplateOverride('component', templateExtension, { componentName });
  if (override) return override;

  if (framework === 'react') {
    return `export type ${componentName}Props = {
  // Add props here
}

export default function ${componentName}({ }: ${componentName}Props) {
  return (
    <div className="${componentName.toLowerCase()}">
      {/* ${componentName} implementation */}
    </div>
  );
}
`;
  }

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

/**
 * Hook Template Variables:
 * - componentName: Name of the component
 * - hookName: Name of the hook function (e.g., useButton)
 */
export function generateHookTemplate(componentName, hookName) {
  const override = getTemplateOverride('hook', '.ts', { componentName, hookName });
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

/**
 * Context Template Variables:
 * - componentName: Name of the component
 */
export function generateContextTemplate(componentName) {
  const override = getTemplateOverride('context', '.tsx', { componentName });
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

/**
 * Test Template Variables:
 * - componentName: Name of the component
 * - componentPath: Relative path to the component file
 */
export function generateTestTemplate(componentName, componentPath) {
  const override = getTemplateOverride('test', '.tsx', { componentName, componentPath });
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

/**
 * Config Template Variables:
 * - componentName: Name of the component
 */
export function generateConfigTemplate(componentName) {
  const override = getTemplateOverride('config', '.ts', { componentName });
  if (override) return override;

  return `export const ${componentName}Config = {
  // Add configuration here
};
`;
}

/**
 * Constants Template Variables:
 * - componentName: Name of the component
 */
export function generateConstantsTemplate(componentName) {
  const override = getTemplateOverride('constants', '.ts', { componentName });
  if (override) return override;

  return `export const ${componentName.toUpperCase()}_CONSTANTS = {
  // Add constants here
};
`;
}

/**
 * Index Template Variables:
 * - componentName: Name of the component
 * - componentExtension: File extension of the component
 */
export function generateIndexTemplate(componentName, componentExtension) {
  const override = getTemplateOverride('index', '.ts', { componentName, componentExtension });
  if (override) return override;

  if (componentExtension === '.astro') {
    return `export * from './types';
`;
  }

  return `export { default as ${componentName} } from './${componentName}${componentExtension}';
export * from './types';
`;
}

/**
 * Types Template Variables:
 * - componentName: Name of the component
 */
export function generateTypesTemplate(componentName) {
  const override = getTemplateOverride('types', '.ts', { componentName });
  if (override) return override;

  return `export type ${componentName}Props = {
  // Add props types here
};
`;
}

/**
 * API Template Variables:
 * - componentName: Name of the component
 */
export function generateApiTemplate(componentName) {
  const override = getTemplateOverride('api', '.ts', { componentName });
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

/**
 * Endpoint Template Variables:
 * - componentName: Name of the component
 */
export function generateEndpointTemplate(componentName) {
  const override = getTemplateOverride('endpoint', '.ts', { componentName });
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

/**
 * Service Template Variables:
 * - componentName: Name of the component
 */
export function generateServiceTemplate(componentName) {
  const override = getTemplateOverride('service', '.ts', { componentName });
  if (override) return override;

  return `// ${componentName} business logic and transformers
export async function get${componentName}Data() {
  // Encapsulated logic for data processing
  return [];
}

export function transform${componentName}Data(data: any) {
  // Domain-specific data transformations
  return data;
}
`;
}

/**
 * Schema Template Variables:
 * - componentName: Name of the component
 */
export function generateSchemaTemplate(componentName) {
  const override = getTemplateOverride('schema', '.ts', { componentName });
  if (override) return override;

  return `import { z } from 'zod';

export const ${componentName}Schema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type ${componentName} = z.infer<typeof ${componentName}Schema>;
`;
}

/**
 * Readme Template Variables:
 * - componentName: Name of the component
 */
export function generateReadmeTemplate(componentName) {
  const override = getTemplateOverride('readme', '.md', { componentName });
  if (override) return override;

  return `# ${componentName}

## Description
Brief description of what this feature/component does.

## Props/Usage
How to use this and what are its requirements.
`;
}

/**
 * Stories Template Variables:
 * - componentName: Name of the component
 * - componentPath: Relative path to the component file
 */
export function generateStoriesTemplate(componentName, componentPath) {
  const override = getTemplateOverride('stories', '.tsx', { componentName, componentPath });
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

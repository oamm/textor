import path from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { isTextorGenerated } from '../utils/filesystem.js';
import { loadState } from '../utils/state.js';

export async function listSectionsCommand() {
  try {
    const config = await loadConfig();
    const state = await loadState();
    const pagesRoot = resolvePath(config, 'pages');
    
    console.log('Managed Sections:');
    
    if (!existsSync(pagesRoot)) {
      console.log('  No pages directory found.');
    } else {
      const extensions = [config.naming.routeExtension, '.ts', '.js'];
      const sections = await findGeneratedFiles(pagesRoot, extensions);
      
      if (sections.length === 0) {
        console.log('  No Textor-managed sections found.');
      } else {
        for (const section of sections) {
          const relativePath = path.relative(pagesRoot, section).replace(/\\/g, '/');
          const route = '/' + relativePath
            .replace(/\.[^/.]+$/, ''); // Remove extension
          
          const stateSection = state.sections.find(s => s.route === route);
          const name = stateSection ? stateSection.name : route;
          
          console.log(`  - ${name} [${route}] (${relativePath})`);
          
          if (stateSection) {
              console.log(`    Feature: ${stateSection.featurePath}`);
              console.log(`    Layout: ${stateSection.layout}`);
              
              // Check for senior architecture folders/files
              const featuresRoot = resolvePath(config, 'features');
              const featureDir = path.join(featuresRoot, stateSection.featurePath);
              const capabilities = [];
              
              const checkDir = (subDir, label) => {
                  if (existsSync(path.join(featureDir, subDir))) capabilities.push(label);
              };
              
              checkDir('api', 'API');
              checkDir('services', 'Services');
              checkDir('schemas', 'Schemas');
              checkDir('hooks', 'Hooks');
              checkDir('context', 'Context');
              checkDir('types', 'Types');
              checkDir('scripts', 'Scripts');
              checkDir('sub-components', 'Sub-components');
              checkDir('__tests__', 'Tests');
              
              if (existsSync(path.join(featureDir, 'README.md'))) capabilities.push('Docs');
              
              const storiesFile = (await readdir(featureDir).catch(() => []))
                  .find(f => f.endsWith('.stories.tsx') || f.endsWith('.stories.jsx'));
              if (storiesFile) capabilities.push('Stories');

              if (capabilities.length > 0) {
                  console.log(`    Architecture: ${capabilities.join(', ')}`);
              }
          } else {
            // Try to extract feature path from the file content
            const content = await readFile(section, 'utf-8');
            const featureImportMatch = content.match(/import\s+\w+\s+from\s+'([^']+)'/g);
            if (featureImportMatch) {
              for (const match of featureImportMatch) {
                const pathMatch = match.match(/'([^']+)'/);
                if (pathMatch) {
                  console.log(`    Import: ${pathMatch[1]}`);
                }
              }
            }
          }
        }
      }
    }

    if (state.components && state.components.length > 0) {
      console.log('\nManaged Components:');
      for (const component of state.components) {
        console.log(`  - ${component.name} (${path.relative(process.cwd(), component.path)})`);
        
        const componentDir = component.path;
        const capabilities = [];
        
        const checkDir = (subDir, label) => {
            if (existsSync(path.join(componentDir, subDir))) capabilities.push(label);
        };
        
        checkDir('api', 'API');
        checkDir('services', 'Services');
        checkDir('schemas', 'Schemas');
        checkDir('hooks', 'Hooks');
        checkDir('context', 'Context');
        checkDir('types', 'Types');
        checkDir('sub-components', 'Sub-components');
        checkDir('__tests__', 'Tests');
        checkDir('config', 'Config');
        checkDir('constants', 'Constants');
        
        if (existsSync(path.join(componentDir, 'README.md'))) capabilities.push('Docs');
        
        const storiesFile = (await readdir(componentDir).catch(() => []))
            .find(f => f.endsWith('.stories.tsx') || f.endsWith('.stories.jsx'));
        if (storiesFile) capabilities.push('Stories');

        if (capabilities.length > 0) {
            console.log(`    Architecture: ${capabilities.join(', ')}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function findGeneratedFiles(dir, extensions) {
  const results = [];
  const entries = await readdir(dir);
  const exts = Array.isArray(extensions) ? extensions : [extensions];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      results.push(...await findGeneratedFiles(fullPath, exts));
    } else if (exts.some(ext => entry.endsWith(ext))) {
      if (await isTextorGenerated(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

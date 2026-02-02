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

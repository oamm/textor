import path from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { isTextorGenerated } from '../utils/filesystem.js';

export async function listSectionsCommand() {
  try {
    const config = await loadConfig();
    const pagesRoot = resolvePath(config, 'pages');
    
    console.log('Managed Sections:');
    
    if (!existsSync(pagesRoot)) {
      console.log('  No pages directory found.');
      return;
    }

    const sections = await findGeneratedFiles(pagesRoot, config.naming.routeExtension);
    
    if (sections.length === 0) {
      console.log('  No Textor-managed sections found.');
    } else {
      for (const section of sections) {
        const relativePath = path.relative(pagesRoot, section);
        const route = relativePath
          .replace(/\\/g, '/')
          .replace(new RegExp(`\\${config.naming.routeExtension}$`), '');
        
        console.log(`  - ${route} (${relativePath})`);
        
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
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function findGeneratedFiles(dir, extension) {
  const results = [];
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      results.push(...await findGeneratedFiles(fullPath, extension));
    } else if (entry.endsWith(extension)) {
      if (await isTextorGenerated(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

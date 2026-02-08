import path from 'path';
import { readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { loadConfig, resolvePath } from '../utils/config.js';
import { loadState, saveState, reconstructComponents, reconstructSections } from '../utils/state.js';
import { calculateHash, scanDirectory, inferKind } from '../utils/filesystem.js';

export async function adoptCommand(identifier, options) {
  try {
    const config = await loadConfig();
    const state = await loadState();

    const roots = {
      pages: resolvePath(config, 'pages'),
      features: resolvePath(config, 'features'),
      components: resolvePath(config, 'components')
    };

    let filesToAdopt = [];

    if (!identifier && options.all) {
      // Adopt all untracked files in all roots
      const managedFiles = new Set();
      for (const root of Object.values(roots)) {
        if (existsSync(root)) {
          await scanDirectory(root, managedFiles);
        }
      }
      filesToAdopt = Array.from(managedFiles).filter(f => !state.files[f]);
    } else if (identifier) {
      const untrackedFiles = new Set();
      
      // 1. Try as direct path
      const fullPath = path.resolve(process.cwd(), identifier);
      if (existsSync(fullPath)) {
        await scanDirectoryOrFile(fullPath, untrackedFiles, state);
      }
      
      // 2. Try as component name
      const compPath = path.join(roots.components, identifier);
      if (existsSync(compPath)) {
        await scanDirectoryOrFile(compPath, untrackedFiles, state);
      }

      // 3. Try as feature name
      const featPath = path.join(roots.features, identifier);
      if (existsSync(featPath)) {
        await scanDirectoryOrFile(featPath, untrackedFiles, state);
      }
      
      // 4. Try as route or page name
      const cleanRoute = identifier.startsWith('/') ? identifier.slice(1) : identifier;
      const pagePath = path.join(roots.pages, cleanRoute + (config.naming?.routeExtension || '.astro'));
      if (existsSync(pagePath)) {
        await scanDirectoryOrFile(pagePath, untrackedFiles, state);
      }
      const nestedPagePath = path.join(roots.pages, cleanRoute, config.routing?.indexFile || 'index.astro');
      if (existsSync(nestedPagePath)) {
        await scanDirectoryOrFile(nestedPagePath, untrackedFiles, state);
      }

      filesToAdopt = Array.from(untrackedFiles);

      if (filesToAdopt.length === 0 && !existsSync(fullPath)) {
        throw new Error(`Could not find any untracked files for identifier: ${identifier}`);
      }
    } else {
      throw new Error('Please provide a path/identifier or use --all');
    }

    // Filter to ensure all files are within managed roots
    const rootPaths = Object.values(roots).map(p => path.resolve(p));
    filesToAdopt = filesToAdopt.filter(relPath => {
      const fullPath = path.resolve(process.cwd(), relPath);
      return rootPaths.some(root => fullPath.startsWith(root));
    });

    if (filesToAdopt.length === 0) {
      console.log('No untracked files found to adopt.');
      return;
    }

    console.log(`Found ${filesToAdopt.length} files to adopt...`);
    let adoptedCount = 0;

    for (const relPath of filesToAdopt) {
      const success = await adoptFile(relPath, config, state, options);
      if (success) adoptedCount++;
    }

    if (adoptedCount > 0 && !options.dryRun) {
      state.components = reconstructComponents(state.files, config);
      state.sections = reconstructSections(state, config);
      await saveState(state);
      console.log(`\n✓ Successfully adopted ${adoptedCount} files.`);
    } else if (options.dryRun) {
      console.log(`\nDry run: would adopt ${adoptedCount} files.`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

async function adoptFile(relPath, config, state, options) {
  const fullPath = path.join(process.cwd(), relPath);
  const content = await readFile(fullPath, 'utf-8');
  
  const ext = path.extname(relPath);
  let signature = '';
  if (ext === '.astro') signature = config.signatures.astro;
  else if (ext === '.ts' || ext === '.tsx') signature = config.signatures.typescript;
  else if (ext === '.js' || ext === '.jsx') signature = config.signatures.javascript;

  let finalContent = content;
  const shouldAddSignature = signature && !content.includes(signature) && options.signature !== false;

  if (shouldAddSignature) {
    if (options.dryRun) {
      console.log(`  ~ Would add signature to ${relPath}`);
    } else {
      finalContent = signature + '\n' + content;
      await writeFile(fullPath, finalContent, 'utf-8');
      console.log(`  + Added signature and adopting: ${relPath}`);
    }
  } else {
    if (options.dryRun) {
      if (signature && !content.includes(signature) && options.signature === false) {
        console.log(`  + Would adopt without signature (explicitly requested): ${relPath}`);
      } else {
        console.log(`  + Would adopt (already has signature or no signature for ext): ${relPath}`);
      }
    } else {
      if (signature && !content.includes(signature) && options.signature === false) {
        console.log(`  + Adopting without signature (explicitly requested): ${relPath}`);
      } else {
        console.log(`  + Adopting: ${relPath}`);
      }
    }
  }

  if (!options.dryRun) {
    const hash = calculateHash(finalContent, config.hashing?.normalization);
    state.files[relPath] = {
      kind: inferKind(relPath, config),
      hash: hash,
      timestamp: new Date().toISOString(),
      synced: true,
      hasSignature: options.signature !== false
    };
  }

  return true;
}

async function scanDirectoryOrFile(fullPath, fileSet, state) {
  if ((await stat(fullPath)).isDirectory()) {
    const dirFiles = new Set();
    await scanDirectory(fullPath, dirFiles);
    for (const f of dirFiles) {
      if (!state.files[f]) fileSet.add(f);
    }
  } else {
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
    if (!state.files[relPath]) {
      fileSet.add(relPath);
    }
  }
}

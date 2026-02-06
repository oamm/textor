import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
  DEFAULT_CONFIG,
  CURRENT_CONFIG_VERSION,
  applyConfigMigrations,
  mergeConfig,
  getConfigPath,
  validateConfig
} from '../utils/config.js';

export async function upgradeConfigCommand(options) {
  try {
    const configPath = getConfigPath();

    if (!existsSync(configPath)) {
      throw new Error(
        `Textor configuration not found at ${configPath}\n` +
        `Run 'textor init' to create it.`
      );
    }

    const rawContent = await readFile(configPath, 'utf-8');
    const rawConfig = JSON.parse(rawContent);
    const migrated = applyConfigMigrations(rawConfig);
    const merged = mergeConfig(DEFAULT_CONFIG, migrated);
    merged.configVersion = CURRENT_CONFIG_VERSION;

    validateConfig(merged);

    if (options.dryRun) {
      console.log('Dry run - upgraded configuration:');
      console.log(JSON.stringify(merged, null, 2));
      return;
    }

    await writeFile(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

    console.log('Configuration upgraded successfully.');
    console.log(`  Version: ${rawConfig.configVersion || 1} -> ${CURRENT_CONFIG_VERSION}`);
    console.log(`  Path: ${configPath}`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Error: Failed to parse config: Invalid JSON');
    } else {
      console.error('Error:', error.message);
    }
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

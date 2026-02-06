import { DEFAULT_CONFIG, saveConfig } from '../utils/config.js';

export async function initCommand(options) {
  try {
    const configPath = await saveConfig(DEFAULT_CONFIG, options.force);
    const quiet = options?.quiet || process.env.NODE_ENV === 'test' || process.env.TEXTOR_QUIET === '1';

    if (!quiet) {
      console.log('Textor configuration created at:', configPath);
      console.log('\nDefault configuration:');
      console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
      console.log('\nYou can now use Textor commands like:');
      console.log('  textor add-section /users users/catalog --layout Main');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

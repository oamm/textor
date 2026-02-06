import { loadState, saveState } from '../utils/state.js';

export async function normalizeStateCommand(options) {
  try {
    const state = await loadState();

    if (options.dryRun) {
      console.log('Dry run - normalized state:');
      console.log(JSON.stringify(state, null, 2));
      return;
    }

    await saveState(state);
    console.log('State normalized successfully.');
  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

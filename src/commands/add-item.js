import { loadState, findSection, findComponent } from '../utils/state.js';
import { addSectionCommand } from './add-section.js';
import { createComponentCommand } from './create-component.js';

/**
 * Add a new item (hook, api, service, etc.) to an existing feature or component.
 * 
 * @param {string} itemType The type of item to add (e.g., 'api', 'hook', 'service')
 * @param {string} targetName The name of the feature or component
 * @param {Object} options Additional options from Commander
 */
export async function addItemCommand(itemType, targetName, options) {
  try {
    const state = await loadState();
    
    // Normalize itemType
    let normalizedItem = itemType.toLowerCase();
    if (normalizedItem === 'test') normalizedItem = 'tests';
    if (normalizedItem === 'service') normalizedItem = 'services';
    if (normalizedItem === 'schema') normalizedItem = 'schemas';
    if (normalizedItem === 'hook') normalizedItem = 'hooks'; // for add-section

    // Try to find as section (feature) first
    let section = findSection(state, targetName);
    let component = findComponent(state, targetName);
    
    // If not found by exact name, try to find by featurePath or part of it
    if (!section && !component) {
        section = state.sections.find(s => s.featurePath === targetName || s.featurePath.endsWith('/' + targetName));
    }

    if (!section && !component) {
      throw new Error(`Target not found in state: "${targetName}". Please use "add-section" or "create-component" directly if it's not managed by Textor.`);
    }

    const flags = { [normalizedItem]: true };
    // Also set singular for create-component which uses 'hook'
    if (normalizedItem === 'hooks') flags.hook = true;

    if (section) {
      console.log(`ℹ Adding ${normalizedItem} to feature: ${section.featurePath}`);
      return await addSectionCommand(undefined, section.featurePath, { ...options, ...flags });
    }
    
    if (component) {
      console.log(`ℹ Adding ${normalizedItem} to component: ${component.name}`);
      // For create-component, we might need to be careful with flags that are on by default
      // but getEffectiveOptions should handle it if we pass them explicitly as true.
      return await createComponentCommand(component.name, { ...options, ...flags });
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (typeof process.exit === 'function' && process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

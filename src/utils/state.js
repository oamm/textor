import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CONFIG_DIR = '.textor';
const STATE_FILE = 'state.json';

export function getStatePath() {
  return path.join(process.cwd(), CONFIG_DIR, STATE_FILE);
}

export async function loadState() {
  const statePath = getStatePath();
  if (!existsSync(statePath)) {
    return { sections: [], components: [], files: {} };
  }

  try {
    const content = await readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    if (!state.files) state.files = {};
    return state;
  } catch (error) {
    return { sections: [], components: [], files: {} };
  }
}

export async function saveState(state) {
  const statePath = getStatePath();
  const dir = path.dirname(statePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function registerFile(filePath, { kind, template, hash }) {
  const state = await loadState();
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  
  state.files[normalizedPath] = {
    kind,
    template,
    hash,
    timestamp: new Date().toISOString()
  };
  
  await saveState(state);
}

export async function unregisterFile(filePath) {
  const state = await loadState();
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  delete state.files[normalizedPath];
  await saveState(state);
}

export async function getFileData(filePath) {
  const state = await loadState();
  const normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  return state.files[normalizedPath];
}

export async function addSectionToState(section) {
  const state = await loadState();
  // Avoid duplicates by route
  state.sections = state.sections.filter(s => s.route !== section.route);
  state.sections.push(section);
  await saveState(state);
}

export async function removeSectionFromState(route) {
  const state = await loadState();
  state.sections = state.sections.filter(s => s.route !== route && s.name !== route);
  await saveState(state);
}

export async function updateSectionInState(oldRoute, newSection) {
  const state = await loadState();
  state.sections = state.sections.filter(s => s.route !== oldRoute);
  state.sections.push(newSection);
  await saveState(state);
}

export async function addComponentToState(component) {
  const state = await loadState();
  // Avoid duplicates by name
  state.components = state.components.filter(c => c.name !== component.name);
  state.components.push(component);
  await saveState(state);
}

export async function removeComponentFromState(name) {
  const state = await loadState();
  state.components = state.components.filter(c => c.name !== name);
  await saveState(state);
}

export function findSection(state, identifier) {
  return state.sections.find(s => s.route === identifier || s.name === identifier || s.featurePath === identifier);
}

export function findComponent(state, name) {
  return state.components.find(c => c.name === name);
}

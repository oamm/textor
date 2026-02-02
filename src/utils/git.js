import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function isRepoClean() {
  try {
    const { stdout } = await execAsync('git status --porcelain');
    return stdout.trim() === '';
  } catch (error) {
    // If not a git repo, we consider it clean or at least we can't check
    return true;
  }
}

export async function stageFiles(filePaths) {
  if (!filePaths.length) return;
  try {
    const paths = filePaths.map(p => `"${p}"`).join(' ');
    await execAsync(`git add ${paths}`);
  } catch (error) {
    // Ignore errors if git is not available
  }
}

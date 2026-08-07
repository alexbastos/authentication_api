import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (err) {
    return null;
  }
}

function generateVersion() {
  const rootDir = resolve(__dirname, '..');
  const isGitRepo = existsSync(resolve(rootDir, '.git'));
  
  const versionInfo = {
    branch: 'unknown',
    commit: 'unknown',
    date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  };

  if (isGitRepo) {
    const branch = runGitCommand('git rev-parse --abbrev-ref HEAD');
    const commit = runGitCommand('git rev-parse --short HEAD');
    
    if (branch) versionInfo.branch = branch;
    if (commit) versionInfo.commit = commit;
  }

  const outputPath = resolve(rootDir, 'version.json');
  
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), 'utf8');
  console.log(`[Build] Version file generated at ${outputPath}`);
}

generateVersion();

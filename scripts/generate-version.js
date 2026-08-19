import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function generateVersion() {
  const rootDir = resolve(__dirname, '..');
  const isGitRepo = existsSync(resolve(rootDir, '.git'));

  // Lê do git se disponível (dev local), senão lê das env vars (Docker build)
  const branch =
    (isGitRepo ? runGitCommand('git rev-parse --abbrev-ref HEAD') : null) ??
    process.env.GIT_BRANCH ??
    'unknown';

  const commit =
    (isGitRepo ? runGitCommand('git rev-parse --short HEAD') : null) ??
    process.env.GIT_COMMIT ??
    'unknown';

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const versionInfo = { branch, commit, date };

  const outputPath = resolve(rootDir, 'version.json');
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2), 'utf8');
  console.log(`[Build] Version: branch=${branch} commit=${commit} date=${date}`);
}

generateVersion();

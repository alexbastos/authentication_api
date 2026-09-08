const { execSync } = require('node:child_process');
const { writeFileSync, existsSync, mkdirSync } = require('node:fs');
const { resolve, dirname } = require('node:path');

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
    process.env.GIT_BRANCH ??
    (isGitRepo ? runGitCommand('git rev-parse --abbrev-ref HEAD') : null) ??
    'unknown';

  const commit =
    process.env.GIT_COMMIT ??
    (isGitRepo ? runGitCommand('git rev-parse --short HEAD') : null) ??
    'unknown';

  const date = process.env.BUILD_DATE
    || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

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

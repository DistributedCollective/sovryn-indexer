#!/usr/bin/env node

const { execSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

function resolveCommitId() {
  const envCommitId = process.env.GIT_COMMIT || process.env.COMMIT_SHA || process.env.SOURCE_VERSION;
  if (envCommitId && envCommitId.trim()) {
    return envCommitId.trim();
  }

  try {
    return execSync('git rev-parse --short=12 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const buildInfo = {
  gitCommitId: resolveCommitId(),
};

const outputPath = join(process.cwd(), 'src/generated/build-info.ts');
const fileContents = `// Auto-generated at build time by scripts/generate-build-info.js.\nexport const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)} as const;\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, fileContents, 'utf8');

console.log(`Generated ${outputPath} with gitCommitId=${buildInfo.gitCommitId}`);

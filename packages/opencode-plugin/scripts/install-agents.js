#!/usr/bin/env node

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const AGENTS = [
  'boomerang.md',
  'boomerang-architect.md',
  'boomerang-coder.md',
  'boomerang-explorer.md',
  'boomerang-git.md',
  'boomerang-handoff.md',
  'boomerang-init.md',
  'boomerang-linter.md',
  'boomerang-scraper.md',
  'boomerang-tester.md',
  'boomerang-writer.md',
  'researcher.md',
];

const BASE_URL = 'https://raw.githubusercontent.com/Veedubin/opencode-boomerang/main/agents';

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const cwd = process.cwd();
  const opencodeDir = path.join(cwd, '.opencode');
  const agentsDir = path.join(opencodeDir, 'agents');

  console.log(`📁 Working directory: ${cwd}`);
  console.log(`📂 Creating ${agentsDir}...`);

  fs.mkdirSync(agentsDir, { recursive: true });

  for (const agent of AGENTS) {
    const url = `${BASE_URL}/${agent}`;
    const dest = path.join(agentsDir, agent);
    process.stdout.write(`⬇️  Downloading ${agent}... `);
    try {
      const content = await download(url);
      fs.writeFileSync(dest, content);
      console.log('✅');
    } catch (err) {
      console.log(`❌ (${err.message})`);
    }
  }

  const configPath = path.join(opencodeDir, 'opencode.json');
  if (!fs.existsSync(configPath)) {
    console.log('⚙️  Creating opencode.json...');
    const config = {
      plugins: ['@veedubin/boomerang-v2'],
      mcpServers: {
        'super-memory-ts': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
        },
        'sequential-thinking': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Created opencode.json');
  } else {
    console.log('ℹ️  opencode.json already exists, skipping');
  }

  console.log('\n✨ Done! Agents installed to .opencode/agents/');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
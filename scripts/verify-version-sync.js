#!/usr/bin/env node
/**
 * Version Sync Verification Script
 * Ensures all version-bearing files have the same version number
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const files = [
  'package.json',
  'packages/opencode-plugin/package.json',
];

const versions = {};
let hasErrors = false;

for (const file of files) {
  try {
    const content = readFileSync(file, 'utf8');

    if (file.endsWith('.json')) {
      const json = JSON.parse(content);
      versions[file] = json.version;
    }
  } catch (err) {
    console.error(`❌ Cannot read ${file}: ${err.message}`);
    hasErrors = true;
  }
}

const uniqueVersions = [...new Set(Object.values(versions))];

console.log('\n📋 Version Check Results:\n');
for (const [file, version] of Object.entries(versions)) {
  console.log(`  ${file}: ${version}`);
}

if (uniqueVersions.length === 0) {
  console.error('\n❌ No versions found in any files!');
  process.exit(1);
} else if (uniqueVersions.length > 1) {
  console.error(`\n❌ VERSION MISMATCH! Found ${uniqueVersions.length} different versions:`);
  for (const v of uniqueVersions) {
    const filesWithVersion = Object.entries(versions)
      .filter(([, ver]) => ver === v)
      .map(([f]) => f);
    console.error(`  ${v}: ${filesWithVersion.join(', ')}`);
  }
  process.exit(1);
} else {
  console.log(`\n✅ All files synced at version ${uniqueVersions[0]}`);
  process.exit(0);
}
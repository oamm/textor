#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve } from 'path';

console.log('🔍 Textor Validation\n');

const checks = [
  {
    name: 'Package.json exists',
    check: () => existsSync(resolve('package.json')),
  },
  {
    name: 'CLI entry point exists',
    check: () => existsSync(resolve('bin/textor.js')),
  },
  {
    name: 'Config utilities exist',
    check: () => existsSync(resolve('src/utils/config.js')),
  },
  {
    name: 'Naming utilities exist',
    check: () => existsSync(resolve('src/utils/naming.js')),
  },
  {
    name: 'Filesystem utilities exist',
    check: () => existsSync(resolve('src/utils/filesystem.js')),
  },
  {
    name: 'Template utilities exist',
    check: () => existsSync(resolve('src/utils/templates.js')),
  },
  {
    name: 'Init command exists',
    check: () => existsSync(resolve('src/commands/init.js')),
  },
  {
    name: 'Add-section command exists',
    check: () => existsSync(resolve('src/commands/add-section.js')),
  },
  {
    name: 'Remove-section command exists',
    check: () => existsSync(resolve('src/commands/remove-section.js')),
  },
  {
    name: 'Move-section command exists',
    check: () => existsSync(resolve('src/commands/move-section.js')),
  },
  {
    name: 'Create-component command exists',
    check: () => existsSync(resolve('src/commands/create-component.js')),
  },
  {
    name: 'Tests exist',
    check: () => existsSync(resolve('test/naming.test.js')),
  },
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, check }) => {
  const result = check();
  if (result) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 Textor is properly installed!\n');
  console.log('Next steps:');
  console.log('  1. Run: textor init');
  console.log('  2. Run: textor add-section /users users/catalog --layout Main');
  console.log('  3. Read: README.md for full documentation\n');
} else {
  console.log('⚠️  Some files are missing. Please check the installation.\n');
  process.exit(1);
}

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'path',
  'fs',
  'fs/promises',
  'process',
  'url'
];

const stripShebang = () => ({
  name: 'strip-shebang',
  transform(code) {
    return code.replace(/^#!.*?\n/, '');
  }
});

export default [
  // CLI Bundle
  {
    input: 'bin/textor.js',
    output: {
      file: 'dist/bin/textor.js',
      format: 'es',
      banner: '#!/usr/bin/env node',
      sourcemap: true,
    },
    plugins: [
      stripShebang(),
      resolve({ preferBuiltins: true }),
      commonjs(),
    ],
    external,
  },
  // Library Bundle
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
      }
    ],
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
      }),
    ],
    external,
  },
  // Type definitions
  {
    input: 'dist/src/index.d.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];

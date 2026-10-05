import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THREE = join(ROOT, 'node_modules', 'three');
const OUT = join(ROOT, 'vendor', 'three');

const FILES = [
  'build/three.module.js',
  'build/three.core.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/utils/BufferGeometryUtils.js',
  'examples/jsm/utils/SkeletonUtils.js',
];

for (const file of FILES) {
  await build({
    entryPoints: [join(THREE, file)],
    outfile: join(OUT, file),
    format: 'esm',
    minify: true,
    legalComments: 'inline',
    logLevel: 'warning',
  });
  console.log(`vendor/three/${file}`);
}

await mkdir(OUT, { recursive: true });
await copyFile(join(THREE, 'LICENSE'), join(OUT, 'LICENSE'));
console.log('vendor/three/LICENSE');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

function precacheList() {
  const source = read('service-worker.js');
  const block = source.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)[1];
  return [...block.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
}

function localImports(file) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const found = new Set();
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["'](\.[^"']+)["']/g)) {
    found.add(normalize(join(dirname(file), match[1])));
  }
  return [...found];
}

test('todo arquivo do cache existe e o index.html está na lista', () => {
  const list = precacheList();
  assert.ok(list.includes('index.html'));
  for (const path of list) assert.ok(existsSync(join(ROOT, path)), `${path} não existe`);
});

test('todos os módulos JS locais, o CSS e o manifest estão no cache offline', () => {
  const list = new Set(precacheList());
  const modules = readdirSync(join(ROOT, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`);
  for (const path of [...modules, 'css/styles.css', 'manifest.json']) {
    assert.ok(list.has(path), `${path} falta em PRECACHE_URLS`);
  }
});

test('as importações relativas de cada módulo e do vendor existem e estão no cache', () => {
  const list = new Set(precacheList());
  const queue = ['js/app.js', 'js/heart-scene.js', 'js/model-loader.js'];
  const visited = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    for (const target of localImports(file)) {
      assert.ok(existsSync(join(ROOT, target)), `${file} importa ${target}, que não existe`);
      assert.ok(list.has(target), `${target} (importado por ${file}) falta no cache`);
      queue.push(target);
    }
  }
});

test('o import map aponta para arquivos locais existentes e no cache', () => {
  const html = read('index.html');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  const list = new Set(precacheList());
  for (const [name, url] of Object.entries(map.imports)) {
    assert.ok(url.startsWith('./vendor/'), `${name} deve ser local`);
    if (!url.endsWith('/')) assert.ok(list.has(url.slice(2)), `${url} falta no cache`);
  }
  for (const file of ['build/three.module.js', 'build/three.core.js']) {
    assert.ok(list.has(`vendor/three/${file}`));
  }
});

test('o manifest é válido e os ícones existem com o tamanho declarado', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'pt-BR');
  assert.ok(manifest.start_url && manifest.scope);
  const purposes = manifest.icons.map((icon) => icon.purpose);
  assert.ok(purposes.includes('maskable') && purposes.includes('any'));
  for (const icon of manifest.icons) {
    const file = join(ROOT, icon.src);
    assert.ok(existsSync(file), `${icon.src} não existe`);
    if (icon.type === 'image/png') {
      const buffer = readFileSync(file);
      assert.equal(buffer.readUInt32BE(16), Number(icon.sizes.split('x')[0]), icon.src);
    }
  }
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
});

test('o hash do import map na CSP confere com o conteúdo do index.html', async () => {
  const { createHash } = await import('node:crypto');
  const html = read('index.html');
  const body = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
  const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`;
  assert.ok(html.includes(`'${hash}'`), 'atualize o hash da CSP depois de mudar o import map');
});

test('não há referências a servidores externos no código do app', () => {
  const files = ['index.html', 'css/styles.css', 'manifest.json', 'service-worker.js']
    .concat(readdirSync(join(ROOT, 'js')).map((name) => `js/${name}`));
  for (const file of files) {
    const source = read(file);
    const urls = source.match(/https?:\/\/[^\s"')]+/g) ?? [];
    const external = urls.filter((url) => !url.startsWith('http://www.w3.org/'));
    assert.deepEqual(external, [], `${file} referencia recurso externo`);
  }
});

test('a licença do Three.js acompanha a pasta vendor', () => {
  const found = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(join(ROOT, 'vendor'), full));
    }
  })(join(ROOT, 'vendor'));
  assert.ok(found.includes('three/LICENSE'), 'a licença do Three.js deve acompanhar o vendor');
});

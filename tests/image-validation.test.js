import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessImage, formatBytes, validateFile } from '../js/image-validation.js';

test('aceita JPEG, PNG e WebP', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validateFile({ type, size: 1000, name: 'ecg' }).ok, true, type);
  }
});

test('aceita tipo vazio apenas quando a extensão é suportada', () => {
  assert.equal(validateFile({ type: '', size: 10, name: 'ECG.JPG' }).ok, true);
  assert.equal(validateFile({ type: '', size: 10, name: 'exame.pdf' }).code, 'type');
  assert.equal(validateFile({ type: '', size: 10, name: 'semextensao' }).code, 'type');
});

test('rejeita formatos não suportados e orienta sobre HEIC', () => {
  const pdf = validateFile({ type: 'application/pdf', size: 10, name: 'a.pdf' });
  assert.equal(pdf.ok, false);
  assert.equal(pdf.code, 'type');
  const heic = validateFile({ type: 'image/heic', size: 10, name: 'a.heic' });
  assert.match(heic.message, /HEIC/);
});

test('rejeita arquivo vazio e acima do limite', () => {
  assert.equal(validateFile({ type: 'image/png', size: 0, name: 'a.png' }).code, 'empty');
  const big = validateFile({ type: 'image/png', size: 26 * 1024 * 1024, name: 'a.png' });
  assert.equal(big.code, 'size');
  assert.match(big.message, /26,0 MB/);
});

test('formatBytes usa unidades legíveis', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5,0 MB');
});

test('avisa sobre baixa resolução, orientação vertical e imagem enorme', () => {
  const codes = (dims) => assessImage(dims).map((w) => w.code);
  assert.deepEqual(codes({ width: 2400, height: 1200 }), []);
  assert.deepEqual(codes({ width: 800, height: 600 }), ['low-resolution']);
  assert.deepEqual(codes({ width: 1300, height: 2400 }), ['portrait']);
  assert.deepEqual(codes({ width: 9000, height: 7000 }), ['very-large']);
});

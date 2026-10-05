import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNoise3D, fbm3 } from '../js/noise.js';

test('o ruído é determinístico para a mesma semente', () => {
  const a = createNoise3D(5);
  const b = createNoise3D(5);
  for (const [x, y, z] of [[0.3, 1.7, 2.2], [-4.1, 0.5, 9.9], [100.25, -3.5, 0.01]]) {
    assert.equal(a(x, y, z), b(x, y, z));
  }
});

test('sementes diferentes produzem campos diferentes', () => {
  const a = createNoise3D(1);
  const b = createNoise3D(2);
  const samples = Array.from({ length: 20 }, (_, i) => [i * 0.37 + 0.1, i * 0.21 + 0.2, i * 0.13 + 0.3]);
  assert.ok(samples.some(([x, y, z]) => a(x, y, z) !== b(x, y, z)));
});

test('os valores ficam em [-1, 1], inclusive no fbm, e a função é contínua', () => {
  const noise = createNoise3D(7);
  let previous = noise(0, 0, 0);
  for (let i = 1; i <= 2000; i++) {
    const t = i * 0.01;
    const value = noise(t, t * 0.7, t * 1.3);
    assert.ok(value >= -1 && value <= 1);
    assert.ok(Math.abs(value - previous) < 0.25, 'salto brusco no ruído');
    previous = value;
    const fractal = fbm3(noise, t, t * 0.5, t * 0.25, 4);
    assert.ok(fractal >= -1 && fractal <= 1);
  }
});

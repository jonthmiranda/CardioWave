import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { computeFitDistance } from '../js/heart-scene.js';
import { normalizeModel } from '../js/model-loader.js';

function projectedExtent(distance, { verticalFovDeg, aspect, halfWidth, halfHeight }) {
  const vertical = THREE.MathUtils.degToRad(verticalFovDeg) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return { y: Math.tan(vertical) * distance / halfHeight, x: Math.tan(horizontal) * distance / halfWidth };
}

test('a distância de enquadramento faz o objeto caber na vertical e na horizontal', () => {
  for (const aspect of [0.5, 0.75, 1, 1.6, 2.4]) {
    const params = { verticalFovDeg: 34, aspect, halfWidth: 3, halfHeight: 3.2, margin: 1 };
    const distance = computeFitDistance(params);
    const ratio = projectedExtent(distance, params);
    assert.ok(ratio.y >= 1 - 1e-9 && ratio.x >= 1 - 1e-9, `aspect ${aspect}`);
    assert.ok(Math.min(ratio.x, ratio.y) < 1 + 1e-9, 'a distância deve ser justa em um dos eixos');
  }
});

test('em telas estreitas a distância cresce', () => {
  const base = { verticalFovDeg: 34, halfWidth: 3, halfHeight: 3.2 };
  assert.ok(computeFitDistance({ ...base, aspect: 0.5 }) > computeFitDistance({ ...base, aspect: 1.5 }));
});

test('normalizeModel centraliza e escala o modelo para a altura alvo', () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 4));
  mesh.position.set(7, -3, 5);
  root.add(mesh);
  const wrapper = normalizeModel(root, 6.4);
  const box = new THREE.Box3().setFromObject(wrapper);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(size.y - 6.4) < 1e-6);
  assert.ok(centre.length() < 1e-6);
});

test('normalizeModel rejeita modelos sem geometria', () => {
  assert.throws(() => normalizeModel(new THREE.Group(), 6.4), /geometria/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  CHAMBER_SPECS,
  VESSEL_SPECS,
  buildProceduralHeart,
  fieldValue,
  getAnchorPoint,
  getChamberSpec,
} from '../js/heart-geometry.js';

const heart = buildProceduralHeart();

test('o coração tem as quatro câmaras e os grandes vasos', () => {
  const groups = new Set(CHAMBER_SPECS.map((spec) => spec.group));
  assert.deepEqual([...groups].sort(), ['LA', 'LV', 'RA', 'RV']);
  for (const id of ['aorta', 'pulmonaryTrunk', 'superiorVenaCava', 'inferiorVenaCava']) {
    assert.ok(heart.parts[id], `falta ${id}`);
  }
  const veins = Object.keys(heart.parts).filter((id) => /PulmonaryVein$/.test(id));
  assert.equal(veins.length, 4);
  assert.ok(heart.parts.leftAnteriorDescendingArtery, 'falta a artéria descendente anterior');
  assert.ok(heart.parts.rightCoronaryArtery, 'falta a artéria coronária direita');
});

test('cada peça tem vértices finitos, normais e cores', () => {
  for (const [id, mesh] of Object.entries(heart.parts)) {
    const { position, normal, color } = mesh.geometry.attributes;
    assert.ok(position.count > 0, id);
    assert.equal(normal.count, position.count, id);
    assert.equal(color.count, position.count, id);
    for (const value of position.array) assert.ok(Number.isFinite(value), `${id} tem vértice inválido`);
  }
});

test('as dimensões do conjunto são plausíveis e a altura permite normalização', () => {
  const size = heart.bounds.getSize(new THREE.Vector3());
  assert.ok(size.y > 5 && size.y < 8);
  assert.ok(size.x > 4 && size.x < 7);
  assert.ok(size.z > 2.5 && size.z < 5);
});

test('os vasos ancorados nascem dentro da câmara correspondente', () => {
  for (const vessel of VESSEL_SPECS.filter((spec) => spec.anchor)) {
    const chamber = getChamberSpec(vessel.anchor.chamber);
    const value = fieldValue(chamber, getAnchorPoint(vessel));
    assert.ok(value < 1, `${vessel.id} começa fora de ${chamber.id} (campo ${value.toFixed(2)})`);
  }
});

test('a construção é determinística', () => {
  const again = buildProceduralHeart();
  const a = heart.parts.leftVentricle.geometry.attributes.position.array;
  const b = again.parts.leftVentricle.geometry.attributes.position.array;
  assert.equal(a.length, b.length);
  assert.deepEqual(Array.from(a.slice(0, 300)), Array.from(b.slice(0, 300)));
  again.dispose();
});

test('dispose libera geometrias e materiais sem lançar erro', () => {
  const disposed = [];
  const probe = buildProceduralHeart();
  const first = probe.parts.aorta;
  first.geometry.addEventListener('dispose', () => disposed.push('geometry'));
  first.material.addEventListener('dispose', () => disposed.push('material'));
  probe.dispose();
  assert.deepEqual(disposed.sort(), ['geometry', 'material']);
});

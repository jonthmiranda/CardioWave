import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise3D, fbm3 } from './noise.js';
import { disposeObject3D } from './three-utils.js';

const noise = createNoise3D(11);
const smoothstep = THREE.MathUtils.smoothstep;

const GROOVE_DEPTH = 0.075;
const FAT_COLOR = new THREE.Color('#e6bf78');

function prepareChamber(spec) {
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation));
  const inverse = new THREE.Matrix4().makeRotationFromQuaternion(quat.clone().invert()).elements;
  return {
    flatten: null,
    detail: 24,
    ...spec,
    center: new THREE.Vector3(...spec.center),
    quat,
    inverse,
    color: new THREE.Color(spec.color),
  };
}

export const CHAMBER_SPECS = [
  {
    id: 'leftVentricle', group: 'LV', seed: 1.3,
    center: [0.45, -0.55, -0.45], radii: [1.3, 2.05, 1.2], rotation: [-0.28, 0, 0.42],
    taper: 0.5, lump: 0.03, color: '#8f1d29',
  },
  {
    id: 'rightVentricle', group: 'RV', seed: 4.1,
    center: [-0.55, -0.45, 0.5], radii: [1.3, 1.7, 0.9], rotation: [-0.12, 0, 0.3],
    taper: 0.45, lump: 0.03, color: '#a3283a', flatten: { sign: -1, k: 0.45 },
  },
  {
    id: 'rightAtrium', group: 'RA', seed: 7.7,
    center: [-1.55, 0.95, 0.05], radii: [0.85, 1.05, 0.85], rotation: [0, 0, 0.1],
    taper: 0, lump: 0.045, color: '#b04050',
  },
  {
    id: 'rightAuricle', group: 'RA', seed: 2.9, detail: 16,
    center: [-0.85, 1.5, 0.72], radii: [0.62, 0.5, 0.4], rotation: [0.3, 0.4, -0.5],
    taper: 0, lump: 0.06, color: '#a83a4b',
  },
  {
    id: 'leftAtrium', group: 'LA', seed: 9.4,
    center: [0.55, 1.2, -1.0], radii: [1.35, 0.8, 0.8], rotation: [0, 0, -0.12],
    taper: 0, lump: 0.04, color: '#b24455',
  },
  {
    id: 'leftAuricle', group: 'LA', seed: 5.6, detail: 16,
    center: [1.5, 1.0, 0.3], radii: [0.5, 0.62, 0.34], rotation: [0.2, -0.5, -0.35],
    taper: 0, lump: 0.07, color: '#a83c4e',
  },
].map(prepareChamber);

const chamberById = Object.fromEntries(CHAMBER_SPECS.map((spec) => [spec.id, spec]));

function taperFactor(spec, yNormalized) {
  return 1 - spec.taper * smoothstep(-yNormalized, -0.15, 1);
}

function fieldXYZ(spec, x, y, z) {
  const m = spec.inverse;
  const dx = x - spec.center.x;
  const dy = y - spec.center.y;
  const dz = z - spec.center.z;
  const lx = m[0] * dx + m[4] * dy + m[8] * dz;
  const ly = m[1] * dx + m[5] * dy + m[9] * dz;
  const lz = m[2] * dx + m[6] * dy + m[10] * dz;
  const [rx, ry, rz] = spec.radii;
  const yn = THREE.MathUtils.clamp(ly / ry, -1.2, 1.2);
  const k = Math.max(taperFactor(spec, yn), 0.04);
  let sz = rz * k;
  if (spec.flatten && lz * spec.flatten.sign > 0) sz *= 1 - spec.flatten.k;
  return (lx / (rx * k)) ** 2 + yn * yn + (lz / sz) ** 2;
}

export function fieldValue(spec, point) {
  return fieldXYZ(spec, point.x, point.y, point.z);
}

function createUnitSphere(detail) {
  const source = new THREE.IcosahedronGeometry(1, detail);
  source.deleteAttribute('normal');
  source.deleteAttribute('uv');
  const merged = mergeVertices(source, 1e-4);
  source.dispose();
  return merged;
}

function buildChamberGeometry(spec) {
  const geometry = createUnitSphere(spec.detail);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const neighbours = CHAMBER_SPECS.filter((other) => other.group !== spec.group);
  const [rx, ry, rz] = spec.radii;

  const unit = new THREE.Vector3();
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    unit.fromBufferAttribute(position, i);
    const s = spec.seed;
    const lumpiness =
      1 +
      spec.lump * fbm3(noise, unit.x * 2.1 + s, unit.y * 2.1, unit.z * 2.1, 3) +
      0.012 * fbm3(noise, unit.x * 5 + s, unit.y * 5, unit.z * 5, 2);

    const k = taperFactor(spec, unit.y);
    let z = unit.z * k * rz;
    if (spec.flatten && unit.z * spec.flatten.sign > 0) z *= 1 - spec.flatten.k;
    point.set(unit.x * k * rx, unit.y * ry, z).multiplyScalar(lumpiness);
    point.applyQuaternion(spec.quat).add(spec.center);

    let crevice = 0;
    for (const other of neighbours) {
      const field = fieldXYZ(other, point.x, point.y, point.z);
      crevice = Math.max(crevice, 1 - smoothstep(field, 1.0, 1.45));
    }
    if (crevice > 0) {
      direction.copy(point).sub(spec.center).normalize();
      point.addScaledVector(direction, -GROOVE_DEPTH * crevice);
    }
    position.setXYZ(i, point.x, point.y, point.z);

    const shade = 0.93 + 0.14 * fbm3(noise, point.x * 2.6 + s, point.y * 2.6, point.z * 2.6, 3);
    const occlusion = 1 - 0.5 * crevice ** 1.5;
    const fat =
      smoothstep(crevice, 0.3, 0.85) * smoothstep(fbm3(noise, point.x * 4 + 9, point.y * 4, point.z * 4, 2), -0.25, 0.3);
    color.copy(spec.color).multiplyScalar(shade * occlusion).lerp(FAT_COLOR, fat * 0.85);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildTubeGeometry({ points, radius, color, radialSegments = 20, tubularSegments = 80, capStart = false, capEnd = true, seed = 0 }) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  );
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const base = new THREE.Color(color);
  const lumen = base.clone().multiplyScalar(0.4);
  const shaded = new THREE.Color();

  const positions = [];
  const colors = [];
  const indices = [];
  const centre = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const ringAt = (i, radiusScale = 1, tint = null) => {
    const t = i / tubularSegments;
    curve.getPointAt(t, centre);
    const r = radius(t) * radiusScale;
    const first = positions.length / 3;
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      normal.copy(frames.normals[i]).multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle));
      const wobble = 1 + 0.035 * fbm3(noise, centre.x * 3 + seed + normal.x, centre.y * 3 + normal.y, centre.z * 3 + normal.z, 2);
      positions.push(centre.x + normal.x * r * wobble, centre.y + normal.y * r * wobble, centre.z + normal.z * r * wobble);
      const variation = 0.92 + 0.16 * fbm3(noise, centre.x * 2.4 + seed, centre.y * 2.4 + normal.y, centre.z * 2.4 + normal.z, 2);
      shaded.copy(tint ?? base).multiplyScalar(tint ? 1 : variation);
      colors.push(shaded.r, shaded.g, shaded.b);
    }
    return first;
  };

  const rings = [];
  for (let i = 0; i <= tubularSegments; i++) rings.push(ringAt(i));
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = rings[i] + j;
      const b = rings[i] + ((j + 1) % radialSegments);
      const c = rings[i + 1] + j;
      const d = rings[i + 1] + ((j + 1) % radialSegments);
      indices.push(a, b, c, b, d, c);
    }
  }

  const addCap = (ringIndex, facesForward) => {
    const first = ringAt(ringIndex, 1, lumen);
    const hub = positions.length / 3;
    curve.getPointAt(ringIndex / tubularSegments, centre);
    positions.push(centre.x, centre.y, centre.z);
    colors.push(lumen.r * 0.6, lumen.g * 0.6, lumen.b * 0.6);
    for (let j = 0; j < radialSegments; j++) {
      const current = first + j;
      const next = first + ((j + 1) % radialSegments);
      if (facesForward) indices.push(hub, current, next);
      else indices.push(hub, next, current);
    }
  };
  if (capStart) addCap(0, false);
  if (capEnd) addCap(tubularSegments, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, curve };
}

const bump = (t, centre, width) => Math.exp(-(((t - centre) / width) ** 2));

export const VESSEL_SPECS = [
  {
    id: 'aorta', anchor: { chamber: 'leftVentricle', end: 'start' }, color: '#c94a52', capEnd: true,
    points: [[-0.25, 0.55, -0.15], [-0.05, 1.35, -0.25], [0.1, 2.05, -0.4], [0.35, 2.7, -0.62], [0.8, 2.95, -0.8], [1.2, 2.7, -0.95], [1.35, 2.1, -1.05], [1.38, 1.2, -1.15], [1.32, 0.2, -1.25], [1.25, -0.6, -1.3]],
    radius: (t) => 0.42 * (1 + 0.22 * bump(t, 0.07, 0.07)) * (1 - 0.18 * smoothstep(t, 0.5, 1)),
  },
  {
    id: 'brachiocephalicTrunk', color: '#c94a52',
    points: [[0.2, 2.72, -0.58], [0.1, 3.2, -0.52], [0.0, 3.75, -0.46]], radius: () => 0.17,
  },
  {
    id: 'leftCarotidArtery', color: '#c94a52',
    points: [[0.58, 2.9, -0.72], [0.62, 3.4, -0.7], [0.66, 3.88, -0.66]], radius: () => 0.13,
  },
  {
    id: 'leftSubclavianArtery', color: '#c94a52',
    points: [[0.95, 2.88, -0.88], [1.08, 3.28, -0.86], [1.38, 3.62, -0.8]], radius: () => 0.15,
  },
  {
    id: 'pulmonaryTrunk', anchor: { chamber: 'rightVentricle', end: 'start' }, color: '#5d70c4', capEnd: false,
    points: [[-0.8, 1.0, 0.55], [-0.58, 1.7, 0.5], [-0.25, 2.25, 0.28], [0.12, 2.55, 0.1]],
    radius: (t) => 0.4 * (1 + 0.12 * bump(t, 0.05, 0.08)),
  },
  {
    id: 'leftPulmonaryArtery', color: '#5d70c4',
    points: [[0.05, 2.5, 0.1], [0.85, 2.58, -0.4], [1.65, 2.35, -0.8], [2.2, 1.95, -0.95]], radius: (t) => 0.27 - 0.05 * t,
  },
  {
    id: 'rightPulmonaryArtery', color: '#5d70c4',
    points: [[0.05, 2.5, 0.05], [-0.4, 2.42, -0.5], [-1.1, 2.32, -0.85], [-1.85, 2.2, -0.9]], radius: (t) => 0.27 - 0.05 * t,
  },
  {
    id: 'superiorVenaCava', anchor: { chamber: 'rightAtrium', end: 'start' }, color: '#4a5aae',
    points: [[-1.5, 1.55, 0.0], [-1.52, 2.5, -0.1], [-1.5, 3.55, -0.15]], radius: () => 0.3,
  },
  {
    id: 'inferiorVenaCava', anchor: { chamber: 'rightAtrium', end: 'start' }, color: '#4a5aae',
    points: [[-1.6, 0.5, -0.15], [-1.65, -0.5, -0.3], [-1.7, -1.25, -0.35]], radius: () => 0.34,
  },
  {
    id: 'rightSuperiorPulmonaryVein', anchor: { chamber: 'leftAtrium', end: 'start' }, color: '#c0485a',
    points: [[-0.35, 1.5, -1.1], [-1.3, 1.75, -1.45], [-2.0, 1.8, -1.6]], radius: () => 0.17,
  },
  {
    id: 'rightInferiorPulmonaryVein', anchor: { chamber: 'leftAtrium', end: 'start' }, color: '#c0485a',
    points: [[-0.4, 0.95, -1.15], [-1.3, 0.9, -1.5], [-2.0, 0.7, -1.65]], radius: () => 0.17,
  },
  {
    id: 'leftSuperiorPulmonaryVein', anchor: { chamber: 'leftAtrium', end: 'start' }, color: '#c0485a',
    points: [[1.3, 1.55, -1.2], [2.1, 1.8, -1.45], [2.7, 1.9, -1.5]], radius: () => 0.17,
  },
  {
    id: 'leftInferiorPulmonaryVein', anchor: { chamber: 'leftAtrium', end: 'start' }, color: '#c0485a',
    points: [[1.4, 0.95, -1.1], [2.1, 0.85, -1.4], [2.7, 0.7, -1.5]], radius: () => 0.17,
  },
];

export function getAnchorPoint(vesselSpec) {
  const { points } = vesselSpec;
  const raw = vesselSpec.anchor.end === 'start' ? points[0] : points[points.length - 1];
  return new THREE.Vector3(...raw);
}

export function getChamberSpec(id) {
  return chamberById[id];
}

function surfaceZ(x, y, side, specs) {
  const step = 0.1;
  let previous = side * 3.4;
  for (let z = previous; Math.abs(z) <= 3.4; z -= side * step) {
    for (const spec of specs) {
      if (fieldXYZ(spec, x, y, z) < 1) {
        let outside = previous;
        let inside = z;
        for (let i = 0; i < 6; i++) {
          const mid = (outside + inside) / 2;
          if (specs.some((s) => fieldXYZ(s, x, y, mid) < 1)) inside = mid;
          else outside = mid;
        }
        return (outside + inside) / 2;
      }
    }
    previous = z;
  }
  return null;
}

function traceGroove(first, second, { axis, values, range, side }) {
  const probe = new THREE.Vector3();
  const found = [];
  for (const value of values) {
    let best = null;
    const evaluate = (scan) => {
      const x = axis === 'y' ? scan : value;
      const y = axis === 'y' ? value : scan;
      const z = surfaceZ(x, y, side, CHAMBER_SPECS);
      if (z === null) return;
      probe.set(x, y, z);
      const cost = Math.abs(fieldValue(first, probe) - 1) + Math.abs(fieldValue(second, probe) - 1);
      if (!best || cost < best.cost) best = { cost, x, y, z };
    };
    for (let scan = range[0]; scan <= range[1]; scan += 0.1) evaluate(scan);
    if (!best) continue;
    const centre = axis === 'y' ? best.x : best.y;
    for (let scan = centre - 0.1; scan <= centre + 0.1; scan += 0.02) evaluate(scan);
    if (best.cost < 0.25) found.push(new THREE.Vector3(best.x, best.y, best.z));
  }
  return found;
}

function liftFromSurface(point, offset) {
  const owner = CHAMBER_SPECS.reduce((winner, spec) =>
    fieldValue(spec, point) < fieldValue(winner, point) ? spec : winner,
  );
  const eps = 0.02;
  const gradient = new THREE.Vector3(
    fieldXYZ(owner, point.x + eps, point.y, point.z) - fieldXYZ(owner, point.x - eps, point.y, point.z),
    fieldXYZ(owner, point.x, point.y + eps, point.z) - fieldXYZ(owner, point.x, point.y - eps, point.z),
    fieldXYZ(owner, point.x, point.y, point.z + eps) - fieldXYZ(owner, point.x, point.y, point.z - eps),
  ).normalize();
  return point.clone().addScaledVector(gradient, offset);
}

function buildCoronarySpecs(aortaCurve, aortaRadius) {
  const root = aortaCurve.getPointAt(0.08);
  const rootRadius = aortaRadius(0.08);
  const ostium = (dx, dz) =>
    root.clone().addScaledVector(new THREE.Vector3(dx, 0.05, dz).normalize(), rootRadius * 0.92);

  const lad = traceGroove(chamberById.rightVentricle, chamberById.leftVentricle, {
    axis: 'y', values: range(1.0, -2.2, 0.25), range: [-1.2, 1.9], side: 1,
  });
  const rca = traceGroove(chamberById.rightAtrium, chamberById.rightVentricle, {
    axis: 'x', values: range(-0.85, -2.3, 0.2), range: [-0.7, 1.5], side: 1,
  });
  const circumflex = traceGroove(chamberById.leftAtrium, chamberById.leftVentricle, {
    axis: 'x', values: range(0.5, 2.0, 0.2), range: [-0.3, 1.7], side: -1,
  });
  const posterior = traceGroove(chamberById.rightVentricle, chamberById.leftVentricle, {
    axis: 'y', values: range(1.0, -2.0, 0.25), range: [-1.4, 2.0], side: -1,
  });

  const lift = (points) => points.map((point) => liftFromSurface(point, 0.035));
  return [
    { id: 'leftAnteriorDescendingArtery', points: [ostium(0.4, 0.8), ...lift(lad)] },
    { id: 'rightCoronaryArtery', points: [ostium(-0.5, 0.85), ...lift(rca)] },
    { id: 'circumflexArtery', points: lift(circumflex) },
    { id: 'posteriorDescendingArtery', points: lift(posterior) },
  ].filter((spec) => spec.points.length >= 3);
}

function range(from, to, step) {
  const values = [];
  const direction = Math.sign(to - from);
  for (let v = from; direction * (to - v) >= -1e-9; v += direction * step) values.push(v);
  return values;
}

function createMaterial({ roughness, clearcoat }) {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.3,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#ff9fb0'),
  });
}

export function buildProceduralHeart() {
  const group = new THREE.Group();
  group.name = 'procedural-heart';
  const parts = {};

  const register = (id, geometry, material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parts[id] = mesh;
    group.add(mesh);
    return mesh;
  };

  for (const spec of CHAMBER_SPECS) {
    const mesh = register(spec.id, buildChamberGeometry(spec), createMaterial({ roughness: 0.5, clearcoat: 0.45 }));
    mesh.userData.region = spec.group;
  }

  let aortaCurve = null;
  let aortaRadius = null;
  for (const spec of VESSEL_SPECS) {
    const { geometry, curve } = buildTubeGeometry({
      points: spec.points,
      radius: spec.radius,
      color: spec.color,
      capEnd: spec.capEnd ?? true,
      seed: spec.points[0][0] * 3.1,
    });
    register(spec.id, geometry, createMaterial({ roughness: 0.4, clearcoat: 0.6 }));
    if (spec.id === 'aorta') {
      aortaCurve = curve;
      aortaRadius = spec.radius;
    }
  }

  for (const spec of buildCoronarySpecs(aortaCurve, aortaRadius)) {
    const { geometry } = buildTubeGeometry({
      points: spec.points.map((p) => [p.x, p.y, p.z]),
      radius: (t) => 0.048 * (1 - 0.45 * t),
      color: '#ff7352',
      radialSegments: 10,
      tubularSegments: 48,
      capStart: true,
      capEnd: true,
      seed: 3,
    });
    register(spec.id, geometry, createMaterial({ roughness: 0.35, clearcoat: 0.7 }));
  }

  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  return { group, parts, bounds, dispose: () => disposeObject3D(group) };
}

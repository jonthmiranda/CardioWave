function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export function createNoise3D(seed = 1) {
  const random = mulberry32(seed);
  const permutation = Array.from({ length: 256 }, (_, index) => index);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = permutation[i & 255];
  const values = Float32Array.from({ length: 256 }, () => random() * 2 - 1);

  const lattice = (ix, iy, iz) => values[perm[perm[perm[ix & 255] + (iy & 255)] + (iz & 255)]];

  return (x, y, z) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const fz = fade(z - z0);
    const c000 = lattice(x0, y0, z0);
    const c100 = lattice(x0 + 1, y0, z0);
    const c010 = lattice(x0, y0 + 1, z0);
    const c110 = lattice(x0 + 1, y0 + 1, z0);
    const c001 = lattice(x0, y0, z0 + 1);
    const c101 = lattice(x0 + 1, y0, z0 + 1);
    const c011 = lattice(x0, y0 + 1, z0 + 1);
    const c111 = lattice(x0 + 1, y0 + 1, z0 + 1);
    return lerp(
      lerp(lerp(c000, c100, fx), lerp(c010, c110, fx), fy),
      lerp(lerp(c001, c101, fx), lerp(c011, c111, fx), fy),
      fz,
    );
  };
}

export function fbm3(noise, x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

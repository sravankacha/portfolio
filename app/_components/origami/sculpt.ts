/* =========================================================
   Signed-distance sculpting + surface-nets meshing.

   Each animal is sculpted from ellipsoids and round cones that
   smooth-blend into one another (like clay), then meshed on a
   fine grid into a faceted, flat-shaded paper surface. Every
   face gets the color of the primitive that owns it, with
   optional belly/front panels and jaguar rosettes.
   ========================================================= */

export type Vec3 = [number, number, number];

type Alt = { axis: Vec3; thresh: number; color: number };

type PrimOpts = {
  k?: number; // smooth-blend radius into the shape so far (0 = hard union)
  rot?: Vec3; // ellipsoid euler XYZ
  alt?: Alt; // faces whose normal points along axis get this color
  spots?: number; // rosette cell size; 0/undefined = plain
  spotColor?: number;
};

type Prim = {
  kind: 0 | 1; // 0 ellipsoid, 1 round cone
  // ellipsoid
  c: Vec3;
  r: Vec3;
  m: number[]; // world->local rotation (row-major 3x3)
  // round cone
  a: Vec3;
  b: Vec3;
  r1: number;
  r2: number;
  // shared
  k: number;
  color: number;
  alt?: Alt;
  spots: number;
  spotColor: number;
  bc: Vec3; // bounding sphere
  br: number;
};

function eulerMatrixT([rx, ry, rz]: Vec3): number[] {
  // R = Rz * Ry * Rx (local->world); return R^T (world->local)
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const R = [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
  return [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
}

export class Sculpt {
  prims: Prim[] = [];

  ell(c: Vec3, r: Vec3, color: number, o: PrimOpts = {}): this {
    this.prims.push({
      kind: 0, c, r, m: eulerMatrixT(o.rot ?? [0, 0, 0]),
      a: c, b: c, r1: 0, r2: 0,
      k: o.k ?? 0.12, color, alt: o.alt,
      spots: o.spots ?? 0, spotColor: o.spotColor ?? 0,
      bc: c, br: Math.max(r[0], r[1], r[2]),
    });
    return this;
  }

  cone(a: Vec3, b: Vec3, r1: number, r2: number, color: number, o: PrimOpts = {}): this {
    const bc: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const half = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2;
    this.prims.push({
      kind: 1, c: bc, r: [0, 0, 0], m: [],
      a, b, r1, r2,
      k: o.k ?? 0.08, color, alt: o.alt,
      spots: o.spots ?? 0, spotColor: o.spotColor ?? 0,
      bc, br: half + Math.max(r1, r2),
    });
    return this;
  }

  /** Tapered tube through points, one round cone per segment. */
  chain(pts: Vec3[], radii: number[], color: number, o: PrimOpts = {}): this {
    for (let i = 0; i < pts.length - 1; i++) {
      this.cone(pts[i], pts[i + 1], radii[i], radii[i + 1], color, {
        ...o,
        k: i === 0 ? o.k : Math.min(o.k ?? 0.05, 0.04),
      });
    }
    return this;
  }

  /** Run fn for the left (+z) and right (-z) side. */
  sym(fn: (s: 1 | -1) => void): this {
    fn(1);
    fn(-1);
    return this;
  }
}

function sdEll(p: Prim, x: number, y: number, z: number): number {
  const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
  const m = p.m;
  const lx = m[0] * dx + m[1] * dy + m[2] * dz;
  const ly = m[3] * dx + m[4] * dy + m[5] * dz;
  const lz = m[6] * dx + m[7] * dy + m[8] * dz;
  const [rx, ry, rz] = p.r;
  const k0 = Math.hypot(lx / rx, ly / ry, lz / rz);
  const k1 = Math.hypot(lx / (rx * rx), ly / (ry * ry), lz / (rz * rz));
  if (k1 < 1e-9) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
}

// iq's round cone
function sdCone(p: Prim, x: number, y: number, z: number): number {
  const [ax, ay, az] = p.a;
  const bax = p.b[0] - ax, bay = p.b[1] - ay, baz = p.b[2] - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = p.r1 - p.r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = x - ax, pay = y - ay, paz = z - az;
  const yv = pax * bax + pay * bay + paz * baz;
  const zv = yv - l2;
  const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yv * yv * l2;
  const z2 = zv * zv * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - p.r2;
  if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - p.r1;
  return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - p.r1;
}

function primDist(p: Prim, x: number, y: number, z: number): number {
  return p.kind === 0 ? sdEll(p, x, y, z) : sdCone(p, x, y, z);
}

export function field(prims: Prim[], x: number, y: number, z: number): number {
  let d = 1e9;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    const lb = Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br;
    if (lb >= d + p.k) continue; // can't influence the blend
    const di = primDist(p, x, y, z);
    if (p.k > 0) {
      const h = Math.max(p.k - Math.abs(d - di), 0) / p.k;
      d = Math.min(d, di) - h * h * p.k * 0.25;
    } else if (di < d) d = di;
  }
  return d;
}

function owner(prims: Prim[], x: number, y: number, z: number): Prim {
  let best = prims[0];
  let bd = 1e9;
  for (const p of prims) {
    const lb = Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br;
    if (lb >= bd) continue;
    // hard-union details (eyes, tusks, horns) win ties so they read crisply
    const di = primDist(p, x, y, z) - (p.k <= 0.03 ? 0.012 : 0);
    if (di < bd) {
      bd = di;
      best = p;
    }
  }
  return best;
}

function hash(x: number, y: number, z: number, s: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
  return h - Math.floor(h);
}

// Jaguar rosettes: broken rings around worley feature points, plus solid dots
function rosette(x: number, y: number, z: number, s: number): boolean {
  const gx = x / s, gy = y / s, gz = z / s;
  const ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz);
  let best = 9, bx = 0, by = 0, bz = 0, fx = 0, fy = 0, fz = 0;
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++)
      for (let c = -1; c <= 1; c++) {
        const cx = ix + a, cy = iy + b, cz = iz + c;
        const px = cx + hash(cx, cy, cz, 1), py = cy + hash(cx, cy, cz, 2), pz = cz + hash(cx, cy, cz, 3);
        const d = Math.hypot(gx - px, gy - py, gz - pz);
        if (d < best) {
          best = d; bx = cx; by = cy; bz = cz; fx = px; fy = py; fz = pz;
        }
      }
  const kind = hash(bx, by, bz, 4);
  if (kind < 0.35) return best < 0.22; // solid spot
  if (best > 0.2 && best < 0.4) {
    // gaps in the ring
    const ang = Math.atan2(gy - fy, gx - fx + (gz - fz) * 0.7);
    return Math.sin(ang * 3 + kind * 20) > -0.45;
  }
  return false;
}

export type SculptMesh = {
  positions: Float32Array; // animal surface, non-indexed triangles
  ball: Float32Array; // same vertices on the crumpled paper ball
  colors: Float32Array; // per-face paper colors (linear-ish sRGB 0..1)
  ballColors: Float32Array;
  triangles: number;
};

const BALL_C: Vec3 = [0, 0.78, 0];
const BALL_R = 0.72;
const CRUMPLE_DIRS: Vec3[] = Array.from({ length: 12 }, (_, i) => {
  const a = hash(i, 1, 2, 7) * Math.PI * 2;
  const zz = hash(i, 3, 4, 8) * 2 - 1;
  const r = Math.sqrt(1 - zz * zz);
  return [r * Math.cos(a), r * Math.sin(a), zz];
});

/** Continuous map from any point to a crumpled paper ball — shared by every animal. */
function ballPoint(x: number, y: number, z: number, cx: number, cy: number, cz: number, out: number[]) {
  let dx = x - cx, dy = y - cy, dz = z - cz;
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l; dy /= l; dz /= l;
  let n = 0;
  for (let i = 0; i < CRUMPLE_DIRS.length; i++) {
    const u = CRUMPLE_DIRS[i];
    const f = 2.6 + i * 0.8;
    // sharp ridges: paper creases, not smooth bumps
    n += Math.pow(1 - Math.abs(Math.sin((dx * u[0] + dy * u[1] + dz * u[2]) * f + i * 1.7)), 2);
  }
  const r = BALL_R * (0.86 + (n / CRUMPLE_DIRS.length) * 0.44);
  out[0] = BALL_C[0] + dx * r;
  out[1] = BALL_C[1] + dy * r;
  out[2] = BALL_C[2] + dz * r;
}

function toRGB(hex: number): Vec3 {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export function meshSculpt(s: Sculpt, h: number, ballColor: number, scale = 1): SculptMesh {
  const prims = s.prims;
  // grid bounds from primitive bounding spheres
  const lo: Vec3 = [1e9, 1e9, 1e9];
  const hi: Vec3 = [-1e9, -1e9, -1e9];
  for (const p of prims)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p.bc[a] - p.br - 2 * h);
      hi[a] = Math.max(hi[a], p.bc[a] + p.br + 2 * h);
    }
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1;
  const ny = Math.ceil((hi[1] - lo[1]) / h) + 1;
  const nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  const f = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        f[idx(i, j, k)] = field(prims, lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);

  // one vertex per sign-changing cell (surface nets)
  const cnx = nx - 1, cny = ny - 1;
  const cellVert = new Int32Array(cnx * cny * (nz - 1)).fill(-1);
  const verts: number[] = [];
  const CORNERS = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNERS[c];
          cv[c] = f[idx(i + o[0], j + o[1], k + o[2])];
          if (cv[c] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [e0, e1] of EDGES) {
          const a = cv[e0], b = cv[e1];
          if (a < 0 === b < 0) continue;
          const t = a / (a - b);
          const A = CORNERS[e0], B = CORNERS[e1];
          sx += A[0] + (B[0] - A[0]) * t;
          sy += A[1] + (B[1] - A[1]) * t;
          sz += A[2] + (B[2] - A[2]) * t;
          n++;
        }
        let x = lo[0] + (i + sx / n) * h;
        let y = lo[1] + (j + sy / n) * h;
        let z = lo[2] + (k + sz / n) * h;
        // one Newton step onto the true surface sharpens horns, ears, toes
        const d = field(prims, x, y, z);
        const e = h * 0.25;
        const gx = field(prims, x + e, y, z) - field(prims, x - e, y, z);
        const gy = field(prims, x, y + e, z) - field(prims, x, y - e, z);
        const gz = field(prims, x, y, z + e) - field(prims, x, y, z - e);
        const g2 = (gx * gx + gy * gy + gz * gz) / (4 * e * e);
        if (g2 > 1e-6) {
          const sc = d / g2 / (2 * e);
          const mx = gx * sc, my = gy * sc, mz = gz * sc;
          // never move further than half a cell
          const ml = Math.hypot(mx, my, mz);
          const clamp = ml > h * 0.5 ? (h * 0.5) / ml : 1;
          x -= mx * clamp; y -= my * clamp; z -= mz * clamp;
        }
        cellVert[i + cnx * (j + cny * k)] = verts.length / 3;
        verts.push(x, y, z);
      }

  const cell = (i: number, j: number, k: number) => cellVert[i + cnx * (j + cny * k)];
  const quads: number[] = [];
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const inside = f[idx(i, j, k)] < 0;
        // x-edge
        if (inside !== f[idx(i + 1, j, k)] < 0) {
          const q = [cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k)];
          if (inside) quads.push(q[0], q[1], q[2], q[3]);
          else quads.push(q[0], q[3], q[2], q[1]);
        }
        // y-edge
        if (inside !== f[idx(i, j + 1, k)] < 0) {
          const q = [cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k)];
          if (inside) quads.push(q[0], q[3], q[2], q[1]);
          else quads.push(q[0], q[1], q[2], q[3]);
        }
        // z-edge
        if (inside !== f[idx(i, j, k + 1)] < 0) {
          const q = [cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k)];
          if (inside) quads.push(q[0], q[1], q[2], q[3]);
          else quads.push(q[0], q[3], q[2], q[1]);
        }
      }

  // centroid of the surface anchors the ball projection
  let cx = 0, cy = 0, cz = 0;
  const nv = verts.length / 3;
  for (let v = 0; v < nv; v++) {
    cx += verts[v * 3]; cy += verts[v * 3 + 1]; cz += verts[v * 3 + 2];
  }
  cx /= nv; cy /= nv; cz /= nv;
  const ballV = new Float32Array(verts.length);
  const tmp = [0, 0, 0];
  for (let v = 0; v < nv; v++) {
    ballPoint(verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2], cx, cy, cz, tmp);
    ballV[v * 3] = tmp[0]; ballV[v * 3 + 1] = tmp[1]; ballV[v * 3 + 2] = tmp[2];
  }

  const triCount = (quads.length / 4) * 2;
  const positions = new Float32Array(triCount * 9);
  const ball = new Float32Array(triCount * 9);
  const colors = new Float32Array(triCount * 9);
  const ballColors = new Float32Array(triCount * 9);
  const ballRGB = toRGB(ballColor);
  let w = 0;
  const pushTri = (a: number, b: number, c: number) => {
    const ids = [a, b, c];
    const px = (verts[a * 3] + verts[b * 3] + verts[c * 3]) / 3;
    const py = (verts[a * 3 + 1] + verts[b * 3 + 1] + verts[c * 3 + 1]) / 3;
    const pz = (verts[a * 3 + 2] + verts[b * 3 + 2] + verts[c * 3 + 2]) / 3;
    // face normal
    const ux = verts[b * 3] - verts[a * 3], uy = verts[b * 3 + 1] - verts[a * 3 + 1], uz = verts[b * 3 + 2] - verts[a * 3 + 2];
    const vx = verts[c * 3] - verts[a * 3], vy = verts[c * 3 + 1] - verts[a * 3 + 1], vz = verts[c * 3 + 2] - verts[a * 3 + 2];
    let fnx = uy * vz - uz * vy, fny = uz * vx - ux * vz, fnz = ux * vy - uy * vx;
    const fl = Math.hypot(fnx, fny, fnz) || 1;
    fnx /= fl; fny /= fl; fnz /= fl;

    const p = owner(prims, px, py, pz);
    let hex = p.color;
    if (p.alt && fnx * p.alt.axis[0] + fny * p.alt.axis[1] + fnz * p.alt.axis[2] > p.alt.thresh) hex = p.alt.color;
    if (p.spots > 0 && rosette(px, py, pz, p.spots)) hex = p.spotColor;
    const rgb = toRGB(hex);
    // each facet is its own slightly different sheet of paper
    const shade = 1 + (hash(px * 40, py * 40, pz * 40, 9) - 0.5) * 0.04;
    const bshade = 1 + (hash(px * 40, py * 40, pz * 40, 10) - 0.5) * 0.05;
    for (const id of ids) {
      positions[w] = verts[id * 3]; positions[w + 1] = verts[id * 3 + 1]; positions[w + 2] = verts[id * 3 + 2];
      ball[w] = ballV[id * 3]; ball[w + 1] = ballV[id * 3 + 1]; ball[w + 2] = ballV[id * 3 + 2];
      for (let q = 0; q < 3; q++) {
        colors[w + q] = Math.min(rgb[q] * shade, 1);
        ballColors[w + q] = Math.min(ballRGB[q] * bshade, 1);
      }
      w += 3;
    }
  };
  for (let q = 0; q < quads.length; q += 4) {
    const a = quads[q], b = quads[q + 1], c = quads[q + 2], d = quads[q + 3];
    // split along the shorter diagonal
    const dac = Math.hypot(verts[a * 3] - verts[c * 3], verts[a * 3 + 1] - verts[c * 3 + 1], verts[a * 3 + 2] - verts[c * 3 + 2]);
    const dbd = Math.hypot(verts[b * 3] - verts[d * 3], verts[b * 3 + 1] - verts[d * 3 + 1], verts[b * 3 + 2] - verts[d * 3 + 2]);
    if (dac <= dbd) {
      pushTri(a, b, c);
      pushTri(a, c, d);
    } else {
      pushTri(a, b, d);
      pushTri(b, c, d);
    }
  }
  if (scale !== 1) for (let i = 0; i < positions.length; i++) positions[i] *= scale;
  // three treats vertex colors as linear
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  for (let i = 0; i < colors.length; i++) {
    colors[i] = lin(colors[i]);
    ballColors[i] = lin(ballColors[i]);
  }
  return { positions, ball, colors, ballColors, triangles: triCount };
}

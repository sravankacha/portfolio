"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";

const THREE_CDN = "https://esm.sh/three@0.180.0";

// Runtime CDN import — new Function defeats static analysis so Three stays out of the bundle.
function loadThree(): Promise<typeof THREENS> {
  return new Function("u", "return import(u)")(THREE_CDN) as Promise<
    typeof THREENS
  >;
}

/* =========================================================
   Shared-topology paper animals.

   Every animal is the same 15 parts (boxes with hand-jittered
   corners) in the same order, so all shapes share one vertex
   layout and morphing is a straight per-vertex lerp. Parts an
   animal doesn't need shrink to a speck and "fold away".

   Part order: body, chest, hips, head, snout, earL, earR,
   legFL, legFR, legBL, legBR, tail, app1, app2, app3
   (app1–3 = signature appendage chain: jaguar tail,
   rhino horns, elephant trunk)
   ========================================================= */

type PartSpec = {
  pos: [number, number, number];
  size: [number, number, number];
  rot?: [number, number, number];
  taperTop?: number; // scale x/z of +y corners
  taperBottom?: number; // scale x/z of -y corners
};

type AnimalSpec = {
  name: string;
  parts: PartSpec[];
  colors: number[]; // one hex per part — colored-paper panels
  shadow: [number, number]; // ground blob scale x/z
};

// Shared colored-paper palette (studio papercraft style)
const P = {
  cream: 0xf3ede0,
  tan: 0xead9b3,
  oat: 0xe5d3b8,
  olive: 0xb39a5e,
  goldenrod: 0xc9b077,
  mustard: 0xe3a72f,
  orange: 0xe07230,
  terracotta: 0xc94f32,
  rust: 0xa65a33,
  plum: 0x5c4a6e,
  teal: 0x4d9b85,
  blush: 0xefdcd2,
  slate: 0x7295a8,
  slateDeep: 0x5f8296,
  slateLight: 0x81a2b2,
  ink: 0x54707e,
};

const PART_COUNT = 15;
const GRID = 4; // subdivisions per box face — every face is a 4x4 sheet of creased facets
const VERTS_PER_PART = 6 * GRID * GRID * 6; // faces × cells × 2 tris × 3 verts
const VERT_COUNT = PART_COUNT * VERTS_PER_PART;

// Cube corners: index = x + y*2 + z*4, coords in {-0.5, +0.5}
// Faces as corner quads (a,b,c,d) -> tris (a,b,c) (a,c,d), CCW outside
const FACES: [number, number, number, number][] = [
  [0, 4, 6, 2], // -x
  [1, 3, 7, 5], // +x
  [0, 1, 5, 4], // -y
  [2, 6, 7, 3], // +y
  [0, 2, 3, 1], // -z
  [4, 5, 7, 6], // +z
];

// Deterministic per-(part, corner) pseudo-random in [-1, 1]
function rnd(part: number, corner: number, salt: number): number {
  const s = Math.sin(part * 127.1 + corner * 311.7 + salt * 74.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

// Bilinear point on the quad a→b→c→d at (u, v)
function bilerp(
  A: number[],
  B: number[],
  C: number[],
  D: number[],
  u: number,
  v: number
): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = (1 - v) * ((1 - u) * A[k] + u * B[k]) + v * ((1 - u) * D[k] + u * C[k]);
  }
  return out;
}

function buildShape(spec: AnimalSpec): Float32Array {
  const out = new Float32Array(VERT_COUNT * 3);
  let w = 0;
  for (let p = 0; p < PART_COUNT; p++) {
    const part = spec.parts[p];
    const [px, py, pz] = part.pos;
    const [sx, sy, sz] = part.size;
    const [rx, ry, rz] = part.rot ?? [0, 0, 0];
    const tTop = part.taperTop ?? 1;
    const tBot = part.taperBottom ?? 1;

    // 8 corners, jittered identically across animals so creases morph coherently
    const corners: [number, number, number][] = [];
    for (let c = 0; c < 8; c++) {
      let x = (c & 1 ? 0.5 : -0.5) + rnd(p, c, 1) * 0.085;
      let y = (c & 2 ? 0.5 : -0.5) + rnd(p, c, 2) * 0.085;
      let z = (c & 4 ? 0.5 : -0.5) + rnd(p, c, 3) * 0.085;
      const taper = c & 2 ? tTop : tBot;
      x *= taper;
      z *= taper;
      // scale
      x *= sx;
      y *= sy;
      z *= sz;
      // rotate XYZ euler
      let cy = Math.cos(rx), sy_ = Math.sin(rx);
      let y1 = y * cy - z * sy_;
      let z1 = y * sy_ + z * cy;
      y = y1;
      z = z1;
      cy = Math.cos(ry);
      sy_ = Math.sin(ry);
      const x1 = x * cy + z * sy_;
      z1 = -x * sy_ + z * cy;
      x = x1;
      z = z1;
      cy = Math.cos(rz);
      sy_ = Math.sin(rz);
      const x2 = x * cy - y * sy_;
      y1 = x * sy_ + y * cy;
      x = x2;
      y = y1;
      corners.push([x + px, y + py, z + pz]);
    }

    for (let f = 0; f < FACES.length; f++) {
      const [a, b, c, d] = FACES[f];
      const A = corners[a];
      const B = corners[b];
      const C = corners[c];
      const D = corners[d];
      // face normal + size drive the interior crease displacement
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1];
      let ny = e1[2] * e2[0] - e1[0] * e2[2];
      let nz = e1[0] * e2[1] - e1[1] * e2[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const faceSize =
        (Math.hypot(e1[0], e1[1], e1[2]) + Math.hypot(e2[0], e2[1], e2[2])) / 2;
      const amp = faceSize * 0.062;

      // grid points; edges stay on the bilinear sheet so parts remain watertight,
      // interior points pop in/out along the normal to form fold facets
      const pts: [number, number, number][][] = [];
      for (let gu = 0; gu <= GRID; gu++) {
        pts.push([]);
        for (let gv = 0; gv <= GRID; gv++) {
          const P = bilerp(A, B, C, D, gu / GRID, gv / GRID);
          if (gu > 0 && gu < GRID && gv > 0 && gv < GRID) {
            const h = rnd(p, f * 131 + gu * 17 + gv, 31) * amp;
            P[0] += nx * h;
            P[1] += ny * h;
            P[2] += nz * h;
          }
          pts[gu].push(P);
        }
      }
      for (let gu = 0; gu < GRID; gu++) {
        for (let gv = 0; gv < GRID; gv++) {
          const tris = [
            pts[gu][gv],
            pts[gu + 1][gv],
            pts[gu + 1][gv + 1],
            pts[gu][gv],
            pts[gu + 1][gv + 1],
            pts[gu][gv + 1],
          ];
          for (const P of tris) {
            out[w++] = P[0];
            out[w++] = P[1];
            out[w++] = P[2];
          }
        }
      }
    }
  }
  // Center the animal's x-extent so every shape sits mid-frame
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < out.length; i += 3) {
    if (out[i] < minX) minX = out[i];
    if (out[i] > maxX) maxX = out[i];
  }
  const cx = (minX + maxX) / 2;
  for (let i = 0; i < out.length; i += 3) out[i] -= cx;
  return out;
}

// Per-vertex crumple directions, bilinearly blended from per-corner dirs so
// coincident vertices (shared corners/edges) move together and the paper
// crumples without tearing. Interior grid points get extra chaos.
function buildCrumpleDirs(): Float32Array {
  const out = new Float32Array(VERT_COUNT * 3);
  let w = 0;
  for (let p = 0; p < PART_COUNT; p++) {
    const dirs: [number, number, number][] = [];
    for (let c = 0; c < 8; c++) {
      dirs.push([rnd(p, c, 11), rnd(p, c, 12), rnd(p, c, 13)]);
    }
    for (let f = 0; f < FACES.length; f++) {
      const [a, b, c, d] = FACES[f];
      const grid: [number, number, number][][] = [];
      for (let gu = 0; gu <= GRID; gu++) {
        grid.push([]);
        for (let gv = 0; gv <= GRID; gv++) {
          const P = bilerp(dirs[a], dirs[b], dirs[c], dirs[d], gu / GRID, gv / GRID);
          if (gu > 0 && gu < GRID && gv > 0 && gv < GRID) {
            P[0] += rnd(p, f * 131 + gu * 17 + gv, 41) * 0.5;
            P[1] += rnd(p, f * 131 + gu * 17 + gv, 42) * 0.5;
            P[2] += rnd(p, f * 131 + gu * 17 + gv, 43) * 0.5;
          }
          grid[gu].push(P);
        }
      }
      for (let gu = 0; gu < GRID; gu++) {
        for (let gv = 0; gv < GRID; gv++) {
          const tris = [
            grid[gu][gv],
            grid[gu + 1][gv],
            grid[gu + 1][gv + 1],
            grid[gu][gv],
            grid[gu + 1][gv + 1],
            grid[gu][gv + 1],
          ];
          for (const P of tris) {
            out[w++] = P[0];
            out[w++] = P[1];
            out[w++] = P[2];
          }
        }
      }
    }
  }
  return out;
}

// Per-vertex luminance variance: every fold cell reads as its own paper panel
function buildShadeFactors(): Float32Array {
  const out = new Float32Array(VERT_COUNT);
  let w = 0;
  for (let p = 0; p < PART_COUNT; p++) {
    for (let f = 0; f < FACES.length; f++) {
      for (let gu = 0; gu < GRID; gu++) {
        for (let gv = 0; gv < GRID; gv++) {
          const shade = 1 + rnd(p, f * 131 + gu * 13 + gv, 51) * 0.07;
          for (let i = 0; i < 6; i++) out[w++] = shade;
        }
      }
    }
  }
  return out;
}

const speck = (x: number, y: number, z: number): PartSpec => ({
  pos: [x, y, z],
  size: [0.02, 0.02, 0.02],
});

const JAGUAR: AnimalSpec = {
  name: "jaguar",
  shadow: [1.9, 0.85],
  // Cream cat with a plum chest, rust forelegs, olive haunches (ref: papercraft lioness)
  colors: [
    P.tan, // body
    P.plum, // chest
    P.goldenrod, // hips
    P.cream, // head
    P.cream, // snout
    P.oat, // earL
    P.oat, // earR
    P.rust, // legFL
    P.rust, // legFR
    P.olive, // legBL
    P.olive, // legBR
    P.tan, // tail speck
    P.terracotta, // tail root
    P.terracotta, // tail mid
    P.terracotta, // tail tip
  ],
  parts: [
    { pos: [0, 0.64, 0], size: [1.45, 0.42, 0.44], taperBottom: 0.78 }, // body
    { pos: [0.6, 0.6, 0], size: [0.52, 0.52, 0.5], taperBottom: 0.85 }, // chest
    { pos: [-0.6, 0.66, 0], size: [0.5, 0.46, 0.46], taperTop: 0.84, rot: [0, 0, 0.08] }, // hips
    { pos: [1.02, 0.92, 0], size: [0.34, 0.3, 0.32], taperTop: 0.86 }, // head
    { pos: [1.21, 0.86, 0], size: [0.22, 0.17, 0.22], taperBottom: 0.8 }, // snout
    { pos: [0.95, 1.12, 0.1], size: [0.09, 0.15, 0.06], rot: [0, 0, -0.1], taperTop: 0.25 }, // earL
    { pos: [0.95, 1.12, -0.1], size: [0.09, 0.15, 0.06], rot: [0, 0, -0.1], taperTop: 0.25 }, // earR
    { pos: [0.62, 0.26, 0.15], size: [0.15, 0.55, 0.14], taperBottom: 0.68 }, // legFL
    { pos: [0.58, 0.26, -0.15], size: [0.15, 0.55, 0.14], taperBottom: 0.68 }, // legFR
    { pos: [-0.62, 0.26, 0.16], size: [0.16, 0.55, 0.15], taperBottom: 0.68 }, // legBL
    { pos: [-0.58, 0.26, -0.16], size: [0.16, 0.55, 0.15], taperBottom: 0.68 }, // legBR
    speck(-0.85, 0.72, 0), // tail box folds away — chain is the tail
    { pos: [-1.05, 0.78, 0], size: [0.1, 0.52, 0.1], rot: [0, 0, 1.35] }, // app1: tail sweeps back
    { pos: [-1.45, 0.95, 0], size: [0.09, 0.44, 0.09], rot: [0, 0, 0.9] }, // app2
    { pos: [-1.6, 1.22, 0], size: [0.085, 0.36, 0.085], rot: [0, 0, 0.3], taperTop: 0.3 }, // app3: tip curls up
  ],
};

const RHINO: AnimalSpec = {
  name: "rhino",
  shadow: [2.1, 1.1],
  // Mustard body, orange/red cape, teal neck, blush head, orange horns (ref: origami rhino)
  colors: [
    P.mustard, // body
    P.teal, // chest / neck
    P.terracotta, // hips
    P.blush, // head
    P.blush, // snout
    P.oat, // earL
    P.oat, // earR
    P.terracotta, // legFL
    P.mustard, // legFR
    P.mustard, // legBL
    P.terracotta, // legBR
    P.terracotta, // tail
    P.orange, // big horn
    P.orange, // small horn
    P.blush, // hidden
  ],
  parts: [
    { pos: [0, 0.78, 0], size: [1.65, 0.85, 0.8], taperTop: 0.84 }, // body
    { pos: [0.68, 0.75, 0], size: [0.78, 0.95, 0.86], taperTop: 0.88, taperBottom: 0.92 }, // chest
    { pos: [-0.68, 0.8, 0], size: [0.7, 0.8, 0.76], taperTop: 0.76, rot: [0, 0, 0.12] }, // hips
    { pos: [1.18, 0.68, 0], size: [0.52, 0.48, 0.44], rot: [0, 0, -0.12], taperBottom: 0.85 }, // head
    { pos: [1.48, 0.54, 0], size: [0.3, 0.32, 0.34], taperBottom: 0.82 }, // snout
    { pos: [1.08, 1.0, 0.16], size: [0.08, 0.17, 0.06], taperTop: 0.3 }, // earL
    { pos: [1.08, 1.0, -0.16], size: [0.08, 0.17, 0.06], taperTop: 0.3 }, // earR
    { pos: [0.62, 0.24, 0.25], size: [0.27, 0.48, 0.26], taperBottom: 0.78 }, // legFL
    { pos: [0.58, 0.24, -0.25], size: [0.27, 0.48, 0.26], taperBottom: 0.78 }, // legFR
    { pos: [-0.64, 0.24, 0.25], size: [0.27, 0.48, 0.26], taperBottom: 0.78 }, // legBL
    { pos: [-0.6, 0.24, -0.25], size: [0.27, 0.48, 0.26], taperBottom: 0.78 }, // legBR
    { pos: [-1.08, 0.62, 0], size: [0.06, 0.42, 0.06], rot: [0, 0, -0.18], taperBottom: 0.4 }, // tail
    { pos: [1.62, 0.86, 0], size: [0.13, 0.34, 0.13], rot: [0, 0, -0.32], taperTop: 0.2 }, // app1: big horn
    { pos: [1.42, 0.88, 0], size: [0.1, 0.2, 0.1], rot: [0, 0, -0.28], taperTop: 0.25 }, // app2: small horn
    speck(1.45, 0.72, 0), // app3 folds away
  ],
};

const ELEPHANT: AnimalSpec = {
  name: "elephant",
  shadow: [2.15, 1.2],
  // Slate blues with rust/olive ears and a banded trunk (ref: low-poly elephant)
  colors: [
    P.slate, // body
    P.slateDeep, // chest
    P.slateLight, // hips
    P.slate, // head
    P.ink, // snout
    P.rust, // earL
    P.goldenrod, // earR
    P.slateDeep, // legFL
    P.slateLight, // legFR
    P.slateLight, // legBL
    P.slateDeep, // legBR
    P.ink, // tail
    P.slateDeep, // trunk root
    P.terracotta, // trunk mid band
    P.mustard, // trunk tip
  ],
  parts: [
    { pos: [0, 0.95, 0], size: [1.5, 0.95, 0.9], taperTop: 0.88 }, // body
    { pos: [0.55, 0.95, 0], size: [0.75, 1.0, 0.95], taperTop: 0.92 }, // chest
    { pos: [-0.6, 0.97, 0], size: [0.72, 0.9, 0.85], taperTop: 0.78, rot: [0, 0, -0.08] }, // hips
    { pos: [1.28, 1.42, 0], size: [0.58, 0.56, 0.52], taperBottom: 0.88 }, // head
    { pos: [1.42, 1.14, 0], size: [0.22, 0.2, 0.26], taperBottom: 0.82 }, // snout / jaw
    { pos: [1.12, 1.48, 0.4], size: [0.4, 0.58, 0.06], rot: [0, 0.45, 0.1], taperBottom: 0.7 }, // earL panel
    { pos: [1.12, 1.48, -0.4], size: [0.4, 0.58, 0.06], rot: [0, -0.45, 0.1], taperBottom: 0.7 }, // earR panel
    { pos: [0.58, 0.46, 0.28], size: [0.26, 0.92, 0.26], taperBottom: 0.82 }, // legFL
    { pos: [0.54, 0.46, -0.28], size: [0.26, 0.92, 0.26], taperBottom: 0.82 }, // legFR
    { pos: [-0.6, 0.46, 0.28], size: [0.26, 0.92, 0.26], taperBottom: 0.82 }, // legBL
    { pos: [-0.56, 0.46, -0.28], size: [0.26, 0.92, 0.26], taperBottom: 0.82 }, // legBR
    { pos: [-1.02, 0.98, 0], size: [0.05, 0.5, 0.05], rot: [0, 0, -0.12], taperBottom: 0.4 }, // tail
    { pos: [1.56, 1.14, 0], size: [0.18, 0.54, 0.18], rot: [0, 0, -0.14] }, // app1: trunk root
    { pos: [1.65, 0.7, 0], size: [0.15, 0.46, 0.15], rot: [0, 0, -0.02] }, // app2: trunk mid
    { pos: [1.69, 0.38, 0], size: [0.13, 0.36, 0.13], rot: [0, 0, 0.3], taperBottom: 0.45 }, // app3: trunk tip curls
  ],
};

const ANIMALS = [JAGUAR, RHINO, ELEPHANT];

const HOLD_S = 4.6; // idle time per animal
const MORPH_S = 1.7; // refold duration

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function OrigamiHeroCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const captionEl = captionRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let renderer: THREENS.WebGLRenderer | null = null;
    let cleanupResize: (() => void) | null = null;

    loadThree()
      .then((THREE) => {
        if (disposed || !host.isConnected) return;

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const FOV = 34;
        const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));
        const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
        camera.position.set(0, 1.5, 4.7);
        camera.lookAt(0, 0.05, 0);

        // Paper lighting: bright warm sky/ground bounce + key for crisp facet shading.
        // The key light drifts, so the faceted paper backdrop shimmers — slowly at
        // rest, sweeping hard while the beast refolds.
        const hemi = new THREE.HemisphereLight(0xfffdf8, 0xa8c4ba, 1.5);
        scene.add(hemi);
        const key = new THREE.DirectionalLight(0xfffaf0, 1.7);
        key.position.set(2.5, 4.5, 3);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xf0e6d4, 0.45);
        fill.position.set(-3, 1.5, -2);
        scene.add(fill);

        // Faceted origami-paper backdrop: a big plane with jittered vertices,
        // flat-shaded so every triangle catches the moving light differently
        const bgGeo = new THREE.PlaneGeometry(34, 16, 30, 14);
        const bgPos = bgGeo.attributes.position as THREENS.BufferAttribute;
        for (let i = 0; i < bgPos.count; i++) {
          bgPos.setXYZ(
            i,
            bgPos.getX(i) + rnd(97, i, 21) * 0.2,
            bgPos.getY(i) + rnd(97, i, 22) * 0.2,
            bgPos.getZ(i) + rnd(97, i, 23) * 0.09
          );
        }
        bgPos.needsUpdate = true;
        const backdrop = new THREE.Mesh(
          bgGeo,
          new THREE.MeshStandardMaterial({
            color: 0xaed3c8, // mint studio paper
            roughness: 0.96,
            metalness: 0,
            flatShading: true,
          })
        );
        backdrop.position.set(0, 1.5, -3.6);
        scene.add(backdrop);

        const shapes = ANIMALS.map(buildShape);
        const crumpleDirs = buildCrumpleDirs();

        const positions = new Float32Array(shapes[0]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3)
        );

        // Colored-paper panels: each part carries its animal's palette color,
        // crossfaded per-part while the beast refolds
        const partColors = ANIMALS.map((a) =>
          a.colors.map((hex) => new THREE.Color(hex).convertSRGBToLinear())
        );
        const colors = new Float32Array(VERT_COUNT * 3);
        const shadeFactors = buildShadeFactors();
        const fillPartColor = (part: number, c: THREENS.Color) => {
          const start = part * VERTS_PER_PART;
          for (let i = 0; i < VERTS_PER_PART; i++) {
            const s = shadeFactors[start + i];
            colors[(start + i) * 3] = Math.min(c.r * s, 1);
            colors[(start + i) * 3 + 1] = Math.min(c.g * s, 1);
            colors[(start + i) * 3 + 2] = Math.min(c.b * s, 1);
          }
        };
        for (let p2 = 0; p2 < PART_COUNT; p2++) {
          fillPartColor(p2, partColors[0][p2]);
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.92,
          metalness: 0,
          flatShading: true,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;

        const group = new THREE.Group();
        group.add(mesh);
        group.scale.setScalar(0.75);
        group.position.y = -0.82; // center animal vertically in frame
        // Face -x (toward the intro text) with the head angled out at the viewer
        group.rotation.y = Math.PI + 0.55;
        scene.add(group);

        // Soft blob shadow: radial-gradient canvas texture on a ground plane
        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = shadowCanvas.height = 128;
        const ctx = shadowCanvas.getContext("2d")!;
        const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        grad.addColorStop(0, "rgba(34, 31, 26, 0.34)");
        grad.addColorStop(0.6, "rgba(34, 31, 26, 0.12)");
        grad.addColorStop(1, "rgba(34, 31, 26, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const shadowTex = new THREE.CanvasTexture(shadowCanvas);
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: shadowTex,
            transparent: true,
            depthWrite: false,
          })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.005;
        group.add(shadow);

        const setCaption = (name: string) => {
          if (captionEl) captionEl.textContent = name;
        };
        const setCaptionOpacity = (o: number) => {
          if (captionEl?.parentElement)
            captionEl.parentElement.style.opacity = String(o);
        };
        setCaption(ANIMALS[0].name);

        const setShadow = (a: number, b: number, t: number) => {
          const sx =
            ANIMALS[a].shadow[0] + (ANIMALS[b].shadow[0] - ANIMALS[a].shadow[0]) * t;
          const sz =
            ANIMALS[a].shadow[1] + (ANIMALS[b].shadow[1] - ANIMALS[a].shadow[1]) * t;
          shadow.scale.set(sx, sz, 1);
        };
        setShadow(0, 0, 0);

        const proj = new THREE.Vector3();
        const resize = () => {
          if (!renderer) return;
          const rect = host.getBoundingClientRect();
          const w = Math.min(Math.max(1, rect.width), 4096);
          const h = Math.min(Math.max(1, rect.height), 4096);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setSize(w, h, false);
          const aspect = w / h;
          camera.aspect = aspect;
          // Pull the camera back on narrow viewports until the beast fits
          const dist = Math.max(4.7, 1.62 / (TAN_HALF_FOV * aspect));
          camera.position.set(0, 1.5, dist);
          // Portrait: aim above the beast so it settles into the lower third,
          // clear of the hero text stacked on top of it
          camera.lookAt(0, aspect < 0.9 ? 2.35 : 0.05, 0);
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          // Park the beast in the hero's right column when there's room
          const halfW = TAN_HALF_FOV * dist * aspect;
          const gx = Math.max(0, Math.min(halfW * 0.34, halfW - 1.5));
          group.position.x = gx;
          // Anchor the caption just below the beast
          if (captionEl?.parentElement) {
            proj.set(gx, -1.12, 0).project(camera);
            captionEl.parentElement.style.left = `${((proj.x + 1) / 2) * 100}%`;
            captionEl.parentElement.style.top = `${((1 - proj.y) / 2) * 100}%`;
          }
          renderer.render(scene, camera);
        };

        host.appendChild(renderer.domElement);
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        cleanupResize = () => ro.disconnect();

        if (reduceMotion) return; // static first animal, no cycling

        // idle(HOLD_S) -> morph(MORPH_S) -> next animal
        let current = 0;
        let phase: "idle" | "morph" = "idle";
        let phaseStart = performance.now() / 1000;
        let lastNow = phaseStart;
        let lightT = 0;
        const baseRotY = group.rotation.y;
        const posAttr = geometry.getAttribute(
          "position"
        ) as THREENS.BufferAttribute;
        const colorAttr = geometry.getAttribute(
          "color"
        ) as THREENS.BufferAttribute;
        const tmpColor = new THREE.Color();

        const animate = () => {
          if (disposed || !renderer) return;
          raf = requestAnimationFrame(animate);
          const now = performance.now() / 1000;
          const t = now - phaseStart;
          const dt = Math.min(now - lastNow, 0.1);
          lastNow = now;

          // Light drifts lazily at rest, sweeps during a refold — the faceted
          // backdrop and the beast both shimmer with it
          lightT += dt * (phase === "morph" ? 2.6 : 0.22);
          key.position.set(
            2.5 + Math.sin(lightT) * 4.2,
            4.5 + Math.cos(lightT * 0.83) * 1.7,
            3
          );

          if (phase === "idle") {
            group.rotation.y = baseRotY + Math.sin(now * 0.5) * 0.09;
            group.position.y = -0.82 + Math.sin(now * 1.1) * 0.015;
            if (t > HOLD_S) {
              phase = "morph";
              phaseStart = now;
              setCaptionOpacity(0);
            }
          } else {
            const next = (current + 1) % ANIMALS.length;
            const p = Math.min(t / MORPH_S, 1);
            const e = easeInOutCubic(p);
            const from = shapes[current];
            const to = shapes[next];
            // crumple hardest mid-refold, settling flat at both ends
            const crumple = Math.sin(p * Math.PI) * 0.16;
            // refold ripples through the parts instead of one uniform blend
            const STAGGER = 0.3;
            for (let part = 0; part < PART_COUNT; part++) {
              const delay = (part / (PART_COUNT - 1)) * STAGGER;
              const pp = Math.min(Math.max((p - delay) / (1 - STAGGER), 0), 1);
              const ep = easeInOutCubic(pp);
              const start = part * VERTS_PER_PART * 3;
              const end = start + VERTS_PER_PART * 3;
              for (let i = start; i < end; i++) {
                positions[i] =
                  from[i] + (to[i] - from[i]) * ep + crumpleDirs[i] * crumple;
              }
              // paper panel color crossfades with the same ripple
              tmpColor
                .copy(partColors[current][part])
                .lerp(partColors[next][part], ep);
              fillPartColor(part, tmpColor);
            }
            posAttr.needsUpdate = true;
            colorAttr.needsUpdate = true;
            geometry.computeVertexNormals();
            // tumble a half-turn while refolding
            group.rotation.y = baseRotY + e * Math.PI * 2;
            setShadow(current, next, e);
            if (p >= 0.5 && captionEl?.textContent !== ANIMALS[next].name) {
              setCaption(ANIMALS[next].name);
            }
            if (p >= 1) {
              current = next;
              phase = "idle";
              phaseStart = now;
              setCaptionOpacity(1);
            }
          }
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(animate);
      })
      .catch(() => {
        // WebGL/CDN unavailable — hero simply shows no art
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupResize?.();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
    };
  }, []);

  return (
    <div className="origami-host" ref={hostRef} aria-hidden="true">
      <p className="origami-caption">
        <span ref={captionRef} />
      </p>
    </div>
  );
}

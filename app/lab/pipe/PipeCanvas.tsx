"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";

const THREE_URL = "https://esm.sh/three@0.180.0";

// Runtime CDN import — new Function defeats static analysis so Three stays out of the bundle.
function loadThree(): Promise<typeof THREENS> {
  return new Function("u", "return import(u)")(THREE_URL) as Promise<
    typeof THREENS
  >;
}

export type PipeControls = {
  speed: number; // band flow speed, world units per second
  wander: boolean; // extend on its own when left idle
  resetToken: number; // bump to restart
};

/* =========================================================
   Endless pipe.

   The camera is fixed. The pipe enters from the bottom-left
   and runs away into the screen. Its path is append-only:
   every click adds a Hermite segment from the current end to
   a point on the clicked ray, deeper than the last, and the
   pipe grows into it. Earlier segments never change — each
   new segment starts with the previous end's tangent, and the
   frames are parallel-transported forward from there.

   Motion comes from the bands: they stream along the pipe,
   away from the viewer, while the graticule slowly turns.
   New ends approach a far depth asymptotically, so the pipe
   keeps going "into infinity" without leaving the fog.
   ========================================================= */

const RADIUS = 2.2;
const RADIAL = 40;
const SAMPLE = 0.4; // ring spacing along the pipe
const CAP_RINGS = 7; // rounded end cap
const DEPTH_MAX = 140; // new ends approach this depth
const DEPTH_KEEP = 0.82; // fraction of remaining depth kept per click
const GROW_MIN = 28; // units per second the pipe grows into a new segment
const BAND = 2.6;
const WANDER_IDLE_S = 3.5;
const FOG_COLOR = 0x0a1024;
const COLOR_A = 0x1f4fd1; // flight-map blue
const COLOR_B = 0xe9eef9; // paper white

const VERT = /* glsl */ `
  uniform float uSBase;
  attribute float aS;
  attribute float aTheta;
  varying float vS;
  varying float vTheta;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vS = aS + uSBase;
    vTheta = aTheta;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uFlow;
  uniform float uTwist;
  uniform float uBand;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying float vS;
  varying float vTheta;
  varying vec3 vNormal;
  varying vec3 vView;

  float gridLine(float x, float width) {
    float d = abs(fract(x - 0.5) - 0.5);
    float w = fwidth(x) * width;
    return 1.0 - smoothstep(w * 0.5, w * 1.5, d);
  }

  void main() {
    // bands (and ring lines) stream away from the viewer
    float s = vS - uFlow;
    float band = mod(floor(s / uBand), 2.0);
    vec3 base = mix(uA, uB, band);

    float depth = -vView.z;
    float rings = gridLine(s / (uBand * 0.5), 1.2);
    float meridians = gridLine(vTheta * 24.0 + uTwist, 1.2);
    float grid = max(rings, meridians) * (1.0 - smoothstep(25.0, 90.0, depth));

    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vView);
    if (dot(n, v) < 0.0) n = -n;
    vec3 L = normalize(vec3(-0.35, 0.8, 0.55));
    float diff = 0.42 + 0.58 * max(dot(n, L), 0.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);

    vec3 col = base * diff;
    col = mix(col, vec3(1.0), grid * 0.35);
    col += rim * 0.22 * mix(uB, uA, band);

    float fog = smoothstep(uFogNear, uFogFar, depth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`;

export default function PipeCanvas({
  controls,
  onSteer,
}: {
  controls: PipeControls;
  onSteer?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef(controls);
  const onSteerRef = useRef(onSteer);

  useEffect(() => {
    controlsRef.current = controls;
    onSteerRef.current = onSteer;
  }, [controls, onSteer]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    loadThree()
      .then((THREE) => {
        if (disposed || !host.isConnected) return;
        const V = THREE.Vector3;
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setClearColor(FOG_COLOR, 1);
        host.appendChild(renderer.domElement);
        renderer.domElement.style.touchAction = "none";

        const scene = new THREE.Scene();
        // Fixed camera at the origin looking down -z
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
        const FORWARD = new V(0, 0, -1);

        // ---------- append-only path ----------
        // Ring samples: position + parallel-transported frame + arc length
        let px: number[] = [], py: number[] = [], pz: number[] = [];
        let nx: number[] = [], ny: number[] = [], nz: number[] = [];
        let bx: number[] = [], by: number[] = [], bz: number[] = [];
        let tx: number[] = [], ty: number[] = [], tz: number[] = [];
        let ss: number[] = [];
        let endP = new V();
        let endT = new V();
        let endDepth = 0;
        let revealS = 0; // how much of the pipe is grown so far
        let lastAddAt = 0;

        const pushSample = (p: THREENS.Vector3, t: THREENS.Vector3, n: THREENS.Vector3, s: number) => {
          const b = t.clone().cross(n).normalize();
          px.push(p.x); py.push(p.y); pz.push(p.z);
          tx.push(t.x); ty.push(t.y); tz.push(t.z);
          nx.push(n.x); ny.push(n.y); nz.push(n.z);
          bx.push(b.x); by.push(b.y); bz.push(b.z);
          ss.push(s);
        };

        // ---------- tube geometry (append-only buffers) ----------
        const vertsPerRing = RADIAL + 1;
        let capacity = 0; // rings
        let firstUnwritten = 0;
        let positions = new Float32Array(0);
        let normals = new Float32Array(0);
        let sAttr = new Float32Array(0);
        let theta = new Float32Array(0);
        const geo = new THREE.BufferGeometry();

        const ensureCapacity = () => {
          if (ss.length <= capacity) return;
          const cap = Math.max(1024, Math.ceil(ss.length * 1.5));
          const grow = (old: Float32Array, per: number) => {
            const a = new Float32Array(cap * vertsPerRing * per);
            a.set(old);
            return a;
          };
          positions = grow(positions, 3);
          normals = grow(normals, 3);
          sAttr = grow(sAttr, 1);
          theta = grow(theta, 1);
          for (let r = capacity; r < cap; r++)
            for (let j = 0; j <= RADIAL; j++) theta[r * vertsPerRing + j] = j / RADIAL;
          const index: number[] = [];
          for (let r = 0; r < cap - 1; r++)
            for (let j = 0; j < RADIAL; j++) {
              const a = r * vertsPerRing + j;
              const b = a + vertsPerRing;
              index.push(a, b, a + 1, a + 1, b, b + 1);
            }
          geo.setIndex(index);
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
          geo.setAttribute("aS", new THREE.BufferAttribute(sAttr, 1));
          geo.setAttribute("aTheta", new THREE.BufferAttribute(theta, 1));
          capacity = cap;
        };

        const writeRings = (from: number) => {
          for (let i = from; i < ss.length; i++) {
            let v = i * vertsPerRing;
            for (let j = 0; j <= RADIAL; j++) {
              const a = (j / RADIAL) * Math.PI * 2;
              const c = Math.cos(a), sn = Math.sin(a);
              const ox = nx[i] * c + bx[i] * sn;
              const oy = ny[i] * c + by[i] * sn;
              const oz = nz[i] * c + bz[i] * sn;
              normals[v * 3] = ox; normals[v * 3 + 1] = oy; normals[v * 3 + 2] = oz;
              positions[v * 3] = px[i] + ox * RADIUS;
              positions[v * 3 + 1] = py[i] + oy * RADIUS;
              positions[v * 3 + 2] = pz[i] + oz * RADIUS;
              sAttr[v] = ss[i];
              v++;
            }
          }
          firstUnwritten = ss.length;
          for (const name of ["position", "normal", "aS"]) {
            (geo.getAttribute(name) as THREENS.BufferAttribute).needsUpdate = true;
          }
        };

        /** Append a Hermite segment from the current end to B. */
        const appendSegment = (B: THREENS.Vector3) => {
          const A = endP.clone();
          const chord = A.distanceTo(B);
          if (chord < 1) return;
          const m0 = endT.clone().multiplyScalar(chord);
          // arrive heading onward, into the screen
          const tB = B.clone().sub(A).normalize().addScaledVector(FORWARD, 0.6).normalize();
          const m1 = tB.multiplyScalar(chord);
          const at = (u: number, out: THREENS.Vector3) => {
            const u2 = u * u, u3 = u2 * u;
            const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u;
            const h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
            return out
              .copy(A).multiplyScalar(h00)
              .addScaledVector(m0, h10)
              .addScaledVector(B, h01)
              .addScaledVector(m1, h11);
          };
          // arc-length table
          const N = 240;
          const lens = [0];
          const prev = at(0, new V());
          const cur = new V();
          for (let i = 1; i <= N; i++) {
            at(i / N, cur);
            lens.push(lens[i - 1] + cur.distanceTo(prev));
            prev.copy(cur);
          }
          const total = lens[N];
          const s0 = ss[ss.length - 1];
          const n = new V(nx[nx.length - 1], ny[ny.length - 1], nz[nz.length - 1]);
          const p = new V();
          const q = new V();
          let k = 0;
          for (let d = SAMPLE; d <= total; d += SAMPLE) {
            while (k < N - 1 && lens[k + 1] < d) k++;
            const u = (k + (d - lens[k]) / (lens[k + 1] - lens[k])) / N;
            at(u, p);
            at(Math.min(u + 0.002, 1), q);
            const t = q.sub(p).lengthSq() > 1e-10 ? q.clone().normalize() : endT.clone();
            // parallel transport keeps the frame from twisting
            n.addScaledVector(t, -n.dot(t)).normalize();
            pushSample(p, t, n, s0 + d);
          }
          endP = new V(px[px.length - 1], py[py.length - 1], pz[pz.length - 1]);
          endT = new V(tx[tx.length - 1], ty[ty.length - 1], tz[tz.length - 1]);
          endDepth = -endP.z;
          lastAddAt = performance.now() / 1000;
          ensureCapacity();
          writeRings(firstUnwritten);
        };

        const nextDepth = () => DEPTH_MAX - (DEPTH_MAX - endDepth) * DEPTH_KEEP;

        /** Point on the camera ray through ndc (x, y) at a given depth. */
        const pointAt = (x: number, y: number, depth: number) => {
          const dir = new V(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
          return camera.position.clone().addScaledVector(dir, depth / dir.dot(FORWARD));
        };

        const shared = {
          uA: { value: new THREE.Color(COLOR_A) },
          uB: { value: new THREE.Color(COLOR_B) },
          uFlow: { value: 0 },
          uTwist: { value: 0 },
          uBand: { value: BAND },
          uFog: { value: new THREE.Color(FOG_COLOR) },
          uFogNear: { value: 55 },
          uFogFar: { value: 175 },
        };
        const makeMat = () =>
          new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: { ...shared, uSBase: { value: 0 } },
            side: THREE.DoubleSide,
          });
        const tubeMat = makeMat();
        const tube = new THREE.Mesh(geo, tubeMat);
        tube.frustumCulled = false;
        scene.add(tube);

        // Rounded cap riding the growing tip, in local frame (x = n, y = b, z = t)
        const capGeo = new THREE.BufferGeometry();
        {
          const pos: number[] = [], nrm: number[] = [], sv: number[] = [], th: number[] = [], idx: number[] = [];
          for (let k = 0; k <= CAP_RINGS; k++) {
            const phi = (k / CAP_RINGS) * (Math.PI / 2);
            const r = Math.cos(phi) * RADIUS;
            const h = Math.sin(phi) * RADIUS;
            for (let j = 0; j <= RADIAL; j++) {
              const a = (j / RADIAL) * Math.PI * 2;
              pos.push(Math.cos(a) * r, Math.sin(a) * r, h);
              nrm.push(Math.cos(a) * Math.cos(phi), Math.sin(a) * Math.cos(phi), Math.sin(phi));
              sv.push(h);
              th.push(j / RADIAL);
            }
          }
          for (let k = 0; k < CAP_RINGS; k++)
            for (let j = 0; j < RADIAL; j++) {
              const a = k * vertsPerRing + j;
              const b = a + vertsPerRing;
              idx.push(a, b, a + 1, a + 1, b, b + 1);
            }
          capGeo.setIndex(idx);
          capGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          capGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
          capGeo.setAttribute("aS", new THREE.Float32BufferAttribute(sv, 1));
          capGeo.setAttribute("aTheta", new THREE.Float32BufferAttribute(th, 1));
        }
        const capMat = makeMat();
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.matrixAutoUpdate = false;
        cap.frustumCulled = false;
        scene.add(cap);

        const basis = new THREE.Matrix4();
        const placeCap = (f: number) => {
          // f = fractional ring index of the tip
          const i = Math.max(0, Math.min(Math.floor(f), ss.length - 2));
          const u = Math.min(Math.max(f - i, 0), 1);
          const L = (a: number[]) => a[i] + (a[i + 1] - a[i]) * u;
          const n = new V(L(nx), L(ny), L(nz)).normalize();
          const t = new V(L(tx), L(ty), L(tz)).normalize();
          const b = t.clone().cross(n).normalize();
          basis.makeBasis(n, b, t).setPosition(L(px), L(py), L(pz));
          cap.matrix.copy(basis);
          cap.matrixWorldNeedsUpdate = true;
          capMat.uniforms.uSBase.value = L(ss);
        };

        // ---------- start / reset ----------
        const reset = () => {
          px = []; py = []; pz = []; nx = []; ny = []; nz = [];
          bx = []; by = []; bz = []; tx = []; ty = []; tz = []; ss = [];
          firstUnwritten = 0;
          // enters from off-screen bottom-left, heading into the screen
          endP = new V(-10, -7.5, 3);
          endT = new V(0.38, 0.28, -1).normalize();
          const n0 = new V(0, 1, 0).addScaledVector(endT, -endT.y).normalize();
          pushSample(endP, endT, n0, 0);
          endDepth = -endP.z;
          ensureCapacity();
          appendSegment(new V(-3.2, -2.4, -20));
          appendSegment(pointAt(0.08, 0.1, 40));
          revealS = ss[ss.length - 1];
          shared.uFlow.value = 0;
        };

        // ---------- input ----------
        const clampX = (x: number) => Math.max(-0.85, Math.min(0.85, x));
        const clampY = (y: number) => Math.max(-0.8, Math.min(0.8, y));
        const extendTo = (x: number, y: number) => {
          appendSegment(pointAt(x, y, nextDepth()));
          onSteerRef.current?.();
        };
        const endNdc = () => endP.clone().project(camera);
        const wanderStep = () => {
          const e = endNdc();
          const a = Math.random() * Math.PI * 2;
          const r = 0.25 + Math.random() * 0.35;
          // drift back toward the middle so it doesn't pin to an edge
          extendTo(clampX(e.x * 0.6 + Math.cos(a) * r), clampY(e.y * 0.6 + Math.sin(a) * r));
        };
        const onPointer = (ev: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          extendTo(
            ((ev.clientX - rect.left) / rect.width) * 2 - 1,
            -((ev.clientY - rect.top) / rect.height) * 2 + 1
          );
        };
        const onKey = (ev: KeyboardEvent) => {
          const dirs: Record<string, [number, number]> = {
            ArrowLeft: [-0.35, 0],
            ArrowRight: [0.35, 0],
            ArrowUp: [0, 0.3],
            ArrowDown: [0, -0.3],
          };
          if ((ev.target as HTMLElement)?.closest?.("button, input, a")) return;
          if (dirs[ev.key]) {
            ev.preventDefault();
            const e = endNdc();
            extendTo(clampX(e.x + dirs[ev.key][0]), clampY(e.y + dirs[ev.key][1]));
          } else if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            wanderStep();
          }
        };
        renderer.domElement.addEventListener("pointerdown", onPointer);
        window.addEventListener("keydown", onKey);

        const resize = () => {
          const rect = host.getBoundingClientRect();
          const w = Math.min(Math.max(1, rect.width), 4096);
          const h = Math.min(Math.max(1, rect.height), 4096);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        resize();
        camera.updateMatrixWorld();
        reset();
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        let last = performance.now() / 1000;
        let resetToken = controlsRef.current.resetToken;
        const animate = () => {
          if (disposed) return;
          raf = requestAnimationFrame(animate);
          const now = performance.now() / 1000;
          const dt = Math.min(now - last, 0.05);
          last = now;
          const c = controlsRef.current;
          if (c.resetToken !== resetToken) {
            resetToken = c.resetToken;
            reset();
          }
          const total = ss[ss.length - 1];
          if (revealS < total) {
            const remaining = total - revealS;
            revealS = Math.min(total, revealS + Math.max(GROW_MIN, remaining * 2.2) * dt);
          } else if (c.wander && now - lastAddAt > WANDER_IDLE_S) {
            wanderStep();
          }
          const flow = reduceMotion ? Math.min(c.speed, 2) : c.speed;
          shared.uFlow.value += flow * dt;
          if (!reduceMotion) shared.uTwist.value += dt * 0.12;

          // draw only the grown part; the cap sits on the tip
          const tipF = revealS / SAMPLE;
          const rings = Math.min(Math.floor(tipF) + 1, ss.length);
          geo.setDrawRange(0, Math.max(0, rings - 1) * RADIAL * 6);
          placeCap(tipF);
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(animate);

        cleanup = () => {
          ro.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointer);
          window.removeEventListener("keydown", onKey);
          geo.dispose();
          capGeo.dispose();
          tubeMat.dispose();
          capMat.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        // WebGL/CDN unavailable — the lab shows its fallback text
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="A striped pipe running away into the distance. Click, or use the arrow keys, to extend it toward a new point."
      className="absolute inset-0 cursor-crosshair"
    />
  );
}

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
  speed: number; // world units per second
  wander: boolean; // random loops when idle
  resetToken: number; // bump to restart
};

/* =========================================================
   Endless pipe.

   The path is a dense polyline (one sample every STEP units)
   with parallel-transport frames, generated just past the
   horizon as the camera rides alongside it. The camera sits
   above-right of the pipe, so it enters from the bottom-left
   and recedes into the screen. Bands are fixed to arc length,
   so riding forward reads as motion; the grid slowly turns
   like a globe.

   A click re-plans everything past a short distance ahead:
   the new path steers toward a point on the clicked ray, in a
   new pair of colors, and the old tail morphs into it.
   ========================================================= */

const STEP = 0.5;
const RADIUS = 2.2;
const RADIAL = 48;
const AHEAD = 170;
const BEHIND = 14;
const MAX_RINGS = Math.ceil((AHEAD + BEHIND) / STEP) + 8;
const BAND = 2.4; // length of one color band
const REPLAN_AHEAD = 30; // clicks keep this much of the current path
const TARGET_DIST = 70; // how far down the clicked ray the pipe aims
const MORPH_S = 0.7;
const FOG_COLOR = 0x0a1024;

// Alternating band pairs; each click advances to the next pair.
const PALETTES: [number, number][] = [
  [0x1f4fd1, 0xe9eef9], // flight-map blue / paper white
  [0xf25c54, 0xffd6a5], // coral / peach
  [0x2ec4b6, 0x1d5a86], // teal / deep sea
  [0xffbe0b, 0x3a0ca3], // marigold / indigo
  [0x8338ec, 0xff006e], // violet / magenta
  [0x06d6a0, 0x118ab2], // mint / cerulean
];

const VERT = /* glsl */ `
  attribute float aS;
  attribute float aTheta;
  attribute float aPal;
  varying float vS;
  varying float vTheta;
  varying float vPal;
  varying vec3 vNormal;
  varying float vDepth;
  void main() {
    vS = aS;
    vTheta = aTheta;
    vPal = aPal;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uPalA[${PALETTES.length}];
  uniform vec3 uPalB[${PALETTES.length}];
  uniform float uTwist;
  uniform float uBand;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying float vS;
  varying float vTheta;
  varying float vPal;
  varying vec3 vNormal;
  varying float vDepth;

  float gridLine(float x, float width) {
    float d = abs(fract(x - 0.5) - 0.5);
    float w = fwidth(x) * width;
    return 1.0 - smoothstep(w * 0.5, w * 1.5, d);
  }

  void main() {
    int pi = int(vPal + 0.5);
    vec3 a = uPalA[0];
    vec3 b = uPalB[0];
    for (int i = 0; i < ${PALETTES.length}; i++) {
      if (i == pi) { a = uPalA[i]; b = uPalB[i]; }
    }
    float band = mod(floor(vS / uBand), 2.0);
    vec3 base = mix(a, b, band);

    // globe-style graticule: rings along the pipe, meridians that slowly turn
    float rings = gridLine(vS / (uBand * 0.5), 1.2);
    float meridians = gridLine(vTheta * 24.0 + uTwist, 1.2);
    // fade the graticule with distance so far-off rings don't shimmer
    float grid = max(rings, meridians) * (1.0 - smoothstep(25.0, 80.0, vDepth));

    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 L = normalize(vec3(-0.35, 0.8, 0.55));
    float diff = 0.42 + 0.58 * max(dot(n, L), 0.0);
    float rim = pow(1.0 - abs(n.z), 2.5);

    vec3 col = base * diff;
    col = mix(col, vec3(1.0), grid * 0.35);
    col += rim * 0.22 * mix(b, a, band);

    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`;

type Sample = {
  p: THREENS.Vector3;
  t: THREENS.Vector3;
  n: THREENS.Vector3;
  b: THREENS.Vector3;
  s: number;
  pal: number;
};

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
        const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

        // ---------- path ----------
        let samples: Sample[] = [];
        let pal = 0;
        let target: THREENS.Vector3 | null = null;
        let yawRate = 0;
        let pitchRate = 0;
        let loopSteps = 0;
        let loopYaw = 0;
        let loopPitch = 0;
        let camS = 0;
        let morph: { from: number; old: Sample[]; t0: number } | null = null;

        const extendOnce = () => {
          const last = samples[samples.length - 1];
          const h = last.t.clone();
          if (target) {
            const to = target.clone().sub(last.p);
            const dist = to.length();
            if (dist < 5 || (to.dot(h) < 0 && dist < 25)) {
              target = null;
            } else {
              to.normalize();
              const ang = h.angleTo(to);
              if (ang > 1e-4) {
                const axis = h.clone().cross(to).normalize();
                h.applyAxisAngle(axis, Math.min(ang, 0.045)); // turn radius ~11 units
              }
            }
          }
          if (!target) {
            const wander = controlsRef.current.wander;
            if (loopSteps > 0) {
              loopSteps--;
              yawRate = loopYaw;
              pitchRate = loopPitch;
            } else {
              const lim = wander ? 0.022 : 0.01;
              yawRate = Math.max(-lim, Math.min(lim, (yawRate + (Math.random() - 0.5) * 0.006) * 0.985));
              pitchRate = Math.max(-lim, Math.min(lim, (pitchRate + (Math.random() - 0.5) * 0.006) * 0.985));
              if (wander && Math.random() < 0.0015) {
                // a full loop-the-loop (radius ~16 units)
                loopSteps = 200;
                loopYaw = (Math.random() < 0.5 ? -1 : 1) * 0.032 * Math.random();
                loopPitch = (Math.random() < 0.5 ? -1 : 1) * 0.032;
              }
            }
            h.applyAxisAngle(last.n, yawRate);
            h.applyAxisAngle(last.b, pitchRate);
          }
          h.normalize();
          const p = last.p.clone().addScaledVector(h, STEP);
          // parallel transport keeps the frame from twisting
          const n = last.n.clone().addScaledVector(h, -last.n.dot(h)).normalize();
          const b = h.clone().cross(n).normalize();
          samples.push({ p, t: h, n, b, s: last.s + STEP, pal });
        };

        const fillToHorizon = () => {
          while (samples[samples.length - 1].s < camS + AHEAD + 4) extendOnce();
        };

        const reset = () => {
          samples = [
            { p: new V(0, 0, 0), t: new V(0, 0, -1), n: new V(0, 1, 0), b: new V(1, 0, 0), s: 0, pal: 0 },
          ];
          pal = 0;
          target = null;
          yawRate = pitchRate = 0;
          loopSteps = 0;
          morph = null;
          camS = BEHIND + 4;
          fillToHorizon();
        };
        reset();

        const indexOf = (s: number) => (s - samples[0].s) / STEP;

        const frameAt = (s: number) => {
          const f = Math.max(0, Math.min(indexOf(s), samples.length - 1.001));
          const i = Math.floor(f);
          const u = f - i;
          const A = samples[i];
          const B = samples[i + 1];
          return {
            p: A.p.clone().lerp(B.p, u),
            t: A.t.clone().lerp(B.t, u).normalize(),
            n: A.n.clone().lerp(B.n, u).normalize(),
            b: A.b.clone().lerp(B.b, u).normalize(),
          };
        };

        const steerTo = (point: THREENS.Vector3) => {
          const cut = Math.min(Math.floor(indexOf(camS + REPLAN_AHEAD)), samples.length - 2);
          const old = samples.slice(cut + 1);
          samples.length = cut + 1;
          pal = (pal + 1) % PALETTES.length;
          target = point;
          loopSteps = 0;
          yawRate = pitchRate = 0;
          fillToHorizon();
          morph = { from: cut + 1, old, t0: performance.now() / 1000 };
          onSteerRef.current?.();
        };

        // ---------- tube mesh (rebuilt from the path window every frame) ----------
        const vertsPerRing = RADIAL + 1;
        const maxVerts = MAX_RINGS * vertsPerRing;
        const positions = new Float32Array(maxVerts * 3);
        const normals = new Float32Array(maxVerts * 3);
        const sAttr = new Float32Array(maxVerts);
        const palAttr = new Float32Array(maxVerts);
        const theta = new Float32Array(maxVerts);
        for (let r = 0; r < MAX_RINGS; r++)
          for (let j = 0; j <= RADIAL; j++) theta[r * vertsPerRing + j] = j / RADIAL;
        const index: number[] = [];
        for (let r = 0; r < MAX_RINGS - 1; r++)
          for (let j = 0; j < RADIAL; j++) {
            const a = r * vertsPerRing + j;
            const b = a + vertsPerRing;
            index.push(a, b, a + 1, a + 1, b, b + 1);
          }
        const geo = new THREE.BufferGeometry();
        geo.setIndex(index);
        const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
        const nrmAttr = new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage);
        const sBuf = new THREE.BufferAttribute(sAttr, 1).setUsage(THREE.DynamicDrawUsage);
        const palBuf = new THREE.BufferAttribute(palAttr, 1).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("position", posAttr);
        geo.setAttribute("normal", nrmAttr);
        geo.setAttribute("aS", sBuf);
        geo.setAttribute("aPal", palBuf);
        geo.setAttribute("aTheta", new THREE.BufferAttribute(theta, 1));

        const uniforms = {
          uPalA: { value: PALETTES.map(([a]) => new THREE.Color(a)) },
          uPalB: { value: PALETTES.map(([, b]) => new THREE.Color(b)) },
          uTwist: { value: 0 },
          uBand: { value: BAND },
          uFog: { value: new THREE.Color(FOG_COLOR) },
          uFogNear: { value: 40 },
          uFogFar: { value: AHEAD - 5 },
        };
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        scene.add(mesh);

        const tmpP = new V();
        const tmpN = new V();
        const tmpB = new V();
        const rebuild = (now: number) => {
          const i0 = Math.max(0, Math.floor(indexOf(camS - BEHIND)));
          const i1 = Math.min(samples.length - 1, i0 + MAX_RINGS - 1);
          let e = 1;
          if (morph) {
            e = Math.min((now - morph.t0) / MORPH_S, 1);
            e = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
          }
          let v = 0;
          for (let i = i0; i <= i1; i++) {
            const S = samples[i];
            tmpP.copy(S.p);
            tmpN.copy(S.n);
            tmpB.copy(S.b);
            if (morph && e < 1 && i >= morph.from) {
              const O = morph.old[i - morph.from];
              if (O) {
                tmpP.copy(O.p).lerp(S.p, e);
                tmpN.copy(O.n).lerp(S.n, e).normalize();
                tmpB.copy(O.b).lerp(S.b, e).normalize();
              }
            }
            for (let j = 0; j <= RADIAL; j++) {
              const a = (j / RADIAL) * Math.PI * 2;
              const c = Math.cos(a);
              const sn = Math.sin(a);
              const nx = tmpN.x * c + tmpB.x * sn;
              const ny = tmpN.y * c + tmpB.y * sn;
              const nz = tmpN.z * c + tmpB.z * sn;
              normals[v * 3] = nx;
              normals[v * 3 + 1] = ny;
              normals[v * 3 + 2] = nz;
              positions[v * 3] = tmpP.x + nx * RADIUS;
              positions[v * 3 + 1] = tmpP.y + ny * RADIUS;
              positions[v * 3 + 2] = tmpP.z + nz * RADIUS;
              sAttr[v] = S.s;
              palAttr[v] = S.pal;
              v++;
            }
          }
          if (morph && e >= 1) morph = null;
          geo.setDrawRange(0, Math.max(0, i1 - i0) * RADIAL * 6);
          posAttr.needsUpdate = true;
          nrmAttr.needsUpdate = true;
          sBuf.needsUpdate = true;
          palBuf.needsUpdate = true;
        };

        // ---------- camera rides above-right of the pipe ----------
        const camPos = new V();
        const camLook = new V();
        const camUp = new V(0, 1, 0);
        const placeCamera = (k: number) => {
          const f = frameAt(camS);
          // aim only a short way down the pipe so its near end stays anchored bottom-left
          const ahead = frameAt(camS + 14);
          const want = f.p.clone().addScaledVector(f.n, 4.0).addScaledVector(f.b, 3.3);
          const look = ahead.p.clone().addScaledVector(ahead.n, 1.6).addScaledVector(ahead.b, 2.4);
          if (k >= 1) {
            camPos.copy(want);
            camLook.copy(look);
            camUp.copy(f.n);
          } else {
            camPos.lerp(want, k);
            camLook.lerp(look, k * 0.7);
            camUp.lerp(f.n, k * 0.5).normalize();
          }
          camera.position.copy(camPos);
          camera.up.copy(camUp);
          camera.lookAt(camLook);
        };
        placeCamera(1);

        // ---------- input ----------
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const steerToScreen = (x: number, y: number) => {
          ndc.set(x, y);
          raycaster.setFromCamera(ndc, camera);
          steerTo(raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, TARGET_DIST));
        };
        const onPointer = (ev: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          steerToScreen(
            ((ev.clientX - rect.left) / rect.width) * 2 - 1,
            -((ev.clientY - rect.top) / rect.height) * 2 + 1
          );
        };
        const onKey = (ev: KeyboardEvent) => {
          const dirs: Record<string, [number, number]> = {
            ArrowLeft: [-0.65, 0],
            ArrowRight: [0.65, 0],
            ArrowUp: [0, 0.6],
            ArrowDown: [0, -0.6],
          };
          if (dirs[ev.key]) {
            ev.preventDefault();
            steerToScreen(...dirs[ev.key]);
          } else if (ev.key === " " || ev.key === "Enter") {
            if ((ev.target as HTMLElement)?.closest?.("button, input, a")) return;
            ev.preventDefault();
            steerToScreen(Math.random() * 1.4 - 0.7, Math.random() * 1.2 - 0.6);
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
            placeCamera(1);
          }
          const speed = reduceMotion ? Math.min(c.speed, 3) : c.speed;
          camS += speed * dt;
          if (!reduceMotion) uniforms.uTwist.value += dt * 0.12;
          fillToHorizon();
          // drop samples far behind the camera
          const drop = Math.floor(indexOf(camS - BEHIND - 10));
          if (drop > 200) {
            samples = samples.slice(drop);
            if (morph) {
              morph.from -= drop;
              if (morph.from < 0) {
                morph.old = morph.old.slice(-morph.from);
                morph.from = 0;
              }
            }
          }
          rebuild(now);
          placeCamera(1 - Math.exp(-dt * 5));
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(animate);

        cleanup = () => {
          ro.disconnect();
          renderer.domElement.removeEventListener("pointerdown", onPointer);
          window.removeEventListener("keydown", onKey);
          geo.dispose();
          mat.dispose();
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
      aria-label="An endless striped pipe curving into the distance. Click, or use the arrow keys, to bend it."
      className="absolute inset-0 cursor-crosshair"
    />
  );
}

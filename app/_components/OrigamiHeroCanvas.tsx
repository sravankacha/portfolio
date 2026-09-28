"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";
import { ANIMALS } from "./origami/animals";
import type { SculptMesh } from "./origami/sculpt";

const THREE_CDN = "https://esm.sh/three@0.180.0";

// Runtime CDN import — new Function defeats static analysis so Three stays out of the bundle.
function loadThree(): Promise<typeof THREENS> {
  return new Function("u", "return import(u)")(THREE_CDN) as Promise<
    typeof THREENS
  >;
}

/* =========================================================
   Paper animals.

   Each animal is sculpted from blended anatomy primitives and
   meshed into ~15–40k flat-shaded paper facets in a worker
   (see ./origami). Animals don't share topology, so the refold
   goes through a crumpled paper ball: every mesh carries a
   morph target onto the same ball, so the swap at full crumple
   is seamless.
   ========================================================= */

const HOLD_S = 4.8; // idle time per animal
const FOLD_S = 1.05; // animal -> paper ball
const UNFOLD_S = 1.25; // paper ball -> next animal
const INTRO_S = 1.4; // first unfold on load

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Deterministic pseudo-random in [-1, 1]
function rnd(a: number, b: number, salt: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + salt * 74.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
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
    const worker = new Worker(
      new URL("./origami/mesh.worker.ts", import.meta.url),
      { type: "module" }
    );
    const pending: SculptMesh[] = [];
    let onMesh: ((index: number, m: SculptMesh) => void) | null = null;
    worker.onmessage = (ev: MessageEvent<SculptMesh & { index: number }>) => {
      const { index, ...m } = ev.data;
      if (onMesh) onMesh(index, m);
      else pending[index] = m;
    };
    worker.postMessage("build");

    loadThree()
      .then((THREE) => {
        if (disposed || !host.isConnected) return;

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        const FOV = 34;
        const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180));
        const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
        camera.position.set(0, 1.5, 4.7);
        camera.lookAt(0, 0.05, 0);

        // Paper lighting: soft warm sky/ground bounce, a shadow-casting key for
        // crisp facets, a cool rim from behind to carve the silhouette.
        const hemi = new THREE.HemisphereLight(0xfffdf8, 0x9dbcb1, 1.25);
        scene.add(hemi);
        const key = new THREE.DirectionalLight(0xfff6e8, 2.1);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.left = -3;
        key.shadow.camera.right = 3;
        key.shadow.camera.top = 3;
        key.shadow.camera.bottom = -3;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 20;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.025;
        key.shadow.radius = 4;
        scene.add(key);
        scene.add(key.target);
        const fill = new THREE.DirectionalLight(0xf0e6d4, 0.4);
        fill.position.set(-3, 1.5, -2);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xe6f4ff, 0.9);
        rim.position.set(-2, 3, -4);
        scene.add(rim);

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

        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.88,
          metalness: 0,
          flatShading: true,
          side: THREE.DoubleSide,
        });

        const geometries: (THREENS.BufferGeometry | undefined)[] = [];
        const toGeometry = (m: SculptMesh) => {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
          g.setAttribute("color", new THREE.BufferAttribute(m.colors, 3));
          g.morphAttributes.position = [new THREE.BufferAttribute(m.ball, 3)];
          g.morphAttributes.color = [new THREE.BufferAttribute(m.ballColors, 3)];
          g.computeBoundingSphere();
          return g;
        };

        const group = new THREE.Group();
        group.scale.setScalar(0.75);
        group.position.y = -0.82; // center animal vertically in frame
        // Face -x (toward the intro text) with the head angled out at the viewer
        group.rotation.y = Math.PI + 0.55;
        scene.add(group);

        let mesh: THREENS.Mesh | null = null;

        // Contact shadow from the key light + a soft ambient blob underneath
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 8),
          new THREE.ShadowMaterial({ color: 0x1f2a26, opacity: 0.2 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        group.add(ground);

        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = shadowCanvas.height = 128;
        const ctx = shadowCanvas.getContext("2d")!;
        const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        grad.addColorStop(0, "rgba(34, 31, 26, 0.26)");
        grad.addColorStop(0.6, "rgba(34, 31, 26, 0.08)");
        grad.addColorStop(1, "rgba(34, 31, 26, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const blob = new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(shadowCanvas),
            transparent: true,
            depthWrite: false,
          })
        );
        blob.rotation.x = -Math.PI / 2;
        blob.position.y = 0.004;
        group.add(blob);

        const BALL_BLOB: [number, number] = [1.1, 1.1];
        const setBlob = (s: [number, number]) => blob.scale.set(s[0], s[1], 1);

        const setCaption = (name: string) => {
          if (captionEl) captionEl.textContent = name;
        };
        const setCaptionOpacity = (o: number) => {
          if (captionEl?.parentElement)
            captionEl.parentElement.style.opacity = String(o);
        };

        const proj = new THREE.Vector3();
        const placeKey = (angle: number) => {
          const gx = group.position.x;
          key.target.position.set(gx, 0, 0);
          key.position.set(
            gx + 2.5 + Math.sin(angle) * 3.2,
            4.8 + Math.cos(angle * 0.83) * 1.2,
            3
          );
        };
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
          placeKey(lightT);
          // Anchor the caption just below the beast
          if (captionEl?.parentElement) {
            proj.set(gx, -1.12, 0).project(camera);
            captionEl.parentElement.style.left = `${((proj.x + 1) / 2) * 100}%`;
            captionEl.parentElement.style.top = `${((1 - proj.y) / 2) * 100}%`;
          }
          renderer.render(scene, camera);
        };

        let lightT = 0;
        host.appendChild(renderer.domElement);
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        cleanupResize = () => ro.disconnect();

        // State machine: intro (ball -> first animal), idle, fold, unfold
        let current = 0;
        let phase: "wait" | "intro" | "idle" | "fold" | "unfold" = "wait";
        let phaseStart = performance.now() / 1000;
        let lastNow = phaseStart;
        const baseRotY = group.rotation.y;
        let spin = 0;

        const setCrumple = (v: number) => {
          if (mesh?.morphTargetInfluences) mesh.morphTargetInfluences[0] = v;
        };
        const showAnimal = (i: number) => {
          const g = geometries[i];
          if (!g) return;
          if (!mesh) {
            mesh = new THREE.Mesh(g, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            group.add(mesh);
          } else {
            mesh.geometry = g;
            mesh.updateMorphTargets();
          }
        };
        const lerpBlob = (a: [number, number], b: [number, number], t: number) =>
          setBlob([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);

        const start = () => {
          showAnimal(0);
          setCaption(ANIMALS[0].name);
          if (reduceMotion) {
            setCrumple(0);
            setBlob(ANIMALS[0].shadow);
            renderer?.render(scene, camera);
            return;
          }
          phase = "intro";
          phaseStart = performance.now() / 1000;
          setCrumple(1);
          setCaptionOpacity(0);
        };

        onMesh = (i, m) => {
          geometries[i] = toGeometry(m);
          if (i === 0) start();
        };
        pending.forEach((m, i) => m && onMesh!(i, m));

        if (reduceMotion) return; // static first animal, no cycling

        const animate = () => {
          if (disposed || !renderer) return;
          raf = requestAnimationFrame(animate);
          const now = performance.now() / 1000;
          const t = now - phaseStart;
          const dt = Math.min(now - lastNow, 0.1);
          lastNow = now;

          // Light drifts lazily at rest, sweeps during a refold
          lightT += dt * (phase === "fold" || phase === "unfold" ? 1.6 : 0.2);
          placeKey(lightT);

          const next = (current + 1) % ANIMALS.length;
          const bob = Math.sin(now * 1.1) * 0.012;

          if (phase === "intro") {
            const p = Math.min(t / INTRO_S, 1);
            const e = easeInOutCubic(p);
            setCrumple(1 - e);
            lerpBlob(BALL_BLOB, ANIMALS[0].shadow, e);
            group.rotation.y = baseRotY + (1 - e) * Math.PI;
            if (p >= 1) {
              phase = "idle";
              phaseStart = now;
              setCaptionOpacity(1);
            }
          } else if (phase === "idle") {
            group.rotation.y = baseRotY + Math.sin(now * 0.5) * 0.09;
            group.position.y = -0.82 + bob;
            if (t > HOLD_S && geometries[next]) {
              phase = "fold";
              phaseStart = now;
              spin = 0;
              setCaptionOpacity(0);
            }
          } else if (phase === "fold") {
            const p = Math.min(t / FOLD_S, 1);
            const e = easeInOutCubic(p);
            setCrumple(e);
            lerpBlob(ANIMALS[current].shadow, BALL_BLOB, e);
            spin = e * Math.PI;
            group.rotation.y = baseRotY + spin;
            group.position.y = -0.82 + Math.sin(p * Math.PI) * 0.12;
            if (p >= 1) {
              current = next;
              showAnimal(current);
              setCrumple(1);
              setCaption(ANIMALS[current].name);
              phase = "unfold";
              phaseStart = now;
            }
          } else if (phase === "unfold") {
            const p = Math.min(t / UNFOLD_S, 1);
            const e = easeInOutCubic(p);
            setCrumple(1 - e);
            lerpBlob(BALL_BLOB, ANIMALS[current].shadow, e);
            group.rotation.y = baseRotY + Math.PI + e * Math.PI;
            group.position.y = -0.82 + Math.sin(p * Math.PI) * 0.08;
            if (p >= 1) {
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
      worker.terminate();
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

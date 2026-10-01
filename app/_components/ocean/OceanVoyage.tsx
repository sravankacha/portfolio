"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { OceanSceneHook } from "../FFTOceanCanvas";
import { useThemeId } from "../useThemeId";
import { helm, sky } from "./helm";
import type * as THREENS from "three";
import { skyAt, type SkyState } from "./sky";
import { skyEnvironment } from "./skyEnvironment";
import { buildShip, SHIP_HULL } from "./ship";
import { buildSplash } from "./splash";

const FFTOceanCanvas = dynamic(() => import("../FFTOceanCanvas"), { ssr: false });

const WIND_SPEED = 14; // m/s

/* Ocean theme background: a live FFT sea filling the viewport with a galleon
   anchored under the hero's helm. The ship's heading sets the wind, so the
   waves run with her and the sails fill from astern. Sky, water and light
   follow the visitor's local time of day (preview with ?time=HH:MM). */
export default function OceanVoyage() {
  const theme = useThemeId();

  const sceneHook = useCallback<OceanSceneHook>(({ THREE, scene, camera, renderer, setWind, sampleHeight, setSky }) => {
    const hemi = new THREE.HemisphereLight();
    const sun = new THREE.DirectionalLight(); // the sun by day, the moon by night
    scene.add(hemi, sun);
    const pmrem = new THREE.PMREMGenerator(renderer);
    let env: THREENS.Texture | null = null;

    const ship = buildShip(THREE);
    const shipMats: THREENS.MeshStandardMaterial[] = [];
    ship.root.traverse((o) => {
      const m = (o as THREENS.Mesh).material as THREENS.MeshStandardMaterial | undefined;
      if (m && "envMap" in m && !shipMats.includes(m)) shipMats.push(m);
    });
    scene.add(ship.root);

    // ---- time of day ----
    const override = new URLSearchParams(window.location.search).get("time");
    let lastPhase = "";
    let lastEnvEl = NaN;
    const applySky = () => {
      const k: SkyState = skyAt(new Date(), override);
      setSky(k);
      hemi.color.fromArray(k.hemiSky);
      hemi.groundColor.fromArray(k.hemiGround);
      hemi.intensity = k.hemiIntensity;
      sun.color.fromArray(k.lightColor);
      sun.intensity = k.lightIntensity;
      sun.position.fromArray(k.lightDir).normalize().multiplyScalar(400);
      sun.position.y = Math.max(sun.position.y, 0) + 40; // never light the hull from below
      // reflections: rebuild only when the sky has changed noticeably
      if (!(Math.abs(k.elevation - lastEnvEl) < 1.5)) {
        lastEnvEl = k.elevation;
        const envScene = skyEnvironment(THREE, k);
        const next = pmrem.fromScene(envScene, 0.02).texture;
        envScene.traverse((o) => {
          const m = o as THREENS.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREENS.Material).dispose();
          }
        });
        for (const m of shipMats) {
          m.envMap = next;
          m.envMapIntensity = 0.45;
          m.needsUpdate = true;
        }
        env?.dispose();
        env = next;
      }
      // page: text scrim strength and the time label in the hero
      const root = document.documentElement;
      root.style.setProperty("--sky-scrim", k.scrim.toFixed(3));
      if (k.phase !== lastPhase) {
        lastPhase = k.phase;
        root.dataset.sky = k.phase.replace(" ", "-");
      }
      sky.label = `${k.label} · ${k.phase}`;
      sky.notify();
    };
    applySky();
    const skyTimer = window.setInterval(applySky, 60_000);
    const splash = buildSplash(THREE, SHIP_HULL);
    scene.add(...splash.objects);
    // buoyancy state (smoothed so a 36 m hull has some inertia)
    const float = { y: 0, pitch: 0, roll: 0, bowRel: 0, lastHeading: helm.heading };
    const HALF_L = SHIP_HULL.length * 0.4;
    const HALF_B = 5.0;

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let heading = helm.heading;
    let lastWind = NaN;

    return {
      tick: (t, dt) => {
        // ease toward the helm so steering feels like a ship, not a cursor
        heading += (helm.heading - heading) * (1 - Math.exp(-dt * 3));
        const a = helm.anchor;
        if (a) {
          const w = window.innerWidth, h = window.innerHeight;
          ndc.set((a.x / w) * 2 - 1, -(a.y / h) * 2 + 1);
          ray.setFromCamera(ndc, camera);
          const base = ray.ray.intersectPlane(plane, hit) ? hit.length() : 220;
          const dx = ray.ray.direction.x, dz = ray.ray.direction.z;
          const len = Math.hypot(dx, dz) || 1;
          const dist = Math.min(1800, base * helm.distance);
          ship.root.position.set((dx / len) * dist, 0, (dz / len) * dist);
          ship.root.visible = true;
        } else {
          ship.root.visible = false;
        }
        // float on the simulated sea: probe bow, stern and both beams
        const px = ship.root.position.x, pz = ship.root.position.z;
        const fx = Math.cos(heading), fz = Math.sin(heading); // forward
        const sx = -fz, sz = fx; // port
        const hBow = sampleHeight(px + fx * HALF_L, pz + fz * HALF_L);
        const hStern = sampleHeight(px - fx * HALF_L, pz - fz * HALF_L);
        const hPort = sampleHeight(px + sx * HALF_B, pz + sz * HALF_B);
        const hStar = sampleHeight(px - sx * HALF_B, pz - sz * HALF_B);
        const water = (hBow + hStern + hPort + hStar) / 4;
        const k = 1 - Math.exp(-dt * 5);
        float.y += (water - float.y) * k;
        float.pitch += (Math.atan2(hBow - hStern, HALF_L * 2) * 0.75 - float.pitch) * k;
        float.roll += (-Math.atan2(hPort - hStar, HALF_B * 2) * 0.6 - float.roll) * k;
        ship.root.position.y = float.y;
        ship.root.rotation.set(float.roll, -heading, float.pitch, "YXZ");
        // spray: water rising past the bow faster than the bow rises = a slam
        const bowRel = hBow - (float.y + Math.sin(float.pitch) * HALF_L);
        const slam = dt > 0 ? Math.min(1, Math.max(0, (bowRel - float.bowRel) / dt / 2.5)) : 0;
        float.bowRel = bowRel;
        const turn = dt > 0 ? Math.min(1, Math.abs(heading - float.lastHeading) / dt / 0.6) : 0;
        float.lastHeading = heading;
        if (ship.root.visible && dt < 0.2) splash.update(dt, ship.root, { slam, turn, water });
        // wind follows the bow; only re-seed the spectrum when it really changes
        if (Math.abs(heading - lastWind) > 0.02) {
          lastWind = heading;
          setWind(Math.cos(heading) * WIND_SPEED, Math.sin(heading) * WIND_SPEED);
        }
        ship.update(t, dt);
      },
      dispose: () => {
        scene.remove(ship.root, hemi, sun, ...splash.objects);
        ship.dispose();
        splash.dispose();
        window.clearInterval(skyTimer);
        env?.dispose();
        pmrem.dispose();
        document.documentElement.style.removeProperty("--sky-scrim");
        delete document.documentElement.dataset.sky;
        sky.label = "";
        sky.notify();
      },
    };
  }, []);

  if (theme !== "ocean") return null;
  return (
    <div className="ocean-canvas" aria-hidden="true">
      <FFTOceanCanvas variant="voyage" sceneHook={sceneHook} />
    </div>
  );
}

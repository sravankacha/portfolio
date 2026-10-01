"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { OceanSceneHook } from "../FFTOceanCanvas";
import { useThemeId } from "../useThemeId";
import { helm } from "./helm";
import type * as THREENS from "three";
import { skyEnvironment } from "./skyEnvironment";
import { buildShip, SHIP_HULL } from "./ship";
import { buildSplash } from "./splash";

const FFTOceanCanvas = dynamic(() => import("../FFTOceanCanvas"), { ssr: false });

const WIND_SPEED = 14; // m/s

/* Ocean theme background: a live FFT sea filling the viewport with a pirate
   ship anchored under the hero's helm. The ship's heading sets the wind, so
   the waves run with her and the sails fill from astern. */
export default function OceanVoyage() {
  const theme = useThemeId();

  const sceneHook = useCallback<OceanSceneHook>(({ THREE, scene, camera, renderer, setWind, sampleHeight }) => {
    // dusk: violet sky fill, dark sea bounce, a low ember sun ahead-right
    const hemi = new THREE.HemisphereLight(0x6b5c8f, 0x081420, 0.9);
    const sun = new THREE.DirectionalLight(0xffa15c, 2.4);
    // soft studio reflections for gilding and varnished wood (ship materials only)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = skyEnvironment(THREE);
    const env = pmrem.fromScene(envScene, 0.02).texture;
    envScene.traverse((o) => {
      const m = o as THREENS.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREENS.Material).dispose();
      }
    });
    sun.position.set(0.5, 0.06, -0.86).normalize().multiplyScalar(400); // matches the ocean shader's sun
    sun.position.y += 40; // a touch higher than the disc so the hull isn't lit edge-on only
    scene.add(hemi, sun);

    const ship = buildShip(THREE);
    ship.root.traverse((o) => {
      const m = (o as THREENS.Mesh).material as THREENS.MeshStandardMaterial | undefined;
      if (m && "envMap" in m) {
        m.envMap = env;
        m.envMapIntensity = 0.45;
      }
    });
    scene.add(ship.root);
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
        env.dispose();
        pmrem.dispose();
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

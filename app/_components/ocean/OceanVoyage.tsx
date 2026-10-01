"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { OceanSceneHook } from "../FFTOceanCanvas";
import { useThemeId } from "../useThemeId";
import { helm } from "./helm";
import { buildShip } from "./ship";

const FFTOceanCanvas = dynamic(() => import("../FFTOceanCanvas"), { ssr: false });

const WIND_SPEED = 14; // m/s

/* Ocean theme background: a live FFT sea filling the viewport with a pirate
   ship anchored under the hero's helm. The ship's heading sets the wind, so
   the waves run with her and the sails fill from astern. */
export default function OceanVoyage() {
  const theme = useThemeId();

  const sceneHook = useCallback<OceanSceneHook>(({ THREE, scene, camera, setWind }) => {
    const hemi = new THREE.HemisphereLight(0xdcecff, 0x23384a, 1.3);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(-300, 300, 300); // matches the ocean shader's sun
    scene.add(hemi, sun);

    const ship = buildShip(THREE);
    scene.add(ship.root);

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
        ship.root.rotation.y = -heading;
        // wind follows the bow; only re-seed the spectrum when it really changes
        if (Math.abs(heading - lastWind) > 0.02) {
          lastWind = heading;
          setWind(Math.cos(heading) * WIND_SPEED, Math.sin(heading) * WIND_SPEED);
        }
        ship.update(t, dt);
      },
      dispose: () => {
        scene.remove(ship.root, hemi, sun);
        ship.dispose();
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

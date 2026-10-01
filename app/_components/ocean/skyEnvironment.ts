import type * as THREENS from "three";
import type { SkyState } from "./sky";

/** A tiny scene for PMREM: the current sky-to-sea gradient plus a light-source panel.
    Gives the galleon's gilding and varnish reflections that match the time of day. */
export function skyEnvironment(THREE: typeof THREENS, sky: SkyState): THREENS.Scene {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.getAttribute("position") as THREENS.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color().fromArray(sky.zenith);
  const band = new THREE.Color().fromArray(sky.band);
  const horizon = new THREE.Color().fromArray(sky.horizon);
  const sea = new THREE.Color().fromArray(sky.deep).multiplyScalar(1.5);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) {
      const t = Math.pow(y, 0.35);
      c.copy(horizon).lerp(band, Math.min(1, t / 0.55));
      if (t > 0.5) c.lerp(top, (t - 0.5) / 0.5);
    } else c.copy(horizon).lerp(sea, Math.min(1, -y * 3));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const light = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().fromArray(sky.lightColor).multiplyScalar(6 * sky.lightIntensity) })
  );
  light.position.fromArray(sky.lightDir).normalize().multiplyScalar(9);
  light.lookAt(0, 0, 0);
  scene.add(light);
  return scene;
}

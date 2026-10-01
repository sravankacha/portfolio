import type * as THREENS from "three";

/** A tiny scene for PMREM: dusk sky-to-sea gradient dome plus a low ember sun panel.
    Gives the galleon's gilding and varnish believable open-air reflections. */
export function skyEnvironment(THREE: typeof THREENS): THREENS.Scene {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.getAttribute("position") as THREENS.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x10142e), horizon = new THREE.Color(0xd9774a), sea = new THREE.Color(0x041018);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) c.copy(horizon).lerp(top, Math.pow(y, 0.45));
    else c.copy(horizon).lerp(sea, Math.min(1, -y * 3));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 8, 3.5) }));
  sun.position.set(5, 0.7, -8.6);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  return scene;
}

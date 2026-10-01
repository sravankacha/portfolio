import type * as THREENS from "three";

/** A tiny scene for PMREM: sky-to-sea gradient dome plus a bright sun panel.
    Gives the galleon's gilding and varnish believable open-air reflections. */
export function skyEnvironment(THREE: typeof THREENS): THREENS.Scene {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.getAttribute("position") as THREENS.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x5f97c9), horizon = new THREE.Color(0xe3eef4), sea = new THREE.Color(0x0d2a40);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) c.copy(horizon).lerp(top, Math.pow(y, 0.6));
    else c.copy(horizon).lerp(sea, Math.min(1, -y * 3));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 13, 11) }));
  sun.position.set(-5, 5, 5);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  return scene;
}

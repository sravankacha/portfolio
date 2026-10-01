import type * as THREENS from "three";

/* Spray and a foam skirt for a floating hull.

   Spray: a pool of droplets thrown off the bow and along the waterline. A
   steady trickle comes off the bow; much more when the bow slams into water
   (the hull moving down relative to the surface) or when the ship turns.
   Droplets fly ballistically and fade. Foam: a soft ring of white water that
   rides the surface around the hull. */

const MAX = 700;

export type Splash = {
  objects: THREENS.Object3D[];
  update: (
    dt: number,
    ship: THREENS.Object3D,
    o: { slam: number; turn: number; water: number }
  ) => void;
  dispose: () => void;
};

export function buildSplash(THREE: typeof THREENS, hull: { length: number; halfBeam: (u: number) => number }): Splash {
  const pos = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX); // remaining seconds
  const maxLife = new Float32Array(MAX).fill(1);
  const size = new Float32Array(MAX);
  const alpha = new Float32Array(MAX);
  let head = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 380 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  // Foam skirt: blotchy white ring texture, laid flat on the water around the hull
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    // denser near the hull outline (an ellipse), thinning outward
    const r = 0.36 + Math.pow(Math.random(), 1.6) * 0.14;
    const x = 128 + Math.cos(a) * r * 256 * 0.98;
    const y = 128 + Math.sin(a) * r * 256 * 0.98;
    const rad = 2 + Math.random() * 7;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(255,255,255,${0.16 + Math.random() * 0.22})`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const foamTex = new THREE.CanvasTexture(c);
  const skirtMat = new THREE.MeshBasicMaterial({
    map: foamTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(hull.length * 1.35, hull.length * 0.62), skirtMat);
  skirt.rotation.x = -Math.PI / 2;
  const skirtRoot = new THREE.Group();
  skirtRoot.add(skirt);

  const tmp = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const L = hull.length;

  const emit = (local: THREENS.Vector3, outward: THREENS.Vector3, ship: THREENS.Object3D, power: number) => {
    const i = head;
    head = (head + 1) % MAX;
    tmp.copy(local).applyMatrix4(ship.matrixWorld);
    pos[i * 3] = tmp.x;
    pos[i * 3 + 1] = tmp.y;
    pos[i * 3 + 2] = tmp.z;
    tmpV.copy(outward).transformDirection(ship.matrixWorld).multiplyScalar(1.5 + Math.random() * 3 * power);
    vel[i * 3] = tmpV.x + (Math.random() - 0.5) * 1.5;
    vel[i * 3 + 1] = 2.5 + Math.random() * 4.5 * power;
    vel[i * 3 + 2] = tmpV.z + (Math.random() - 0.5) * 1.5;
    maxLife[i] = life[i] = 0.7 + Math.random() * 0.9;
    size[i] = 0.35 + Math.random() * 0.9;
  };

  let bowAcc = 0, sideAcc = 0;
  const local = new THREE.Vector3();
  const out = new THREE.Vector3();

  const update: Splash["update"] = (dt, ship, o) => {
    ship.updateMatrixWorld();
    // bow: steady trickle, bursts when it slams down into a wave
    bowAcc += dt * (18 + o.slam * 260 + o.turn * 40);
    while (bowAcc > 1) {
      bowAcc -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      local.set(L / 2 - 1.5 - Math.random() * 3, 0.2, side * (0.4 + Math.random() * 0.8));
      out.set(0.6, 0, side).normalize();
      emit(local, out, ship, 0.6 + o.slam * 1.6);
    }
    // waterline along the sides: wash slapping the hull
    sideAcc += dt * (14 + o.slam * 80 + o.turn * 90);
    while (sideAcc > 1) {
      sideAcc -= 1;
      const u = 0.12 + Math.random() * 0.7;
      const side = Math.random() < 0.5 ? -1 : 1;
      local.set(-L / 2 + u * L, 0.1, side * (hull.halfBeam(u) + 0.2));
      out.set(0, 0, side);
      emit(local, out, ship, 0.35 + o.slam * 0.6 + o.turn * 0.8);
    }
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) {
        alpha[i] = 0;
        continue;
      }
      life[i] -= dt;
      vel[i * 3 + 1] -= 9.8 * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = life[i] / maxLife[i];
      alpha[i] = Math.max(0, t) * 0.85;
      if (pos[i * 3 + 1] < o.water - 0.5) life[i] = 0; // back in the sea
    }
    (geo.getAttribute("position") as THREENS.BufferAttribute).needsUpdate = true;
    (geo.getAttribute("size") as THREENS.BufferAttribute).needsUpdate = true;
    (geo.getAttribute("alpha") as THREENS.BufferAttribute).needsUpdate = true;

    // skirt follows the hull on the water surface; foam brightens in rough moments
    skirtRoot.position.set(ship.position.x, o.water + 0.15, ship.position.z);
    skirtRoot.rotation.y = ship.rotation.y;
    skirtMat.opacity = 0.75 + Math.min(0.25, o.slam * 0.6);
  };

  return {
    objects: [points, skirtRoot],
    update,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      skirt.geometry.dispose();
      skirtMat.dispose();
      foamTex.dispose();
    },
  };
}

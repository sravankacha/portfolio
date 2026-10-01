import type * as THREENS from "three";

/* =========================================================
   Spanish galleon, procedural, in meters (hull ≈ 44 m).

   Local frame: bow toward +x, up +y, port toward +z, waterline
   at y = 0. The hull is lofted with tumblehome and a towering
   stern; its painted detail (planking, wales, red-and-gold upper
   works, two tiers of gunports with open lids, quarter-gallery
   windows) lives in a canvas texture so it stays sharp up close.
   Four masts: square-rigged fore and main, lateen mizzen and
   bonaventure, plus a spritsail. Sails are cloth: they bag with
   the wind and ripple in a vertex shader that also rebuilds
   their normals. Ratlines, streamers, a Burgundy-cross ensign,
   stern lanterns, and a lookout waving from the main top.
   ========================================================= */

export type Ship = {
  root: THREENS.Group;
  update: (t: number, dt: number) => void;
  dispose: () => void;
};

const L = 44;
const Y_MIN = -5, Y_MAX = 17; // texture covers this height range

/** Half-beam (m) at fraction u of the length, stern (0) to bow (1). */
function halfBeam(u: number) {
  const bow = Math.pow(Math.max(0, (u - 0.5) / 0.5), 2.0);
  const stern = u < 0.12 ? 0.8 + 0.2 * (u / 0.12) : 1;
  return 5.6 * (1 - bow) * stern;
}
/** Rail height above the waterline: towering aftcastle, raised forecastle. */
function sheer(u: number) {
  const aft = Math.pow(Math.max(0, 0.34 - u) / 0.34, 1.25) * 8.2;
  const fore = Math.pow(Math.max(0, u - 0.78) / 0.22, 1.6) * 3.4;
  return 4.6 + aft + fore;
}
const keel = (u: number) => 3.6 * (1 - 0.6 * Math.pow(Math.max(0, (u - 0.8) / 0.2), 2));
/** Width factor up the side: round bilge, widest just above the waterline, tumblehome above. */
function section(t: number) {
  const bilge = Math.pow(Math.sin(Math.PI * 0.5 * Math.min(1, t / 0.42)), 0.6);
  const tumble = t > 0.45 ? 1 - 0.2 * Math.pow((t - 0.45) / 0.55, 1.4) : 1;
  return bilge * tumble;
}
export const SHIP_HULL = { length: L, halfBeam };

const DECK = 3.2; // waist deck
const wale = (k: number, u: number) => [1.0, 3.3, 5.7][k] + (sheer(u) - sheer(0.5)) * 0.35;

// ---------------- textures ----------------

function hullTexture(): HTMLCanvasElement {
  const W = 2048, H = 1024;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const py = (y: number) => H * (1 - (y - Y_MIN) / (Y_MAX - Y_MIN));
  const px = (u: number) => u * W;
  const mpx = H / (Y_MAX - Y_MIN); // pixels per meter
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // planking: rows of boards with staggered butt joints and color drift
  for (let y = Y_MIN; y < Y_MAX; y += 0.3) {
    const k = 0.82 + rnd() * 0.3;
    g.fillStyle = `rgb(${Math.round(92 * k)},${Math.round(60 * k)},${Math.round(34 * k)})`;
    g.fillRect(0, py(y + 0.3), W, 0.3 * mpx + 1);
    g.fillStyle = "rgba(25,14,8,0.65)";
    g.fillRect(0, py(y + 0.3), W, 1.2);
    let x = rnd() * 6;
    while (x < L) {
      g.fillRect(px(x / L), py(y + 0.3), 1.2, 0.3 * mpx);
      x += 4 + rnd() * 4;
    }
  }
  // grain streaks
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? "30,18,10" : "140,100,60"},${0.05 + rnd() * 0.08})`;
    g.fillRect(rnd() * W, rnd() * H, 20 + rnd() * 90, 1);
  }
  // below the waterline: tarred dark hull with a weedy band at the waterline
  g.fillStyle = "#211913";
  g.fillRect(0, py(0.15), W, H - py(0.15));
  g.fillStyle = "rgba(60,70,45,0.45)";
  g.fillRect(0, py(0.45), W, 0.3 * mpx);

  const curve = (f: (u: number) => number, width: number, style: string) => {
    g.strokeStyle = style;
    g.lineWidth = width * mpx;
    g.beginPath();
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const x = px(u), y = py(f(u));
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  // painted upper works: red with gold panels, below the rail
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const top = sheer(u) - 0.25, bot = Math.max(wale(2, u) + 0.3, sheer(u) - 1.9);
    g.fillStyle = "#7a1d14";
    g.fillRect(px(u), py(top), W / 400 + 1, py(bot) - py(top));
  }
  for (let x = 1; x < L - 1; x += 1.5) {
    const u = x / L;
    const top = sheer(u) - 0.55, bot = Math.max(wale(2, u) + 0.6, sheer(u) - 1.6);
    g.strokeStyle = "#caa24a";
    g.lineWidth = 2;
    g.strokeRect(px(u) + 4, py(top), (1.1 / L) * W, py(bot) - py(top));
  }
  curve((u) => sheer(u) - 0.12, 0.18, "#d4ad57"); // gilded rail cap
  // wales: heavy dark belts with a lit top edge
  for (let k = 0; k < 3; k++) {
    curve((u) => wale(k, u), 0.32, "#20140b");
    curve((u) => wale(k, u) + 0.14, 0.05, "rgba(190,140,80,0.5)");
  }
  // gunports: two tiers, red-rimmed, lids swung up
  for (const tier of [0, 1]) {
    for (let x = 7; x < L - 7; x += 3.1) {
      const u = x / L;
      const yc = (wale(tier, u) + wale(tier + 1, u)) / 2;
      const s = 0.72 * mpx;
      const X = px(u), Y = py(yc) - s / 2;
      g.fillStyle = "#8c2318";
      g.fillRect(X - 3, Y - 3, s + 6, s + 6);
      g.fillStyle = "#050404";
      g.fillRect(X, Y, s, s);
      g.fillStyle = "#9b2a1c";
      g.fillRect(X - 2, Y - s * 0.95, s + 4, s * 0.55); // open lid above
    }
  }
  // quarter galleries near the stern: gold-framed lit windows
  for (let row = 0; row < 3; row++)
    for (let x = 0.8; x < 4.8; x += 1.0) {
      const u = x / L;
      const y = sheer(u) - 1.8 - row * 1.4;
      g.fillStyle = "#c69a3e";
      g.fillRect(px(u), py(y + 0.7), 0.7 * (W / L), 0.75 * mpx);
      g.fillStyle = "#f6c66b";
      g.fillRect(px(u) + 3, py(y + 0.62), 0.7 * (W / L) - 6, 0.6 * mpx);
    }
  return c;
}

function transomTexture(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5a3820";
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#211913";
  g.fillRect(0, 430, 512, 82);
  g.fillStyle = "#7a1d14";
  g.fillRect(0, 40, 512, 300);
  // three tiers of stern windows with gilded frames
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 6; i++) {
      const x = 46 + i * 72, y = 70 + row * 92;
      g.fillStyle = "#d1a84e";
      g.fillRect(x - 5, y - 5, 54, 62);
      g.fillStyle = "#ffd27a";
      g.fillRect(x, y, 44, 52);
      g.fillStyle = "rgba(90,50,10,0.6)";
      g.fillRect(x + 21, y, 2, 52);
      g.fillRect(x, y + 25, 44, 2);
    }
  // gallery rails
  g.fillStyle = "#d4ad57";
  for (const y of [148, 240, 332]) g.fillRect(0, y, 512, 6);
  // carved crest
  g.beginPath();
  g.ellipse(256, 380, 46, 34, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#7a1d14";
  g.fillRect(242, 356, 28, 48);
  return c;
}

function deckTexture(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const g = c.getContext("2d")!;
  for (let y = 0; y < 256; y += 16) {
    const k = 0.85 + Math.random() * 0.25;
    g.fillStyle = `rgb(${Math.round(176 * k)},${Math.round(138 * k)},${Math.round(92 * k)})`;
    g.fillRect(0, y, 1024, 16);
    g.fillStyle = "rgba(60,40,20,0.7)";
    g.fillRect(0, y, 1024, 1);
    for (let x = Math.random() * 200; x < 1024; x += 180 + Math.random() * 120) g.fillRect(x, y, 1, 16);
  }
  return c;
}

function sailTexture(cross: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#efe6cf";
  g.fillRect(0, 0, 512, 512);
  // weathering
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(150,130,90,${Math.random() * 0.06})`;
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 512, 40 + Math.random() * 120, 30 + Math.random() * 90, 0, 0, Math.PI * 2);
    g.fill();
  }
  // cloth panels: vertical seams
  g.fillStyle = "rgba(120,100,70,0.35)";
  for (let x = 0; x < 512; x += 42) g.fillRect(x, 0, 2, 512);
  // tabling (reinforced edges) and a reef band with points
  g.fillStyle = "rgba(150,125,85,0.5)";
  g.fillRect(0, 0, 512, 10);
  g.fillRect(0, 502, 512, 10);
  g.fillRect(0, 0, 8, 512);
  g.fillRect(504, 0, 8, 512);
  g.fillRect(0, 110, 512, 4);
  g.fillStyle = "rgba(90,70,45,0.6)";
  for (let x = 20; x < 512; x += 28) g.fillRect(x, 106, 3, 12);
  if (cross) {
    // Cross of Burgundy: two ragged red staves crossed in a saltire
    g.strokeStyle = "#b3241b";
    g.fillStyle = "#b3241b";
    g.lineCap = "round";
    g.lineWidth = 34;
    for (const [x0, y0, x1, y1] of [[120, 140, 392, 440], [392, 140, 120, 440]]) {
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      for (let t = 0.12; t < 0.95; t += 0.16) {
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        g.beginPath(); g.arc(x + 18, y - 8, 11, 0, Math.PI * 2); g.arc(x - 18, y + 8, 11, 0, Math.PI * 2); g.fill();
      }
    }
  }
  return c;
}

function ensignTexture(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f1ece0";
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = "#b3241b";
  g.lineWidth = 18;
  g.lineCap = "round";
  g.beginPath(); g.moveTo(40, 20); g.lineTo(216, 140); g.moveTo(216, 20); g.lineTo(40, 140); g.stroke();
  return c;
}

// ---------------- builder ----------------

export function buildShip(THREE: typeof THREENS): Ship {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
  const tex = (canvas: HTMLCanvasElement, repeat = false) => {
    const t = track(new THREE.CanvasTexture(canvas));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  const hullMat = track(new THREE.MeshStandardMaterial({ map: tex(hullTexture()), roughness: 0.72, metalness: 0, side: THREE.DoubleSide }));
  const deckMat = track(new THREE.MeshStandardMaterial({ map: tex(deckTexture(), true), roughness: 0.85 }));
  const darkWood = track(new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.8 }));
  const redWood = track(new THREE.MeshStandardMaterial({ color: 0x7a1d14, roughness: 0.7 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.35, metalness: 0.75 }));
  const iron = track(new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.45, metalness: 0.7 }));
  const glow = track(new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffb347, emissiveIntensity: 2 }));

  const add = (geo: THREENS.BufferGeometry, mat: THREENS.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    body.add(m);
    return m;
  };

  // ---------- hull ----------
  const ST = 120, K = 26; // stations, points per side
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= ST; i++) {
    const u = i / ST;
    const x = -L / 2 + u * L;
    const b = halfBeam(u), d = keel(u), h = sheer(u);
    for (let j = 0; j <= 2 * K; j++) {
      const side = j <= K ? 1 : -1; // port, then starboard
      const t = j <= K ? 1 - j / K : (j - K) / K; // rail → keel → rail
      const y = -d + t * (h + d);
      pos.push(x, y, side * b * section(t));
      uv.push(u, (y - Y_MIN) / (Y_MAX - Y_MIN));
    }
  }
  const RW = 2 * K + 1;
  for (let i = 0; i < ST; i++)
    for (let j = 0; j < 2 * K; j++) {
      const a = i * RW + j, b2 = a + RW;
      idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
    }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  add(hullGeo, hullMat);

  // transom: the stern ring closed with a decorated flat face
  {
    const ring: [number, number][] = [];
    for (let j = 0; j <= 2 * K; j++) ring.push([pos[j * 3 + 2], pos[j * 3 + 1]]);
    const zs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const z0 = Math.min(...zs), z1 = Math.max(...zs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const shape = new THREE.Shape(ring.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ShapeGeometry(shape);
    const p = g.getAttribute("position") as THREENS.BufferAttribute;
    const tuv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      tuv[i * 2] = (p.getX(i) - z0) / (z1 - z0);
      tuv[i * 2 + 1] = (p.getY(i) - y0) / (y1 - y0);
    }
    g.setAttribute("uv", new THREE.BufferAttribute(tuv, 2));
    g.rotateY(-Math.PI / 2); // shape x → world z, facing aft
    add(g, track(new THREE.MeshStandardMaterial({ map: tex(transomTexture()), roughness: 0.7, side: THREE.DoubleSide })), -L / 2 - 0.02);
  }

  // ---------- decks (stepped), bulkheads, rails ----------
  const widthAt = (u: number, y: number) => {
    const t = (y + keel(u)) / (sheer(u) + keel(u));
    return halfBeam(u) * section(Math.min(1, Math.max(0, t)));
  };
  const deckAt = (y: number, u0: number, u1: number) => {
    const sh = new THREE.Shape();
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const u = u0 + ((u1 - u0) * i) / 30;
      pts.push([-L / 2 + u * L, widthAt(u, y) * 0.97]);
    }
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], -pts[i][1]);
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(Math.PI / 2);
    const p = g.getAttribute("position") as THREENS.BufferAttribute;
    const duv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      duv[i * 2] = p.getX(i) / 8;
      duv[i * 2 + 1] = p.getZ(i) / 2;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(duv, 2));
    add(g, deckMat, 0, y);
  };
  deckAt(DECK, 0.06, 0.95); // waist
  deckAt(DECK + 3.2, 0.03, 0.27); // half deck
  deckAt(DECK + 6.0, 0.02, 0.13); // poop
  deckAt(DECK + 2.6, 0.8, 0.95); // forecastle

  const bulkhead = (u: number, y0: number, h: number) => {
    const x = -L / 2 + u * L;
    const w = widthAt(u, y0 + h * 0.5) * 1.9;
    add(new THREE.BoxGeometry(0.25, h, w), redWood, x, y0 + h / 2);
    add(new THREE.BoxGeometry(0.3, h * 0.62, 1.2), darkWood, x + 0.05, y0 + h * 0.31);
    add(new THREE.BoxGeometry(0.32, 0.12, w), gold, x, y0 + h - 0.1);
  };
  bulkhead(0.27, DECK, 3.2);
  bulkhead(0.13, DECK + 3.2, 2.8);
  bulkhead(0.8, DECK, 2.6);

  // balustrades on the castle edges: instanced posts + a gilded rail
  const postGeo = track(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6));
  const postsAt: number[][] = [];
  const railAt = (y: number, u0: number, u1: number) => {
    for (const side of [-1, 1]) {
      for (let u = u0; u <= u1; u += 0.6 / L) postsAt.push([-L / 2 + u * L, y + 0.45, side * widthAt(u, y) * 0.95]);
      const um = (u0 + u1) / 2;
      const rail = add(new THREE.CylinderGeometry(0.07, 0.07, (u1 - u0) * L, 6), gold, -L / 2 + um * L, y + 0.92, side * widthAt(um, y) * 0.95);
      rail.rotation.z = Math.PI / 2;
    }
  };
  railAt(DECK + 6.0, 0.02, 0.13);
  railAt(DECK + 2.6, 0.82, 0.93);
  const posts = new THREE.InstancedMesh(postGeo, gold, postsAt.length);
  const mtx = new THREE.Matrix4();
  postsAt.forEach(([x, y, z], i) => posts.setMatrixAt(i, mtx.makeTranslation(x, y, z)));
  body.add(posts);

  // stern lanterns: gilded cages with a warm light
  for (const z of [-2.2, 0, 2.2]) {
    const ly = DECK + 7.6 + (z === 0 ? 0.6 : 0);
    add(new THREE.CylinderGeometry(0.35, 0.25, 1.0, 8), glow, -L / 2 + 0.7, ly, z);
    add(new THREE.ConeGeometry(0.42, 0.5, 8), gold, -L / 2 + 0.7, ly + 0.75, z);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), gold, -L / 2 + 0.7, ly - 1.0, z);
  }
  // cannons run out of both tiers
  const gun = track(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 10));
  gun.rotateX(Math.PI / 2);
  for (const tier of [0, 1])
    for (let x = 7; x < L - 7; x += 3.1) {
      const u = (x + 0.36) / L;
      const y = (wale(tier, u) + wale(tier + 1, u)) / 2;
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(gun, iron);
        m.position.set(-L / 2 + x + 0.36, y, side * (widthAt(u, y) + 0.45));
        body.add(m);
      }
    }
  // beakhead and bowsprit
  add(new THREE.BoxGeometry(5, 0.6, 2.2), redWood, L / 2 + 1.6, DECK + 1.6).rotation.z = 0.12;
  add(new THREE.CylinderGeometry(0.22, 0.42, 18, 10), darkWood, L / 2 + 5.5, DECK + 5.2).rotation.z = -Math.PI / 2 + 0.42;

  // ---------- sails: cloth with bag and ripple ----------
  const sailUniforms = { uTime: { value: 0 }, uFill: { value: 1 } };
  const CLOTH = /* glsl */ `
    uniform float uTime;
    uniform float uFill;
    attribute vec2 sailUv;
    attribute vec2 sailSize;
    attribute float belly;
    attribute float phase;
    float cloth(vec2 q) {
      // bag: pinned along the head, fullest low-centre, easing at the clews
      float bag = sin(3.14159 * q.x) * pow(sin(3.14159 * clamp(q.y * 0.88 + 0.12, 0.0, 1.0)), 0.8);
      // ripples run through the cloth; the foot and leeches flog most
      float free = 0.35 + 0.65 * max(smoothstep(0.6, 1.0, q.y), 1.0 - sin(3.14159 * q.x));
      float ripple = sin(q.x * 6.0 + q.y * 3.5 - uTime * 3.4 + phase) * 0.06
                   + sin(q.x * 13.0 - q.y * 5.0 - uTime * 6.1 + phase * 1.7) * 0.022;
      return belly * uFill * (bag + ripple * free);
    }
  `;
  const makeSailMat = (map: THREENS.Texture) => {
    const m = track(new THREE.MeshStandardMaterial({ map, roughness: 0.92, side: THREE.DoubleSide }));
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, sailUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\n" + CLOTH)
        .replace(
          "#include <beginnormal_vertex>",
          /* glsl */ `
          float c0 = cloth(sailUv);
          float e = 0.01;
          float cu = (cloth(sailUv + vec2(e, 0.0)) - c0) / (e * sailSize.x);
          float cv = (cloth(sailUv + vec2(0.0, e)) - c0) / (e * sailSize.y);
          // sail lies in the y-z plane (u along +z, v down -y); cloth pushes along +x
          vec3 objectNormal = normalize(vec3(1.0, cv, -cu));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif
          `
        )
        .replace("#include <begin_vertex>", "vec3 transformed = position; transformed.x += c0;");
    };
    return m;
  };
  const sailPlain = makeSailMat(tex(sailTexture(false)));
  const sailCross = makeSailMat(tex(sailTexture(true)));

  let sailCount = 0;
  /** Quad sail, corners as (z, y) in the y-z plane: head left/right, foot left/right. */
  const sail = (
    c: { hl: number[]; hr: number[]; fl: number[]; fr: number[] },
    bellyAmt: number,
    mat: THREENS.Material,
    at: number[],
    yaw = 0
  ) => {
    const NX = 22, NY = 16;
    const p: number[] = [], suv: number[] = [], tuv: number[] = [], ix: number[] = [];
    for (let j = 0; j <= NY; j++)
      for (let i = 0; i <= NX; i++) {
        const u = i / NX, v = j / NY;
        const top = [c.hl[0] + (c.hr[0] - c.hl[0]) * u, c.hl[1] + (c.hr[1] - c.hl[1]) * u];
        const bot = [c.fl[0] + (c.fr[0] - c.fl[0]) * u, c.fl[1] + (c.fr[1] - c.fl[1]) * u];
        p.push(0, top[1] + (bot[1] - top[1]) * v, top[0] + (bot[0] - top[0]) * v);
        suv.push(u, v);
        tuv.push(u, 1 - v);
      }
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i, b = a + NX + 1;
        ix.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const n = (NX + 1) * (NY + 1);
    const w = Math.max(Math.abs(c.hr[0] - c.hl[0]), Math.abs(c.fr[0] - c.fl[0]), 1);
    const h = Math.max(Math.abs(c.fl[1] - c.hl[1]), Math.abs(c.fr[1] - c.hr[1]), 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(tuv, 2));
    g.setAttribute("sailUv", new THREE.Float32BufferAttribute(suv, 2));
    const size = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { size[i * 2] = w; size[i * 2 + 1] = h; }
    g.setAttribute("sailSize", new THREE.BufferAttribute(size, 2));
    g.setAttribute("belly", new THREE.BufferAttribute(new Float32Array(n).fill(bellyAmt), 1));
    g.setAttribute("phase", new THREE.BufferAttribute(new Float32Array(n).fill(sailCount++ * 1.3), 1));
    g.setIndex(ix);
    const m = add(g, mat, at[0], at[1], at[2]);
    m.rotation.y = yaw;
    return m;
  };

  // ---------- masts and rigging ----------
  const spar = (r0: number, r1: number, len: number, x: number, y: number, z = 0) =>
    add(new THREE.CylinderGeometry(r1, r0, len, 10), darkWood, x, y + len / 2, z);
  const rig: number[] = [];
  const line = (a: number[], b: number[]) => rig.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const shrouds = (mx: number, topY: number, n: number) => {
    const u = (mx + L / 2) / L;
    const y = Math.max(DECK + 1, sheer(u) - 0.4);
    const r = widthAt(u, y) + 0.4;
    for (const side of [-1, 1]) {
      const feet: number[][] = [];
      for (let k = 0; k < n; k++) feet.push([mx - 2.8 + k * (3.2 / Math.max(1, n - 1)), y, side * r]);
      feet.forEach((f) => line([mx, topY, side * 0.3], f));
      // ratlines: rungs across the shrouds every ~half meter
      for (let yy = y + 0.6; yy < topY - 1; yy += 0.55) {
        const s = (yy - y) / (topY - y);
        const pts = feet.map((f) => [f[0] + (mx - f[0]) * s, yy, f[2] + (side * 0.3 - f[2]) * s]);
        for (let k = 0; k < pts.length - 1; k++) line(pts[k], pts[k + 1]);
      }
    }
  };
  const fightingTop = (mx: number, y: number, r: number) => {
    add(new THREE.CylinderGeometry(r, r * 0.85, 0.5, 18), darkWood, mx, y);
    add(new THREE.TorusGeometry(r, 0.07, 6, 24), gold, mx, y + 0.9).rotation.x = Math.PI / 2;
  };

  type Square = { mx: number; h: number; topY: number; yards: { y: number; w: number; cross?: boolean }[] };
  const squares: Square[] = [
    { mx: 12.5, h: 31, topY: 17, yards: [{ y: 15, w: 19, cross: true }, { y: 24, w: 14 }, { y: 29.5, w: 8.5 }] },
    { mx: 0.5, h: 38, topY: 21, yards: [{ y: 18.5, w: 23, cross: true }, { y: 29, w: 17, cross: true }, { y: 35.5, w: 10 }] },
  ];
  for (const m of squares) {
    spar(0.75, 0.45, m.topY + 1, m.mx, DECK - 1);
    spar(0.42, 0.18, m.h - m.topY, m.mx, DECK + m.topY);
    fightingTop(m.mx, DECK + m.topY, 1.7);
    shrouds(m.mx, DECK + m.topY, 5);
    m.yards.forEach((yd, k) => {
      add(new THREE.CylinderGeometry(0.2, 0.2, yd.w, 8), darkWood, m.mx + 0.55, DECK + yd.y).rotation.x = Math.PI / 2;
      const below = k === 0 ? DECK + 4.2 : DECK + m.yards[k - 1].y + 0.5;
      const wb = k === 0 ? yd.w * 1.04 : m.yards[k - 1].w * 0.97;
      sail(
        { hl: [-yd.w * 0.48, DECK + yd.y - 0.2], hr: [yd.w * 0.48, DECK + yd.y - 0.2], fl: [-wb / 2, below], fr: [wb / 2, below] },
        (DECK + yd.y - below) * 0.2,
        yd.cross ? sailCross : sailPlain,
        [m.mx + 0.7, 0, 0]
      );
      // braces to the yardarms, lifts to the masthead
      line([m.mx + 0.55, DECK + yd.y, yd.w / 2], [m.mx - 9, DECK + 3.5, 4.5]);
      line([m.mx + 0.55, DECK + yd.y, -yd.w / 2], [m.mx - 9, DECK + 3.5, -4.5]);
      line([m.mx + 0.55, DECK + yd.y, yd.w / 2], [m.mx, DECK + yd.y + 3.5, 0]);
      line([m.mx + 0.55, DECK + yd.y, -yd.w / 2], [m.mx, DECK + yd.y + 3.5, 0]);
    });
  }
  // lateen-rigged mizzen and bonaventure: long angled yard, triangular fore-and-aft sail
  for (const lm of [
    { mx: -11, h: 26, yardY: 16, len: 20, base: DECK + 3.2 },
    { mx: -18.5, h: 20, yardY: 13, len: 14, base: DECK + 6.0 },
  ]) {
    spar(0.5, 0.25, lm.h, lm.mx, lm.base - 1);
    shrouds(lm.mx, lm.base + lm.h * 0.65, 3);
    const a = 0.62; // yard tilt from vertical
    const yc = lm.base + lm.yardY - 6;
    add(new THREE.CylinderGeometry(0.16, 0.16, lm.len, 8), darkWood, lm.mx + 0.6, yc).rotation.z = a;
    const dx = Math.sin(a) * lm.len * 0.5, dy = Math.cos(a) * lm.len * 0.5;
    // triangle hung from the yard; built in the y-z plane and turned fore-and-aft
    sail(
      { hl: [-dx, yc + dy], hr: [dx, yc - dy], fl: [-dx * 0.96, yc + dy - 0.3], fr: [-dx * 0.2, lm.base + 0.6] },
      lm.len * 0.05,
      sailPlain,
      [lm.mx + 0.6, 0, 0],
      Math.PI / 2
    );
  }
  // spritsail under the bowsprit
  sail({ hl: [-4.5, DECK + 7.8], hr: [4.5, DECK + 7.8], fl: [-4.8, DECK + 2.6], fr: [4.8, DECK + 2.6] }, 1.0, sailPlain, [L / 2 + 6.5, 0, 0]);
  add(new THREE.CylinderGeometry(0.15, 0.15, 9.5, 8), darkWood, L / 2 + 6.4, DECK + 7.9).rotation.x = Math.PI / 2;
  // stays
  line([squares[1].mx, DECK + squares[1].h, 0], [squares[0].mx, DECK + squares[0].topY + 2, 0]);
  line([squares[0].mx, DECK + squares[0].h, 0], [L / 2 + 12, DECK + 9, 0]);
  line([-11, DECK + 3.2 + 26, 0], [squares[1].mx, DECK + squares[1].topY + 2, 0]);
  const rigGeo = new THREE.BufferGeometry();
  rigGeo.setAttribute("position", new THREE.Float32BufferAttribute(rig, 3));
  body.add(new THREE.LineSegments(track(rigGeo), track(new THREE.LineBasicMaterial({ color: 0x24170e, transparent: true, opacity: 0.8 }))));

  // ---------- streamers and ensign (flap on the CPU) ----------
  type Flag = { geo: THREENS.BufferGeometry; base: Float32Array; len: number; amp: number; speed: number };
  const flags: Flag[] = [];
  const flag = (w: number, h: number, mat: THREENS.Material, at: number[], taper: boolean, amp: number) => {
    const g = new THREE.PlaneGeometry(w, h, 30, 4);
    g.translate(w / 2, 0, 0);
    if (taper) {
      const p = g.getAttribute("position") as THREENS.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - (p.getX(i) / w) * 0.85));
    }
    const base = (g.getAttribute("position").array as Float32Array).slice();
    add(g, mat, at[0], at[1], at[2]);
    flags.push({ geo: g, base, len: w, amp, speed: 7 + flags.length * 0.7 });
  };
  const streamerMat = track(new THREE.MeshStandardMaterial({ color: 0xb3241b, side: THREE.DoubleSide, roughness: 0.8 }));
  const goldCloth = track(new THREE.MeshStandardMaterial({ color: 0xe0b64c, side: THREE.DoubleSide, roughness: 0.7 }));
  flag(13, 1.1, streamerMat, [squares[1].mx, DECK + squares[1].h - 0.3, 0], true, 0.7);
  flag(10, 0.9, goldCloth, [squares[0].mx, DECK + squares[0].h - 0.3, 0], true, 0.6);
  flag(7, 0.7, streamerMat, [-11, DECK + 3.2 + 26 - 0.3, 0], true, 0.5);
  const ensignMat = track(new THREE.MeshStandardMaterial({ map: tex(ensignTexture()), side: THREE.DoubleSide, roughness: 0.85 }));
  spar(0.09, 0.07, 6, -L / 2 - 0.4, DECK + 7);
  flag(4.6, 3.0, ensignMat, [-L / 2 - 0.4, DECK + 11.4, 0], false, 0.35);

  // ---------- lookout waving from the main top ----------
  const skin = track(new THREE.MeshStandardMaterial({ color: 0xc98d62, roughness: 0.7 }));
  const shirt = track(new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.9 }));
  const red = track(new THREE.MeshStandardMaterial({ color: 0xa3201c, roughness: 0.8 }));
  const black = track(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }));
  const sailor = new THREE.Group();
  sailor.position.set(squares[1].mx - 0.3, DECK + squares[1].topY + 0.25, 0.5);
  sailor.rotation.y = -0.5;
  sailor.scale.setScalar(1.5);
  body.add(sailor);
  const part = (geo: THREENS.BufferGeometry, mat: THREENS.Material, parent: THREENS.Object3D, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  part(new THREE.CapsuleGeometry(0.34, 0.8, 6, 12), shirt, sailor, 0, 1.1, 0);
  part(new THREE.CylinderGeometry(0.37, 0.37, 0.18, 12), red, sailor, 0, 0.85, 0);
  part(new THREE.SphereGeometry(0.3, 16, 12), skin, sailor, 0, 1.95, 0);
  part(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 3), black, sailor, 0, 2.18, 0);
  part(new THREE.ConeGeometry(0.3, 0.32, 12), black, sailor, 0, 2.36, 0);
  const armGeo = track(new THREE.CapsuleGeometry(0.11, 0.62, 4, 8));
  const rest = new THREE.Mesh(armGeo, shirt);
  rest.position.set(0, 1.25, -0.42);
  rest.rotation.x = 0.5;
  sailor.add(rest);
  const shoulder = new THREE.Group();
  shoulder.position.set(0, 1.5, 0.4);
  sailor.add(shoulder);
  const upper = new THREE.Mesh(armGeo, shirt);
  upper.position.y = 0.38;
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = 0.75;
  shoulder.add(elbow);
  const fore = new THREE.Mesh(armGeo, shirt);
  fore.position.y = 0.36;
  elbow.add(fore);
  part(new THREE.SphereGeometry(0.13, 10, 8), skin, elbow, 0, 0.76, 0);

  const update = (t: number) => {
    // the root floats on the simulated sea; add only a little settle and sway
    body.position.y = -0.7 + 0.05 * Math.sin(t * 1.9);
    body.rotation.x = 0.01 * Math.sin(t * 1.3);
    sailUniforms.uTime.value = t;
    shoulder.rotation.x = 0.45 + 0.42 * Math.sin(t * 5.2);
    elbow.rotation.x = 0.25 + 0.35 * Math.sin(t * 5.2 - 0.8);
    for (const f of flags) {
      const p = f.geo.getAttribute("position") as THREENS.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = f.base[i * 3], y = f.base[i * 3 + 1];
        const fly = x / f.len;
        p.setZ(i, Math.sin(x * 0.9 - t * f.speed) * f.amp * fly + Math.sin(y * 2 + t * 5) * 0.06 * fly);
        p.setY(i, y - fly * fly * f.amp * 0.6);
      }
      p.needsUpdate = true;
      f.geo.computeVertexNormals();
    }
  };

  return { root, update, dispose: () => disposables.forEach((d) => d.dispose()) };
}

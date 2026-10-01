import type * as THREENS from "three";

/* =========================================================
   Procedural pirate ship, built in meters (≈36 m long).

   Local frame: bow toward +x, up +y, port toward +z; the
   waterline sits at y = 0. Hull is lofted from cross-sections
   (sheer rises at stern and bow), painted with plank bands, a
   black-and-ochre gunport strake and a dark bottom. Three
   masts carry billowing square sails that flutter in a
   vertex shader, jibs run to the bowsprit, a jolly roger
   streams from the main truck, and a lookout in the crow's
   nest waves.
   ========================================================= */

export type Ship = {
  root: THREENS.Group; // place and rotate this
  update: (t: number, dt: number) => void;
  dispose: () => void;
};

const L = 36; // overall hull length
const DECK = 2.0; // main deck height above the waterline

/** Half-beam (m) at fraction u of the length, stern (0) to bow (1). */
function halfBeam(u: number) {
  const bow = Math.pow(Math.max(0, (u - 0.42) / 0.58), 2.1);
  const stern = u < 0.1 ? 0.84 + 0.16 * (u / 0.1) : 1;
  return 5.0 * (1 - bow) * stern;
}
export const SHIP_HULL = { length: L, halfBeam };

export function buildShip(THREE: typeof THREENS): Ship {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and rolls inside root
  root.add(body);
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  const wood = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide }));
  const darkWood = track(new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.85 }));
  const iron = track(new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.5, metalness: 0.6 }));
  const glow = track(new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.6 }));

  // ---------- hull ----------
  const keel = (u: number) => 3.1 * (1 - 0.55 * Math.pow(Math.max(0, (u - 0.78) / 0.22), 2));
  const sheer = (u: number) =>
    3.0 + 3.4 * Math.pow(Math.max(0, 0.24 - u) / 0.24, 1.4) + 1.5 * Math.pow(Math.max(0, u - 0.82) / 0.18, 2);

  const ST = 56, RING = 30;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const hullColor = (x: number, y: number): [number, number, number] => {
    if (y < 0.35) return [0.32, 0.12, 0.08]; // painted bottom
    // gunport strake: black band with ochre trim, square ports every 3 m
    if (y > 1.05 && y < 2.05) {
      if (y < 1.15 || y > 1.95) return [0.62, 0.45, 0.16];
      const port = Math.abs(((x + 30) % 3.2) - 1.6) < 0.42 && y > 1.3 && y < 1.8;
      return port ? [0.03, 0.03, 0.03] : [0.07, 0.06, 0.06];
    }
    const plank = Math.floor(y / 0.34) % 2 === 0 ? 1 : 0.88;
    const grain = 0.94 + 0.06 * Math.sin(x * 2.3 + y * 7.1);
    return [0.42 * plank * grain, 0.26 * plank * grain, 0.14 * plank * grain];
  };
  for (let i = 0; i <= ST; i++) {
    const u = i / ST;
    const x = -L / 2 + u * L;
    const b = halfBeam(u), d = keel(u), h = sheer(u);
    for (let j = 0; j <= RING; j++) {
      const s = (j / RING) * 2 - 1; // -1 port rail .. +1 starboard rail
      const a = (s * Math.PI) / 2;
      const z = -b * Math.sign(a) * Math.pow(Math.abs(Math.sin(a)), 0.5);
      const y = h - (h + d) * Math.pow(Math.cos(a), 0.75);
      pos.push(x, y, z);
      col.push(...hullColor(x, y));
    }
  }
  for (let i = 0; i < ST; i++)
    for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j, b = a + RING + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // transom: fan the stern ring closed
  const center = pos.length / 3;
  pos.push(-L / 2, (sheer(0) - keel(0)) / 2, 0);
  col.push(0.34, 0.2, 0.11);
  for (let j = 0; j < RING; j++) idx.push(center, j + 1, j);
  const hullGeo = track(new THREE.BufferGeometry());
  hullGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  body.add(new THREE.Mesh(hullGeo, wood));

  // ---------- decks and castles ----------
  const deckShape = new THREE.Shape();
  const outline: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const u = 0.03 + (i / 40) * 0.94;
    outline.push([-L / 2 + u * L, halfBeam(u) * 0.95]);
  }
  outline.forEach(([x, z], i) => (i === 0 ? deckShape.moveTo(x, z) : deckShape.lineTo(x, z)));
  for (let i = outline.length - 1; i >= 0; i--) deckShape.lineTo(outline[i][0], -outline[i][1]);
  const deckGeo = track(new THREE.ShapeGeometry(deckShape));
  deckGeo.rotateX(Math.PI / 2);
  const deckMat = track(new THREE.MeshStandardMaterial({ color: 0x9a7448, roughness: 0.9 }));
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = DECK;
  body.add(deck);

  const box = (w: number, h: number, d: number, mat: THREENS.Material, x: number, y: number, z = 0) => {
    const g = track(new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    body.add(m);
    return m;
  };
  // stern castle with a row of lit windows
  box(6.6, 3.4, 8.2, darkWood, -L / 2 + 4.0, DECK + 1.7);
  box(7.0, 0.25, 8.6, deckMat, -L / 2 + 4.0, DECK + 3.45);
  for (let k = -1.5; k <= 1.5; k++) box(0.08, 0.7, 0.9, glow, -L / 2 + 0.66, DECK + 2.0, k * 1.6);
  box(1.6, 0.25, 8.4, deckMat, -L / 2 + 0.9, DECK + 2.9); // stern gallery
  // forecastle
  box(5.0, 1.4, 6.0, darkWood, L / 2 - 6.5, DECK + 0.7);
  // stern lanterns
  const lanternGeo = track(new THREE.SphereGeometry(0.32, 12, 8));
  for (const z of [-3.2, 3.2]) {
    const l = new THREE.Mesh(lanternGeo, glow);
    l.position.set(-L / 2 + 0.6, DECK + 4.4, z);
    body.add(l);
  }
  // cannons poking out of the ports
  const cannonGeo = track(new THREE.CylinderGeometry(0.17, 0.22, 1.4, 10));
  cannonGeo.rotateX(Math.PI / 2);
  for (let x = -L / 2 + 6.4; x < L / 2 - 8; x += 3.2)
    for (const side of [-1, 1]) {
      const u = (x + L / 2) / L;
      const c = new THREE.Mesh(cannonGeo, iron);
      c.position.set(x + 1.6, 1.55, side * (halfBeam(u) + 0.25));
      body.add(c);
    }

  // ---------- masts, yards, sails ----------
  const spar = (r0: number, r1: number, len: number) => {
    const g = track(new THREE.CylinderGeometry(r1, r0, len, 10));
    return new THREE.Mesh(g, darkWood);
  };
  type Mast = { x: number; h: number; yards: { y: number; w: number }[] };
  const masts: Mast[] = [
    { x: 9.5, h: 25, yards: [{ y: 8.5, w: 15 }, { y: 15, w: 12.5 }, { y: 20.5, w: 9 }] },
    { x: -0.5, h: 29, yards: [{ y: 9, w: 17 }, { y: 16.5, w: 14 }, { y: 23, w: 10 }] },
    { x: -10.5, h: 20, yards: [] },
  ];

  const sailUniforms = { uTime: { value: 0 }, uFill: { value: 1 } };
  const sailMat = track(
    new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.95, side: THREE.DoubleSide })
  );
  sailMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sailUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uFill;\nattribute vec2 sailUv;\nattribute float belly;"
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        vec3 transformed = position;
        // wind from astern fills the cloth toward the bow (+x)...
        float bag = sin(3.14159 * sailUv.x) * sin(3.14159 * clamp(sailUv.y * 0.85 + 0.15, 0.0, 1.0));
        transformed.x += belly * uFill * bag;
        // ...and the free edges shiver
        transformed.x += 0.12 * belly * sin(uTime * 4.1 + sailUv.y * 7.0 + sailUv.x * 3.0) * (0.3 + sailUv.y);
        `
      );
  };
  const addSail = (geo: THREENS.BufferGeometry, bellyAmt: number) => {
    const n = geo.getAttribute("position").count;
    geo.setAttribute("belly", new THREE.Float32BufferAttribute(new Array(n).fill(bellyAmt), 1));
    const m = new THREE.Mesh(geo, sailMat);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  // square sail hanging between two heights, spanning the yard, in the y-z plane
  const squareSail = (x: number, top: number, bottom: number, wTop: number, wBottom: number) => {
    const NX = 14, NY = 10;
    const p: number[] = [], uv: number[] = [], ix: number[] = [];
    for (let j = 0; j <= NY; j++)
      for (let i = 0; i <= NX; i++) {
        const v = j / NY, u = i / NX;
        const w = wBottom + (wTop - wBottom) * v;
        p.push(0, bottom + (top - bottom) * v, (u - 0.5) * w);
        uv.push(u, 1 - v);
      }
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i, b = a + NX + 1;
        ix.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("sailUv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    const s = addSail(g, (top - bottom) * 0.22);
    s.position.x = x + 0.5;
  };
  // triangle sail between three points (jibs, spanker)
  const triSail = (a: number[], b: number[], c: number[], bellyAmt: number) => {
    const N = 10;
    const p: number[] = [], uv: number[] = [], ix: number[] = [];
    const rowStart: number[] = [];
    for (let j = 0; j <= N; j++) {
      rowStart.push(p.length / 3);
      const v = j / N;
      const L0 = [a[0] + (c[0] - a[0]) * v, a[1] + (c[1] - a[1]) * v, a[2] + (c[2] - a[2]) * v];
      const L1 = [b[0] + (c[0] - b[0]) * v, b[1] + (c[1] - b[1]) * v, b[2] + (c[2] - b[2]) * v];
      const cnt = N - j;
      for (let i = 0; i <= cnt; i++) {
        const u = cnt ? i / cnt : 0.5;
        p.push(L0[0] + (L1[0] - L0[0]) * u, L0[1] + (L1[1] - L0[1]) * u, L0[2] + (L1[2] - L0[2]) * u);
        uv.push(cnt ? u : 0.5, v);
      }
    }
    for (let j = 0; j < N; j++) {
      const cnt = N - j;
      for (let i = 0; i < cnt; i++) {
        const a0 = rowStart[j] + i, b0 = rowStart[j + 1] + i;
        ix.push(a0, a0 + 1, b0);
        if (i < cnt - 1) ix.push(a0 + 1, b0 + 1, b0);
      }
    }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("sailUv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    addSail(g, bellyAmt);
  };

  const rig: number[] = []; // line segments
  const line = (a: number[], b: number[]) => rig.push(...a, ...b);
  let mainTop = new THREE.Vector3();
  for (const m of masts) {
    const mast = spar(0.5, 0.28, m.h);
    mast.position.set(m.x, DECK + m.h / 2, 0);
    body.add(mast);
    const u = (m.x + L / 2) / L;
    const rail = halfBeam(u) * 0.97;
    // shrouds down to both rails
    for (const side of [-1, 1])
      for (const dx of [-1.6, 0, 1.6]) line([m.x, DECK + m.h * 0.82, 0], [m.x + dx, DECK + 0.4, side * rail]);
    m.yards.forEach((y, k) => {
      const yard = spar(0.2, 0.2, y.w);
      yard.rotation.x = Math.PI / 2;
      yard.position.set(m.x + 0.45, DECK + y.y, 0);
      body.add(yard);
      const next = m.yards[k - 1];
      const bottom = next ? DECK + next.y + 0.3 : DECK + 2.6;
      squareSail(m.x, DECK + y.y - 0.2, bottom, y.w * 0.96, next ? next.w * 0.98 : y.w * 1.05);
      // braces to the yard arms
      line([m.x + 0.45, DECK + y.y, y.w / 2], [m.x - 6, DECK + 1, rail]);
      line([m.x + 0.45, DECK + y.y, -y.w / 2], [m.x - 6, DECK + 1, -rail]);
    });
    if (m.x < -5) {
      // mizzen: gaff spanker
      triSail([m.x - 0.4, DECK + 3, 0], [m.x - 0.4, DECK + m.h * 0.85, 0], [m.x - 9.5, DECK + 4.2, 0], 1.1);
      const gaff = spar(0.16, 0.16, 9.5);
      gaff.rotation.z = Math.PI / 2;
      gaff.position.set(m.x - 4.9, DECK + 4.1, 0);
      body.add(gaff);
    }
    if (m.x > -1 && m.x < 1) mainTop = new THREE.Vector3(m.x, DECK + m.h, 0);
  }
  // stays between mastheads and to the bowsprit
  line([masts[2].x, DECK + masts[2].h, 0], [masts[1].x, DECK + masts[1].h * 0.75, 0]);
  line([masts[1].x, DECK + masts[1].h, 0], [masts[0].x, DECK + masts[0].h * 0.8, 0]);
  const bowTip = [L / 2 + 9, DECK + 4.5, 0];
  line([masts[0].x, DECK + masts[0].h, 0], bowTip);
  const bowsprit = spar(0.35, 0.18, 12);
  bowsprit.rotation.z = -Math.PI / 2 + 0.28;
  bowsprit.position.set(L / 2 + 3.2, DECK + 2.9, 0);
  body.add(bowsprit);
  // jibs from the bowsprit up the fore stay
  triSail([L / 2 + 1, DECK + 2.6, 0], [L / 2 + 7.5, DECK + 4, 0], [masts[0].x + 0.6, DECK + masts[0].h * 0.72, 0], 1.0);
  triSail([L / 2 - 1.5, DECK + 2.6, 0], [L / 2 + 3.5, DECK + 3.4, 0], [masts[0].x + 0.6, DECK + masts[0].h * 0.52, 0], 0.8);

  const rigGeo = track(new THREE.BufferGeometry());
  rigGeo.setAttribute("position", new THREE.Float32BufferAttribute(rig, 3));
  const rigMat = track(new THREE.LineBasicMaterial({ color: 0x2a1d14, transparent: true, opacity: 0.85 }));
  body.add(new THREE.LineSegments(rigGeo, rigMat));

  // ---------- crow's nest and the lookout ----------
  const nestY = DECK + 21;
  const nest = new THREE.Mesh(track(new THREE.CylinderGeometry(1.3, 1.1, 1.3, 16, 1, true)), darkWood);
  nest.position.set(mainTop.x, nestY, 0);
  body.add(nest);
  const nestFloor = new THREE.Mesh(track(new THREE.CylinderGeometry(1.25, 1.25, 0.15, 16)), deckMat);
  nestFloor.position.set(mainTop.x, nestY - 0.6, 0);
  body.add(nestFloor);

  const skin = track(new THREE.MeshStandardMaterial({ color: 0xc98d62, roughness: 0.7 }));
  const shirt = track(new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.9 }));
  const red = track(new THREE.MeshStandardMaterial({ color: 0xa3201c, roughness: 0.8 }));
  const black = track(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }));
  const sailor = new THREE.Group();
  sailor.position.set(mainTop.x + 0.2, nestY - 0.5, 0);
  sailor.rotation.y = -0.5; // turned a little toward the viewer side
  sailor.scale.setScalar(1.45); // a touch heroic so the wave reads from shore
  body.add(sailor);
  const torso = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.34, 0.8, 6, 12)), shirt);
  torso.position.y = 1.1;
  sailor.add(torso);
  const sash = new THREE.Mesh(track(new THREE.CylinderGeometry(0.37, 0.37, 0.18, 12)), red);
  sash.position.y = 0.85;
  sailor.add(sash);
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.3, 16, 12)), skin);
  head.position.y = 1.95;
  sailor.add(head);
  // tricorn: a squat dark cone over a flat brim
  const brim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 3)), black);
  brim.position.y = 2.18;
  sailor.add(brim);
  const crown = new THREE.Mesh(track(new THREE.ConeGeometry(0.3, 0.32, 12)), black);
  crown.position.y = 2.36;
  sailor.add(crown);
  const armGeo = track(new THREE.CapsuleGeometry(0.11, 0.62, 4, 8));
  const restArm = new THREE.Mesh(armGeo, shirt);
  restArm.position.set(0, 1.25, -0.42);
  restArm.rotation.x = 0.5;
  sailor.add(restArm);
  // waving arm pivots at the shoulder
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
  const hand = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 10, 8)), skin);
  hand.position.y = 0.76;
  elbow.add(hand);

  // ---------- jolly roger at the main truck ----------
  const flagCanvas = document.createElement("canvas");
  flagCanvas.width = 256;
  flagCanvas.height = 160;
  const fc = flagCanvas.getContext("2d")!;
  fc.fillStyle = "#111";
  fc.fillRect(0, 0, 256, 160);
  fc.fillStyle = "#f2efe6";
  fc.strokeStyle = "#f2efe6";
  fc.lineCap = "round";
  fc.lineWidth = 14;
  fc.beginPath();
  fc.moveTo(78, 46); fc.lineTo(178, 126); fc.moveTo(178, 46); fc.lineTo(78, 126);
  fc.stroke();
  fc.beginPath();
  fc.arc(128, 70, 30, 0, Math.PI * 2);
  fc.fill();
  fc.fillRect(110, 86, 36, 22);
  fc.fillStyle = "#111";
  fc.beginPath(); fc.arc(117, 68, 8, 0, Math.PI * 2); fc.arc(139, 68, 8, 0, Math.PI * 2); fc.fill();
  fc.fillRect(118, 98, 4, 10); fc.fillRect(126, 98, 4, 10); fc.fillRect(134, 98, 4, 10);
  const flagTex = track(new THREE.CanvasTexture(flagCanvas));
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const flagGeo = track(new THREE.PlaneGeometry(5, 3.2, 24, 8));
  flagGeo.translate(2.5, 0, 0); // hoist edge at the mast; wind from astern streams it over the bow (+x)
  const flagBase = (flagGeo.getAttribute("position").array as Float32Array).slice();
  const flagMat = track(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }));
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(mainTop.x, mainTop.y + 0.2, 0);
  body.add(flag);

  // the whole ship rides a little low so the waterline sits at y = 0
  body.traverse((o) => {
    const m = o as THREENS.Mesh;
    if (m.isMesh) m.castShadow = true;
  });

  const update = (t: number) => {
    // the root floats on the simulated sea; this only adds a little settle and sway
    body.position.y = -0.55 + 0.06 * Math.sin(t * 1.9);
    body.rotation.x = 0.012 * Math.sin(t * 1.3);
    sailUniforms.uTime.value = t;
    // wave: big swing at the shoulder, smaller counter-swing at the elbow
    // arm raised and out to the side, swinging; the forearm lags for a natural wave
    shoulder.rotation.x = 0.45 + 0.42 * Math.sin(t * 5.2);
    elbow.rotation.x = 0.25 + 0.35 * Math.sin(t * 5.2 - 0.8);
    // flag streams with the wind and ripples, more at the free end
    const p = flagGeo.getAttribute("position") as THREENS.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = flagBase[i * 3], y = flagBase[i * 3 + 1];
      const fly = x / 5; // 0 at the hoist, 1 at the fly
      p.setZ(i, Math.sin(x * 1.6 - t * 9) * 0.38 * fly + Math.sin(y * 2 + t * 6) * 0.08 * fly);
      p.setY(i, y - fly * fly * 0.35);
    }
    p.needsUpdate = true;
    flagGeo.computeVertexNormals();
  };

  return {
    root,
    update: (t) => update(t),
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

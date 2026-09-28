import { Sculpt, type Vec3 } from "./sculpt";

/* Animal sculptures. Coordinates: +x = head, +y = up (ground at 0), ±z = left/right.
   Built from smooth-blended ellipsoids (masses) and round cones (limbs), sized from
   real proportions so silhouettes read at a glance. */

// scale: fits bulky animals into the same frame as the jaguar (the paper ball is not scaled)
export type Animal = { name: string; build: () => Sculpt; shadow: [number, number]; scale: number };

const DOWN: Vec3 = [0, -1, 0];

function jaguar(): Sculpt {
  const gold = 0xd99a3e;
  const goldLt = 0xe6b566;
  const cream = 0xf2e7cf;
  const ink = 0x3a2a1f;
  const nose = 0x7a4b3a;
  const spotted = { spots: 0.21, spotColor: ink };
  const belly = { axis: DOWN, thresh: 0.35, color: cream };
  const s = new Sculpt();
  // trunk: deep chest, tucked waist, muscular haunch
  s.ell([0, 0.8, 0], [0.6, 0.24, 0.22], gold, { ...spotted, alt: belly });
  s.ell([0.46, 0.76, 0], [0.34, 0.3, 0.24], gold, { k: 0.18, ...spotted, alt: belly });
  s.ell([-0.5, 0.82, 0], [0.33, 0.26, 0.23], gold, { k: 0.18, ...spotted, alt: belly });
  s.ell([0.4, 0.95, 0], [0.22, 0.12, 0.17], gold, { k: 0.14, ...spotted }); // shoulder blades
  // neck + head
  s.cone([0.6, 0.88, 0], [0.92, 1.02, 0], 0.19, 0.135, gold, { k: 0.12, ...spotted, alt: belly });
  s.ell([1.04, 1.05, 0], [0.205, 0.175, 0.19], gold, { k: 0.1, spots: 0.11, spotColor: ink });
  s.ell([1.22, 0.985, 0], [0.12, 0.095, 0.11], goldLt, { k: 0.07 }); // muzzle
  s.ell([1.14, 0.93, 0], [0.1, 0.05, 0.075], cream, { k: 0.06 }); // chin
  s.ell([1.33, 1.01, 0], [0.028, 0.025, 0.034], nose, { k: 0.02 });
  s.sym((z) => {
    s.ell([1.15, 1.1, z * 0.135], [0.032, 0.024, 0.022], ink, { k: 0 }); // eye
    s.cone([1.0, 1.18, z * 0.11], [0.96, 1.29, z * 0.14], 0.055, 0.022, gold, { k: 0.04 }); // ear
    s.ell([1.2, 1.0, z * 0.075], [0.05, 0.05, 0.03], cream, { k: 0.04 }); // whisker pad
  });
  // legs — mid-stride so the silhouette walks
  const front = (z: number, dx: number) => {
    s.cone([0.48, 0.8, z], [0.56 + dx, 0.42, z], 0.13, 0.075, gold, { k: 0.1, ...spotted });
    s.cone([0.56 + dx, 0.42, z], [0.58 + dx * 1.4, 0.1, z], 0.072, 0.052, gold, { k: 0.04, spots: 0.13, spotColor: ink });
    s.ell([0.63 + dx * 1.4, 0.045, z], [0.085, 0.045, 0.065], goldLt, { k: 0.04 });
  };
  const hind = (z: number, dx: number) => {
    s.cone([-0.5, 0.84, z], [-0.38 + dx, 0.47, z], 0.18, 0.09, gold, { k: 0.12, ...spotted });
    s.cone([-0.38 + dx, 0.47, z], [-0.6 + dx, 0.27, z], 0.085, 0.058, gold, { k: 0.04, spots: 0.13, spotColor: ink });
    s.cone([-0.6 + dx, 0.27, z], [-0.56 + dx, 0.08, z], 0.056, 0.05, gold, { k: 0.04 });
    s.ell([-0.5 + dx, 0.045, z], [0.08, 0.045, 0.06], goldLt, { k: 0.04 });
  };
  front(0.14, 0.1);
  front(-0.14, -0.04);
  hind(0.15, -0.06);
  hind(-0.15, 0.06);
  // long tail: droops then hooks up at the tip
  s.chain(
    [[-0.8, 0.9, 0], [-1.08, 0.8, 0.02], [-1.33, 0.62, 0.04], [-1.54, 0.5, 0.05], [-1.72, 0.52, 0.05], [-1.83, 0.64, 0.04]],
    [0.07, 0.06, 0.055, 0.05, 0.045, 0.04],
    gold,
    { k: 0.06, spots: 0.13, spotColor: ink }
  );
  s.ell([-1.85, 0.68, 0.04], [0.045, 0.05, 0.045], ink, { k: 0.03 });
  return s;
}

function rhino(): Sculpt {
  const grey = 0x9d978b;
  const greyDk = 0x857f74;
  const greyLt = 0xb5ae9f;
  const horn = 0xd8c9a8;
  const ink = 0x2c2824;
  const belly = { axis: DOWN, thresh: 0.3, color: greyLt };
  const s = new Sculpt();
  // barrel body, shoulder hump, heavy rump
  s.ell([0, 0.86, 0], [0.8, 0.42, 0.4], grey, { alt: belly });
  s.ell([0.46, 0.98, 0], [0.42, 0.4, 0.37], greyDk, { k: 0.2, alt: belly });
  s.ell([-0.56, 0.9, 0], [0.42, 0.4, 0.37], grey, { k: 0.2, alt: belly });
  s.ell([0.02, 0.66, 0], [0.6, 0.26, 0.33], greyLt, { k: 0.2 });
  // neck + long, low head
  s.cone([0.72, 0.96, 0], [0.98, 0.8, 0], 0.3, 0.23, greyDk, { k: 0.15 });
  s.ell([1.13, 0.72, 0], [0.36, 0.22, 0.2], grey, { k: 0.12, rot: [0, 0, -0.38] });
  s.ell([1.4, 0.56, 0], [0.18, 0.15, 0.17], grey, { k: 0.1 });
  s.ell([1.52, 0.49, 0], [0.08, 0.075, 0.11], greyLt, { k: 0.05 }); // lip
  // horns
  s.chain([[1.46, 0.66, 0], [1.55, 0.87, 0], [1.58, 1.1, 0]], [0.1, 0.06, 0.008], horn, { k: 0.03 });
  s.chain([[1.26, 0.8, 0], [1.29, 0.93, 0]], [0.055, 0.01], horn, { k: 0.03 });
  s.sym((z) => {
    s.ell([1.18, 0.78, z * 0.175], [0.024, 0.02, 0.02], ink, { k: 0 }); // eye
    s.chain([[0.97, 0.93, z * 0.13], [0.93, 1.08, z * 0.18], [0.92, 1.17, z * 0.19]], [0.045, 0.05, 0.035], greyDk, { k: 0.04 });
  });
  // short pillar legs with three-toed feet
  const leg = (x: number, z: number, top: number, r: number) => {
    s.cone([x - 0.02, top, z], [x + 0.01, 0.34, z], r, 0.15, grey, { k: 0.14 });
    s.cone([x + 0.01, 0.34, z], [x + 0.02, 0.08, z], 0.145, 0.14, grey, { k: 0.05 });
    s.ell([x + 0.05, 0.065, z], [0.17, 0.07, 0.16], greyDk, { k: 0.04 });
    for (const t of [-1, 0, 1]) s.ell([x + 0.19, 0.04, z + t * 0.08], [0.04, 0.04, 0.04], horn, { k: 0.01 });
  };
  leg(0.52, 0.24, 0.76, 0.2);
  leg(0.48, -0.24, 0.76, 0.2);
  leg(-0.58, 0.24, 0.84, 0.24);
  leg(-0.54, -0.24, 0.84, 0.24);
  s.chain([[-0.94, 0.98, 0], [-1.02, 0.8, 0], [-1.03, 0.63, 0]], [0.04, 0.03, 0.025], grey, { k: 0.04 });
  s.ell([-1.03, 0.58, 0], [0.03, 0.05, 0.03], ink, { k: 0.02 });
  return s;
}

function elephant(): Sculpt {
  const slate = 0x8d99a2;
  const slateDk = 0x77838d;
  const slateLt = 0xa6b0b7;
  const earIn = 0xd29f92;
  const tusk = 0xf2e9d6;
  const ink = 0x2a2a2e;
  const belly = { axis: DOWN, thresh: 0.35, color: slateLt };
  const s = new Sculpt();
  s.ell([0, 1.18, 0], [0.78, 0.52, 0.48], slate, { alt: belly });
  s.ell([0.05, 0.95, 0], [0.62, 0.34, 0.44], slateLt, { k: 0.2 });
  s.ell([-0.45, 1.22, 0], [0.45, 0.5, 0.45], slate, { k: 0.2, alt: belly });
  s.ell([0.45, 1.27, 0], [0.45, 0.52, 0.46], slateDk, { k: 0.2, alt: belly });
  // head: domed skull, heavy cheeks
  s.ell([0.98, 1.52, 0], [0.3, 0.36, 0.32], slate, { k: 0.15 });
  s.ell([1.02, 1.74, 0], [0.22, 0.18, 0.24], slate, { k: 0.12 });
  s.ell([1.12, 1.3, 0], [0.2, 0.2, 0.22], slate, { k: 0.12 });
  // trunk hangs, then curls forward at the tip
  s.chain(
    [[1.2, 1.42, 0], [1.3, 1.15, 0], [1.36, 0.88, 0], [1.38, 0.62, 0], [1.42, 0.4, 0], [1.5, 0.27, 0], [1.6, 0.29, 0], [1.64, 0.36, 0]],
    [0.15, 0.12, 0.1, 0.085, 0.072, 0.062, 0.052, 0.045],
    slateDk,
    { k: 0.07 }
  );
  s.sym((z) => {
    s.ell([1.14, 1.56, z * 0.255], [0.026, 0.022, 0.02], ink, { k: 0 }); // eye
    // tusks sweep forward and up
    s.chain([[1.14, 1.2, z * 0.15], [1.3, 1.03, z * 0.18], [1.47, 0.98, z * 0.17], [1.58, 1.05, z * 0.14]], [0.045, 0.04, 0.03, 0.008], tusk, { k: 0.01 });
    // big fan ears: thin discs angled back from the head, pink inside
    s.ell([0.8, 1.44, z * 0.4], [0.28, 0.4, 0.04], slateLt, {
      k: 0.05,
      rot: [0, z * 0.45, z * 0.08],
      alt: { axis: [-0.45, 0, -z * 0.9], thresh: 0.4, color: earIn },
    });
  });
  const leg = (x: number, z: number, r: number) => {
    s.cone([x, 1.05, z], [x + 0.02, 0.14, z], r, 0.18, slate, { k: 0.12 });
    s.ell([x + 0.03, 0.075, z], [0.2, 0.08, 0.2], slateDk, { k: 0.05 });
    for (const t of [-1, 0, 1]) s.ell([x + 0.2, 0.05, z + t * 0.09], [0.045, 0.045, 0.045], tusk, { k: 0.01 });
  };
  leg(0.5, 0.27, 0.21);
  leg(0.44, -0.27, 0.21);
  leg(-0.52, 0.27, 0.23);
  leg(-0.46, -0.27, 0.23);
  s.chain([[-0.86, 1.32, 0], [-0.94, 1.02, 0], [-0.95, 0.8, 0]], [0.045, 0.03, 0.025], slate, { k: 0.04 });
  s.ell([-0.95, 0.75, 0], [0.03, 0.06, 0.03], ink, { k: 0.02 });
  return s;
}

export const ANIMALS: Animal[] = [
  { name: "jaguar", build: jaguar, shadow: [1.9, 0.85], scale: 1 },
  { name: "rhino", build: rhino, shadow: [1.75, 0.95], scale: 0.8 },
  { name: "elephant", build: elephant, shadow: [1.65, 0.95], scale: 0.74 },
];

export const BALL_PAPER = 0xefe6d4;

import * as THREE from 'three';
import type { SharkDef, PreyDef, Kind } from './data';

const lam = (color: number, opts: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });

function fin(points: [number, number][], color: number, z = 0): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.z = z;
  return m;
}

/** 单位长度 1，朝向 +X */
export function createSharkMesh(def: SharkDef): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = lam(def.color, { emissive: 0x0a1a22 });
  const darkMat = lam(def.fin, { emissive: 0x08151c });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), bodyMat);
  body.scale.set(3.2, 1, 0.92);
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lam(def.belly, { emissive: 0x0e1a1e }));
  belly.scale.set(2.8, 0.55, 0.82);
  belly.position.y = -0.055;
  g.add(belly);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.24, 8), bodyMat);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(0.58, -0.005, 0);
  g.add(snout);

  const tailBase = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), bodyMat);
  tailBase.rotation.z = Math.PI / 2;
  tailBase.position.set(-0.55, 0, 0);
  g.add(tailBase);

  const tail = new THREE.Group();
  tail.position.set(-0.5, 0, 0);
  const tailFin = fin([[0, 0], [-0.11, 0.3], [-0.02, 0.04], [-0.12, -0.3], [0, 0]], def.fin, 0);
  tail.add(tailFin);
  g.add(tail);
  g.userData.tail = tail;

  const dorsal = fin([[-0.06, 0.1], [0.1, 0.1], [0.16, 0.36], [0.0, 0.3]], def.fin, 0);
  g.add(dorsal);

  const pectR = fin([[0.04, -0.04], [-0.14, -0.3], [0.14, -0.1]], def.fin, 0.1);
  pectR.rotation.x = 0.5;
  g.add(pectR);
  const pectL = fin([[0.04, -0.04], [0.14, -0.3], [-0.14, -0.1]], def.fin, -0.1);
  pectL.rotation.x = -0.5;
  g.add(pectL);

  const eyeGeo = new THREE.SphereGeometry(0.028, 8, 6);
  const eyeMat = lam(0x10181c);
  for (const z of [-0.105, 0.105]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.38, 0.055, z);
    g.add(eye);
  }

  const gillMat = lam(0x3d4d54);
  for (let i = 0; i < 3; i++) {
    const gill = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.17), gillMat);
    gill.position.set(0.2 + i * 0.045, 0, 0);
    g.add(gill);
  }

  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lam(0x161d21));
  mouth.scale.set(1.6, 0.5, 1.1);
  mouth.position.set(0.47, -0.045, 0);
  g.add(mouth);

  const toothMat = new THREE.MeshBasicMaterial({ color: 0xf7f2e4 });
  for (let i = 0; i < 4; i++) {
    for (const z of [-0.075, 0.075]) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.05, 4), toothMat);
      tooth.rotation.z = Math.PI;
      tooth.position.set(0.42 + i * 0.035, -0.012, z);
      g.add(tooth);
    }
  }

  return g;
}

function fishMesh(def: PreyDef): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), lam(def.color));
  body.scale.set(1.45, 0.55, 0.4);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), lam(def.accent));
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -1.5;
  g.add(tail);
  const eyeGeo = new THREE.SphereGeometry(0.12, 6, 5);
  const eyeMat = lam(0x10181c);
  for (const z of [-0.26, 0.26]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(0.95, 0.18, z);
    g.add(e);
  }
  return g;
}

export function createPreyMesh(def: PreyDef): THREE.Group {
  const g = new THREE.Group();
  switch (def.kind) {
    case 'fish':
    case 'gem': {
      if (def.kind === 'gem') {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), lam(def.color, { emissive: 0x1c7d96, emissiveIntensity: 1.4 }));
        g.add(gem);
      } else {
        const f = fishMesh(def);
        g.add(...f.children);
      }
      break;
    }
    case 'turtle': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), lam(def.color));
      body.scale.set(1.3, 0.5, 0.95);
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lam(0x9fc08a));
      head.position.set(1.15, 0.1, 0);
      g.add(head);
      for (const [x, z] of [[0.55, 0.85], [0.55, -0.85], [-0.55, 0.85], [-0.55, -0.85]] as const) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.34), lam(def.accent));
        f.position.set(x, -0.05, z);
        f.rotation.z = x > 0 ? 0.3 : -0.3;
        g.add(f);
      }
      break;
    }
    case 'crab': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), lam(def.color));
      body.scale.set(1.15, 0.5, 0.78);
      g.add(body);
      for (const z of [-0.85, 0.85]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 5), lam(def.accent));
        claw.rotation.z = -Math.PI / 2;
        claw.position.set(0.85, 0.05, z);
        g.add(claw);
      }
      for (const z of [-0.55, 0, 0.55]) {
        for (const x of [-0.65, 0.2]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 4), lam(def.accent));
          leg.rotation.z = 0.5;
          leg.position.set(x, -0.45, z);
          g.add(leg);
        }
      }
      break;
    }
    case 'pelican': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 9, 7), lam(def.color));
      body.scale.set(1.3, 0.9, 0.8);
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), lam(def.color));
      head.position.set(0.85, 0.55, 0);
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 5), lam(def.accent));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(1.45, 0.45, 0);
      g.add(beak);
      for (const z of [-0.55, 0.55]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), lam(0xc9c6b8));
        wing.position.set(-0.05, 0.1, z);
        wing.rotation.z = 0.25;
        g.add(wing);
      }
      break;
    }
    case 'fisher':
    case 'diver': {
      const isDiver = def.kind === 'diver';
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 4, 8), lam(def.color));
      g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), lam(0xf0c9a0));
      head.position.set(0.05, 0.85, 0);
      g.add(head);
      if (isDiver) {
        const mask = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), lam(def.accent, { emissive: 0x3a2a00 }));
        mask.position.set(0.34, 0.9, 0);
        g.add(mask);
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8), lam(0xb9c7cc));
        tank.position.set(-0.42, 0.05, 0);
        g.add(tank);
        for (const z of [-0.22, 0.22]) {
          const finM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), lam(0x25333b));
          finM.position.set(0, -1.05, z);
          g.add(finM);
        }
      } else {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 8), lam(0xe8e0c8));
        hat.position.set(0.05, 1.12, 0);
        g.add(hat);
      }
      break;
    }
    case 'manta': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), lam(def.color));
      body.scale.set(1.0, 0.38, 1.3);
      g.add(body);
      const wing = fin([[-1.35, 0], [0.15, 1.9], [1.0, 0], [0.15, -1.9]], def.color, -0.02);
      g.add(wing);
      const ridge = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lam(def.accent));
      ridge.scale.set(1.4, 0.5, 0.9);
      ridge.position.y = 0.18;
      g.add(ridge);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1.4, 5), lam(def.accent));
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -1.5;
      g.add(tail);
      break;
    }
    case 'sailfish': {
      const g2 = fishMesh(def);
      g.add(...g2.children);
      const sail = fin([[-0.4, 0.4], [0.6, 0.4], [0.45, 1.5], [-0.3, 1.0]], def.accent, 0);
      g.add(sail);
      const bill = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.2, 5), lam(def.accent));
      bill.rotation.z = -Math.PI / 2;
      bill.position.set(1.9, 0.1, 0);
      g.add(bill);
      break;
    }
    case 'gulper': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), lam(def.color));
      body.scale.set(1.35, 0.85, 0.7);
      g.add(body);
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), lam(def.accent));
      mouth.position.set(1.0, -0.2, 0);
      g.add(mouth);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 5), lam(def.accent));
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -1.5;
      g.add(tail);
      break;
    }
    case 'angler': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), lam(def.color));
      body.scale.set(1.25, 0.85, 0.75);
      g.add(body);
      const lure = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: def.accent }));
      lure.position.set(1.1, 1.05, 0);
      g.add(lure);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), lam(def.color));
      stem.position.set(0.8, 0.75, 0);
      stem.rotation.z = 0.4;
      g.add(stem);
      break;
    }
    case 'shark':
    case 'gw': {
      const mini: SharkDef = {
        id: 'reef', name: 'shark', cost: 0, length: 1, hp: 1, speed: 1, boostMul: 1,
        bite: 1, depth: 1, diet: 1, color: def.color, belly: 0xd7e2e2, fin: def.accent,
        blurb: '',
      };
      const s = createSharkMesh(mini);
      s.scale.setScalar(def.kind === 'gw' ? 1.9 : 1.25);
      g.add(s);
      break;
    }
  }
  if (def.kind !== 'gem' && def.kind !== 'shark' && def.kind !== 'gw') {
    // 统一尺寸：由 radius 决定
  }
  return g;
}

export function createHazardMesh(kind: string): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'jelly') {
    const mat = new THREE.MeshLambertMaterial({ color: 0xb27de8, transparent: true, opacity: 0.62, emissive: 0x3b1a5c, emissiveIntensity: 0.7 });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), mat);
    bell.scale.set(1, 0.75, 1);
    g.add(bell);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.6, 4), mat);
      t.position.set(Math.cos(i * 1.57) * 0.4, -1.0, Math.sin(i * 1.57) * 0.4);
      g.add(t);
    }
  } else if (kind === 'mine') {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), lam(0x334048));
    g.add(ball);
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), lam(0x7d2b28));
      spike.position.set(Math.cos(i * 0.785) * 1.05, Math.sin(i * 0.785) * 1.05, 0);
      spike.rotation.z = i * 0.785 - Math.PI / 2;
      g.add(spike);
    }
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe8433c }));
    light.position.z = 1.0;
    g.add(light);
  } else if (kind === 'sub') {
    const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.0, 4, 8), lam(0xc9a03a));
    bodyM.rotation.z = Math.PI / 2;
    g.add(bodyM);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.8), lam(0xa8801f));
    tower.position.y = 0.9;
    g.add(tower);
    const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5), lam(0x6e5418));
    periscope.position.set(0, 1.6, 0);
    g.add(periscope);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.2), lam(0x53381a));
    prop.position.x = -1.9;
    g.add(prop);
  } else if (kind === 'missile') {
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), lam(0xb43a2f));
    bodyM.rotation.z = Math.PI / 2;
    g.add(bodyM);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 6), lam(0xe8d9b0));
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = 0.6;
    g.add(tip);
  }
  return g;
}

export function createBoatMesh(): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 2.6), lam(0x8a5a34));
  hull.position.y = -0.2;
  g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.24, 2.3), lam(0xc89a63));
  deck.position.y = 0.55;
  g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.9), lam(0xe4dcc4));
  cabin.position.set(-1.6, 1.4, 0);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 2.1), lam(0xb03a30));
  roof.position.set(-1.6, 2.25, 0);
  g.add(roof);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 5), lam(0x6b4a2a));
  mast.position.set(1.8, 2.1, 0);
  g.add(mast);
  return g;
}

export function createCollectibleMesh(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), lam(0x8a5a34));
  g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.9), lam(0xc9a03a));
  lid.position.y = 0.45;
  g.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.1), new THREE.MeshBasicMaterial({ color: 0xffc63d }));
  lock.position.set(0, 0.2, 0.44);
  g.add(lock);
  return g;
}

export function createShellMesh(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI), lam(0xf2d7a8));
  shell.scale.set(1, 0.55, 1);
  g.add(shell);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
  glow.position.y = 0.35;
  g.add(glow);
  return g;
}

export function createCrabBossMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), lam(0x5c7047, { emissive: 0x101a0c }));
  body.scale.set(6.2, 3.4, 4.4);
  g.add(body);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), lam(0x748a55, { emissive: 0x141d0e }));
  shell.scale.set(5.6, 2.2, 4.0);
  shell.position.y = 1.2;
  g.add(shell);
  for (const z of [-1, 1]) {
    const clawArm = new THREE.Group();
    clawArm.position.set(3.4, 0.2, z * 3.2);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 4.2, 6), lam(0x4c5f3a));
    arm.rotation.z = 0.4;
    arm.position.set(1.2, 0.4, 0);
    clawArm.add(arm);
    const pincer = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.6, 5), lam(0x869a5c));
    pincer.rotation.z = -Math.PI / 2 + 0.3;
    pincer.position.set(4.2, 1.2, 0);
    clawArm.add(pincer);
    g.add(clawArm);
    g.userData[z > 0 ? 'clawR' : 'clawL'] = clawArm;
  }
  for (let i = 0; i < 3; i++) {
    for (const z of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 4.6, 5), lam(0x4c5f3a));
      leg.rotation.z = 0.9;
      leg.position.set(-2 + i * 1.6, -2.4, z * 3.4);
      g.add(leg);
    }
  }
  const weak = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.0 }));
  weak.position.set(-4.6, 0.6, 0);
  g.add(weak);
  g.userData.weak = weak;

  // 眼睛与背刺
  for (const z of [-2.3, 2.3]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2ede0 }));
    eye.position.set(3.4, 2.1, z);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0x120d10 }));
    pupil.position.set(3.95, 2.1, z);
    g.add(pupil);
  }
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 4), lam(0x41502f));
    spike.position.set(-3.2 + i * 1.6, 3.2, 0);
    spike.rotation.z = -0.15 + (i - 2) * 0.06;
    g.add(spike);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.36, 2.6), lam(0x241c12));
  mouth.position.set(5.2, -0.9, 0);
  g.add(mouth);

  return g;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PREY, ZONES, zoneAt, COLLECTIBLE_SPOTS, SHELL_SPOTS, BOAT_SPOTS, type PreyDef } from './data';
import {
  createPreyMesh, createHazardMesh, createBoatMesh, createCollectibleMesh,
  createShellMesh, createCrabBossMesh,
} from './mesh';
import type { Player } from './player';
import type { Bus } from './bus';

interface Ent {
  active: boolean;
  kind: string;
  def: PreyDef | null;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  r: number;
  bite: number;
  gold: boolean;
  t: number;
  phase: number;
  mesh: THREE.Object3D | null;
  slot: number;
  homeX: number;
  cooldown: number;
  state: string;
  life: number;
  scale: number;
}

const FISH_MAX = 90;
const ENT_MAX = 190;
const PART_MAX = 420;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function newEnt(): Ent {
  return {
    active: false, kind: '', def: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, r: 0.5,
    bite: 0, gold: false, t: 0, phase: 0, mesh: null, slot: -1, homeX: 0,
    cooldown: 0, state: '', life: 0, scale: 1,
  };
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  goldRush = false;
  bossActive = false;
  bossDefeated = false;
  lowQuality = false;

  private bus: Bus;
  private player!: Player;
  private camX = 0;
  private camY = -24;
  private camZ = 18;
  private shakeAmt = 0;
  private time = 0;
  private bubbleTimer = 0;

  private ents: Ent[] = [];
  private fish: Ent[] = [];
  private fishMesh: THREE.InstancedMesh;
  private fishDummy = new THREE.Object3D();
  private fishCursor = 0;
  private fishColor = new THREE.Color();

  private collectibles: Ent[] = [];
  private boats: { x: number; mesh: THREE.Group }[] = [];
  private meshPool = new Map<string, THREE.Object3D[]>();
  private spawnTimer = 0;

  private boss = {
    mesh: null as THREE.Group | null,
    x: -430, y: -126, r: 12,
    state: 'sleep', timer: 0, dodge: 0, phase: 3, vuln: 0, hitCd: 0,
  };

  private bgUniforms = { uTime: { value: 0 }, uSunX: { value: 0 } };
  private shafts: THREE.Mesh[] = [];
  private lamp: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;

  private pPos!: Float32Array;
  private pCol!: Float32Array;
  private pVel: Float32Array = new Float32Array(PART_MAX * 2);
  private pLife = new Float32Array(PART_MAX);
  private pMaxLife = new Float32Array(PART_MAX);
  private pCursor = 0;
  private pGeo!: THREE.BufferGeometry;
  private pPoints!: THREE.Points;

  private snowPos!: Float32Array;
  private snowBase: Float32Array = new Float32Array(400 * 3);
  private snowGeo!: THREE.BufferGeometry;
  private snowPoints!: THREE.Points;

  private tmpColor = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, bus: Bus) {
    this.bus = bus;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const vh = Math.round(window.visualViewport?.height ?? window.innerHeight);
    this.renderer.setSize(vw, vh);
    this.renderer.setClearColor(0x0b4a5e);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(52, vw / vh, 0.1, 400);
    this.camera.position.set(0, -20, 18);

    this.scene.fog = new THREE.FogExp2(0x2fa9c4, 0.011);

    this.lamp = new THREE.HemisphereLight(0xcdf3ff, 0x0a2a38, 1.45);
    this.scene.add(this.lamp);
    this.sun = new THREE.DirectionalLight(0xfff4d6, 0.85);
    this.sun.position.set(0.3, 1, 0.7);
    this.scene.add(this.sun);

    for (let i = 0; i < 10; i++) this.ents.push(newEnt());
    while (this.ents.length < ENT_MAX) this.ents.push(newEnt());
    for (let i = 0; i < FISH_MAX; i++) {
      const e = newEnt();
      e.slot = i;
      this.fish.push(e);
    }

    const fishGeo = this.makeFishGeometry();
    const fishMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, FISH_MAX);
    this.fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fishMesh.frustumCulled = false;
    this.fishDummy.scale.setScalar(0);
    this.fishDummy.updateMatrix();
    for (let i = 0; i < FISH_MAX; i++) {
      this.fishMesh.setMatrixAt(i, this.fishDummy.matrix);
      this.fishMesh.setColorAt(i, this.tmpColor.setHex(0xffffff));
    }
    this.scene.add(this.fishMesh);

    this.buildBackground();
    this.buildTerrain();
    this.buildParticles();
    this.buildSnow();
    this.buildBoss();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private makeFishGeometry(): THREE.BufferGeometry {
    const body = new THREE.SphereGeometry(1, 8, 6);
    body.scale(1.45, 0.55, 0.4);
    const tail = new THREE.ConeGeometry(0.5, 0.9, 4);
    tail.rotateZ(Math.PI / 2);
    tail.translate(-1.55, 0, 0);
    const merged = mergeGeometries([body, tail]);
    return merged ?? body;
  }

  private buildBackground(): void {
    const geo = new THREE.PlaneGeometry(1700, 420);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.bgUniforms,
      depthWrite: false,
      vertexShader: `
        varying vec3 vW;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec3 vW;
        uniform float uTime;
        uniform float uSunX;
        void main(){
          float h = clamp((vW.y + 165.0) / 172.0, 0.0, 1.0);
          vec3 deep = vec3(0.008, 0.055, 0.085);
          vec3 mid = vec3(0.028, 0.30, 0.40);
          vec3 top = vec3(0.45, 0.86, 0.92);
          vec3 col = mix(deep, mid, smoothstep(0.0, 0.58, h));
          col = mix(col, top, smoothstep(0.74, 1.0, h));
          float d = distance(vW.xy, vec2(uSunX, 62.0));
          col += vec3(0.42, 0.44, 0.30) * exp(-d * d / 1600.0) * 0.55;
          float ca = sin(vW.x * 0.11 + uTime * 0.45) * sin(vW.y * 0.085 - uTime * 0.32);
          col += vec3(0.02, 0.035, 0.035) * ca * smoothstep(0.5, 1.0, h);
          col += 0.010 * sin(vW.y * 0.25 + uTime * 0.5);
          col += 0.006 * sin(vW.x * 0.06 - uTime * 0.3);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -60, -130);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    // 水面亮带
    const c = document.createElement('canvas');
    c.width = 8; c.height = 64;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, 'rgba(220,255,255,0.85)');
    grd.addColorStop(0.35, 'rgba(160,240,250,0.35)');
    grd.addColorStop(1, 'rgba(120,220,240,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 8, 64);
    const tex = new THREE.CanvasTexture(c);
    const surf = new THREE.Mesh(
      new THREE.PlaneGeometry(1700, 12),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }),
    );
    surf.position.set(0, 3, -2);
    this.scene.add(surf);

    // 光柱
    const sc = document.createElement('canvas');
    sc.width = 64; sc.height = 256;
    const sctx = sc.getContext('2d')!;
    const sg = sctx.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, 'rgba(210,250,255,0.55)');
    sg.addColorStop(0.55, 'rgba(170,240,255,0.12)');
    sg.addColorStop(1, 'rgba(150,230,255,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 64, 256);
    sctx.globalCompositeOperation = 'destination-in';
    const hg = sctx.createLinearGradient(0, 0, 64, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.32, 'rgba(0,0,0,0.9)');
    hg.addColorStop(0.68, 'rgba(0,0,0,0.9)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = hg;
    sctx.fillRect(0, 0, 64, 256);
    const stex = new THREE.CanvasTexture(sc);
    void stex;
    // 大幅光柱在移动端容易显得生硬，改用背景焦散与水面亮带表达光照
    this.shafts.length = 0;
  }

  private buildTerrain(): void {
    const sandC = document.createElement('canvas');
    sandC.width = 512; sandC.height = 256;
    const ctx = sandC.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#e8d7a6');
    g.addColorStop(0.5, '#d6c08a');
    g.addColorStop(1, '#a7935f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      ctx.arc(x, y, 8 + Math.random() * 26, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,100,60,0.18)';
    for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
    const tex = new THREE.CanvasTexture(sandC);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1700, 70),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    floor.position.set(0, -185, -8);
    this.scene.add(floor);

    // 远景岩壁
    let seed = 20240607;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 14; i++) {
      const w = 30 + rnd() * 60;
      const h = 30 + rnd() * 70;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0);
      shape.lineTo(-w * 0.3, h * 0.6);
      shape.lineTo(-w * 0.05, h * 0.86);
      shape.lineTo(w * 0.2, h * 0.55);
      shape.lineTo(w / 2, 0);
      shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x0b3644 }));
      m.position.set(-800 + i * 120 + rnd() * 40, -150, -58);
      this.scene.add(m);
    }

    // 中景远山由实例化礁石承担，避免大块剪影遮挡视野

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x14434f, flatShading: true }), 34);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 34; i++) {
      dummy.position.set(-700 + rnd() * 1400, -150 + rnd() * 22, -16 - rnd() * 10);
      const s = 2 + rnd() * 7;
      dummy.scale.set(s, s * (0.7 + rnd() * 0.6), s);
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(rocks);

    const coralGeo = new THREE.ConeGeometry(0.6, 2.4, 5);
    const corals = new THREE.InstancedMesh(coralGeo, new THREE.MeshLambertMaterial({ color: 0xf08a4b, flatShading: true }), 60);
    for (let i = 0; i < 60; i++) {
      dummy.position.set(-700 + rnd() * 1400, -150 + rnd() * 16, -6 - rnd() * 6);
      const s = 0.8 + rnd() * 2.4;
      dummy.scale.set(s, s * (0.8 + rnd() * 1.2), s);
      dummy.rotation.set(rnd() * 0.4, 0, rnd() * 0.6 - 0.3);
      dummy.updateMatrix();
      corals.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(corals);

    const coral2 = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.8, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0xe86a8a, flatShading: true }), 44,
    );
    for (let i = 0; i < 44; i++) {
      dummy.position.set(-700 + rnd() * 1400, -150 + rnd() * 14, -5 - rnd() * 8);
      const s = 0.7 + rnd() * 1.8;
      dummy.scale.set(s, s * 0.7, s);
      dummy.rotation.set(0, rnd() * 3, 0);
      dummy.updateMatrix();
      coral2.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(coral2);

    // 中景礁石：覆盖浅滩到深渊，制造视差与“有地形”的包围感
    const midRocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x113c47, flatShading: true }), 78,
    );
    for (let i = 0; i < 78; i++) {
      const yy = i < 34 ? -20 - rnd() * 40 : -22 - rnd() * 126;
      dummy.position.set(-760 + rnd() * 1520, yy, -12 - rnd() * 16);
      const s = 2.0 + rnd() * 5.5;
      dummy.scale.set(s, s * (0.6 + rnd() * 0.8), s);
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      dummy.updateMatrix();
      midRocks.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(midRocks);

    const midCoral = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.55, 2.6, 5),
      new THREE.MeshLambertMaterial({ color: 0xe8763f, flatShading: true }), 72,
    );
    for (let i = 0; i < 72; i++) {
      dummy.position.set(-740 + rnd() * 1480, -26 - rnd() * 32, -7 - rnd() * 8);
      const s = 0.6 + rnd() * 1.4;
      dummy.scale.set(s, s * (0.9 + rnd() * 1.1), s);
      dummy.rotation.set(rnd() * 0.3, 0, rnd() * 0.6 - 0.3);
      dummy.updateMatrix();
      midCoral.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(midCoral);

    const kelpMat = new THREE.MeshLambertMaterial({ color: 0x24523a, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const kelp = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 8), kelpMat, 58);
    for (let i = 0; i < 58; i++) {
      dummy.position.set(-740 + rnd() * 1480, -30 - rnd() * 46, -8 - rnd() * 8);
      const s = 0.6 + rnd() * 1.2;
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, 0, rnd() * 0.4 - 0.2);
      dummy.updateMatrix();
      kelp.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(kelp);

    // 螃蟹巢穴背景
    const lair = new THREE.Mesh(
      new THREE.CircleGeometry(52, 24),
      new THREE.MeshBasicMaterial({ color: 0x05171f }),
    );
    lair.position.set(-432, -122, -14);
    this.scene.add(lair);
  }

  private buildParticles(): void {
    this.pPos = new Float32Array(PART_MAX * 3);
    this.pCol = new Float32Array(PART_MAX * 3);
    for (let i = 0; i < PART_MAX; i++) this.pPos[i * 3 + 1] = -9999;
    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.pPoints = new THREE.Points(this.pGeo, new THREE.PointsMaterial({
      size: 0.34, vertexColors: true, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.NormalBlending,
    }));
    this.pPoints.frustumCulled = false;
    this.scene.add(this.pPoints);
  }

  private buildSnow(): void {
    this.snowPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const x = rand(-70, 70);
      const y = rand(-45, 45);
      const z = rand(-12, -2);
      this.snowBase[i * 3] = x;
      this.snowBase[i * 3 + 1] = y;
      this.snowBase[i * 3 + 2] = z;
      this.snowPos[i * 3] = x;
      this.snowPos[i * 3 + 1] = y;
      this.snowPos[i * 3 + 2] = z;
    }
    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snowPoints = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({
      color: 0xcdefff, size: 0.14, transparent: true, opacity: 0.45, depthWrite: false,
    }));
    this.snowPoints.frustumCulled = false;
    this.scene.add(this.snowPoints);
  }

  private buildBoss(): void {
    const mesh = createCrabBossMesh();
    mesh.position.set(this.boss.x, this.boss.y, 0);
    this.scene.add(mesh);
    this.boss.mesh = mesh;

    const cool = new THREE.PointLight(0x35c6d8, 3.2, 110, 1.8);
    cool.position.set(this.boss.x + 6, this.boss.y + 10, 12);
    this.scene.add(cool);
    const warm = new THREE.PointLight(0xff8a5c, 2.2, 70, 1.8);
    warm.position.set(this.boss.x + 10, this.boss.y + 2, 8);
    this.scene.add(warm);

    // 蟹巢内的珊瑚与岩壁，贴近原版 Boss 房氛围
    const coralMat = new THREE.MeshLambertMaterial({ color: 0x4f7a4a, flatShading: true });
    const coralMat2 = new THREE.MeshLambertMaterial({ color: 0xb06a4a, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const h = 3 + Math.random() * 7;
      const coral = new THREE.Mesh(new THREE.ConeGeometry(1.2 + Math.random() * 1.4, h, 5), i % 3 === 0 ? coralMat2 : coralMat);
      coral.position.set(this.boss.x - 26 + Math.random() * 54, this.boss.y + 8 + Math.random() * 10, -4 - Math.random() * 6);
      coral.rotation.z = (Math.random() - 0.5) * 0.4;
      this.scene.add(coral);
    }
    for (let i = 0; i < 5; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1, 0),
        new THREE.MeshLambertMaterial({ color: 0x123a45, flatShading: true }),
      );
      const s = 4 + Math.random() * 7;
      rock.scale.set(s, s * 0.8, s);
      rock.position.set(this.boss.x - 30 + Math.random() * 62, this.boss.y - 14 - Math.random() * 10, -8 - Math.random() * 8);
      this.scene.add(rock);
    }
  }

  setPlayer(p: Player): void {
    this.player = p;
  }

  reset(player: Player): void {
    this.player = player;
    for (const e of this.ents) this.deactivate(e);
    for (const e of this.fish) this.deactivate(e);
    for (const c of this.collectibles) {
      if (c.mesh) this.scene.remove(c.mesh);
      c.active = false;
    }
    this.collectibles.length = 0;
    for (const b of this.boats) this.scene.remove(b.mesh);
    this.boats.length = 0;
    this.spawnTimer = 0;
    this.time = 0;
    this.goldRush = false;
    this.shakeAmt = 0;
    this.camX = player.x;
    this.camY = player.y + 3;
    this.camZ = 18;

    this.boss.state = 'sleep';
    this.boss.phase = 3;
    this.boss.dodge = 0;
    this.boss.vuln = 0;
    this.boss.timer = 0;
    this.bossActive = false;
    this.bossDefeated = false;
    if (this.boss.mesh) {
      this.boss.mesh.visible = true;
      this.boss.mesh.position.set(this.boss.x, this.boss.y, 0);
      this.boss.mesh.rotation.set(0, 0, 0);
      const weak = this.boss.mesh.userData.weak as THREE.Mesh | undefined;
      if (weak) (weak.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    for (let i = 0; i < PART_MAX; i++) {
      this.pLife[i] = 0;
      this.pPos[i * 3 + 1] = -9999;
    }
    this.pGeo.attributes.position.needsUpdate = true;

    this.spawnBoats();
    this.spawnCollectibles();
    this.spawnStarterFish();
    this.spawnSchool(8, true, -1);
    this.spawnSchool(8, false);
    for (let i = 0; i < 6; i++) this.spawnRandomMid(true);
    this.spawnRandomHazard(true);
  }

  /** 出生点正前方的一小群鱼，保证首 5 秒有东西可吃 */
  private spawnStarterFish(): void {
    const def = PREY.sardine;
    for (let i = 0; i < 9; i++) {
      const e = this.getFreeFish();
      if (!e) return;
      e.active = true;
      e.kind = 'fish';
      e.def = def;
      e.x = clamp(this.player.x + rand(1.2, 8), -440, 440);
      e.y = clamp(this.player.y + rand(-2.2, 2.2), -146, 2);
      e.z = rand(-1, 1);
      e.vx = rand(-0.4, 0.8);
      e.vy = rand(-0.3, 0.3);
      e.r = def.radius;
      e.bite = 0;
      e.gold = i === 0;
      e.t = rand(0, 4);
      e.phase = rand(0, 6);
      e.scale = def.radius * (e.gold ? 1.1 : 1);
      this.updateFishSlot(e);
    }
  }

  private spawnBoats(): void {
    for (const spot of BOAT_SPOTS) {
      const mesh = createBoatMesh();
      mesh.position.set(spot.x, -3.4, -1.5);
      this.scene.add(mesh);
      this.boats.push({ x: spot.x, mesh });
      const e = this.getFree();
      if (!e) continue;
      e.active = true;
      e.kind = 'fisherman';
      e.def = PREY.fisherman;
      e.x = spot.x + rand(-1.6, 1.6);
      e.y = -1.9;
      e.z = -1;
      e.vx = 0; e.vy = 0;
      e.r = PREY.fisherman.radius;
      e.bite = 0; e.gold = Math.random() < 0.12; e.t = rand(0, 6); e.phase = 0;
      e.homeX = spot.x; e.cooldown = 0; e.state = 'boat'; e.life = 0;
      e.mesh = this.acquireMesh(PREY.fisherman);
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.scale.setScalar(PREY.fisherman.radius);
      if (e.gold) this.applyGold(e, true);
    }
  }

  private spawnCollectibles(): void {
    for (const spot of COLLECTIBLE_SPOTS) {
      this.addCollectible(spot.x, spot.y, false);
    }
    for (const spot of SHELL_SPOTS) {
      this.addCollectible(spot.x, spot.y, true);
    }
  }

  private addCollectible(x: number, y: number, shell: boolean): void {
    const mesh = shell ? createShellMesh() : createCollectibleMesh();
    mesh.position.set(x, y, -0.5);
    this.scene.add(mesh);
    const e = newEnt();
    e.active = true;
    e.kind = shell ? 'shell' : 'object';
    e.x = x; e.y = y; e.z = -0.5;
    e.r = 0.9;
    e.mesh = mesh;
    e.scale = 1;
    e.t = rand(0, 6);
    this.collectibles.push(e);
  }

  private acquireMesh(def: PreyDef): THREE.Object3D {
    const key = def.id;
    const pool = this.meshPool.get(key);
    if (pool && pool.length) {
      const m = pool.pop()!;
      m.visible = true;
      m.rotation.set(0, 0, 0);
      this.scene.add(m);
      return m;
    }
    const m = def.kind === 'shark' || def.kind === 'gw' || PREY[def.id]
      ? createPreyMesh(def)
      : createPreyMesh(def);
    this.scene.add(m);
    return m;
  }

  private acquireHazard(kind: string): THREE.Object3D {
    const key = `hazard:${kind}`;
    const pool = this.meshPool.get(key);
    if (pool && pool.length) {
      const m = pool.pop()!;
      m.visible = true;
      m.rotation.set(0, 0, 0);
      this.scene.add(m);
      return m;
    }
    const m = createHazardMesh(kind);
    this.scene.add(m);
    return m;
  }

  private release(e: Ent): void {
    if (e.mesh) {
      this.scene.remove(e.mesh);
      const key = e.def ? e.def.id : `hazard:${e.kind}`;
      let pool = this.meshPool.get(key);
      if (!pool) { pool = []; this.meshPool.set(key, pool); }
      if (pool.length < 12) pool.push(e.mesh);
      e.mesh = null;
    }
    e.active = false;
    e.bite = 0;
    e.gold = false;
    e.kind = '';
    e.def = null;
    if (e.slot >= 0) {
      this.fishDummy.scale.setScalar(0);
      this.fishDummy.updateMatrix();
      this.fishMesh.setMatrixAt(e.slot, this.fishDummy.matrix);
      this.fishMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private deactivate(e: Ent): void {
    if (e.slot >= 0) {
      e.active = false;
      e.bite = 0;
      this.fishDummy.scale.setScalar(0);
      this.fishDummy.updateMatrix();
      this.fishMesh.setMatrixAt(e.slot, this.fishDummy.matrix);
      this.fishMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.release(e);
    }
  }

  private getFree(): Ent | null {
    for (const e of this.ents) if (!e.active) return e;
    return null;
  }

  private getFreeFish(): Ent | null {
    for (let i = 0; i < FISH_MAX; i++) {
      const e = this.fish[(this.fishCursor + i) % FISH_MAX];
      if (!e.active) {
        this.fishCursor = (this.fishCursor + i + 1) % FISH_MAX;
        return e;
      }
    }
    return null;
  }

  private applyGold(e: Ent, on: boolean): void {
    if (!e.mesh || e.def?.kind === 'gem') return;
    e.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshLambertMaterial;
      if (mat && mat.emissive) mat.emissive.setHex(on ? 0x6a4b00 : 0x000000);
    });
  }

  private spawnSchool(n: number, near = false, forceSide = 0): void {
    const zone = zoneAt(this.player.y + rand(-6, 6));
    const side = forceSide || (Math.random() < 0.5 ? -1 : 1);
    const dist = near ? rand(9, 24) : rand(18, 44);
    const bx = clamp(this.player.x + side * dist, -440, 440);
    const by = clamp(this.player.y + rand(-8, 8), zone.bottom + 5, zone.top - 5);
    const id = zone.id === 'surface' ? 'flyingfish' : zone.id === 'reef' ? (Math.random() < 0.7 ? 'sardine' : 'tropical') : 'sardine';
    const def = PREY[id];
    for (let i = 0; i < n; i++) {
      const e = this.getFreeFish();
      if (!e) return;
      e.active = true;
      e.kind = 'fish';
      e.def = def;
      e.x = clamp(bx + rand(-6, 6), -446, 446);
      e.y = clamp(by + rand(-3.5, 3.5), -146, 3);
      e.z = rand(-2, 2);
      e.vx = rand(-1, 1) * def.speed;
      e.vy = rand(-0.4, 0.4);
      e.r = def.radius;
      e.bite = 0;
      e.gold = Math.random() < 0.09;
      e.t = rand(0, 10);
      e.phase = rand(0, Math.PI * 2);
      e.cooldown = 0;
      e.scale = def.radius * (e.gold ? 1.1 : 1);
      this.updateFishSlot(e);
    }
  }

  private spawnRandomMid(near = false): void {
    const zone = zoneAt(this.player.y + rand(-5, 5));
    let id = 'turtle';
    if (zone.id === 'surface') id = Math.random() < 0.5 ? 'pelican' : 'fisherman';
    else if (zone.id === 'reef') id = (['turtle', 'diver', 'manta', 'crab', 'diver'] as const)[Math.floor(Math.random() * 5)];
    else if (zone.id === 'open') id = (['sailfish', 'manta', 'diver'] as const)[Math.floor(Math.random() * 3)];
    else id = (['gulper', 'angler', 'gulper'] as const)[Math.floor(Math.random() * 3)];
    this.spawnPrey(id, undefined, undefined, near);
  }

  private spawnRandomHazard(near = false): void {
    const zone = zoneAt(this.player.y + rand(-5, 5));
    if (zone.id === 'abyss') {
      this.spawnHazard(Math.random() < 0.55 ? 'mine' : 'jelly', near);
    } else if (zone.id === 'open') {
      const r = Math.random();
      this.spawnHazard(r < 0.45 ? 'sub' : r < 0.75 ? 'mine' : 'jelly', near);
    } else {
      this.spawnHazard('jelly', near);
    }
  }

  private spawnPrey(id: string, px?: number, py?: number, near = false): void {
    const def = PREY[id];
    if (!def) return;
    const e = this.getFree();
    if (!e) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const aggressive = id === 'shark' || id === 'gw';
    const x = px ?? clamp(this.player.x + side * (aggressive ? rand(42, 78) : near ? rand(12, 30) : rand(20, 48)), -442, 442);
    const zone = zoneAt(py ?? this.player.y);
    const baseY = py ?? clamp(this.player.y + rand(-12, 12), zone.bottom + 5, zone.top - 5);
    const y = clamp(baseY, -146, 2);
    e.active = true;
    e.kind = id;
    e.def = def;
    e.x = x;
    e.y = y;
    e.z = rand(-3, 3);
    e.vx = rand(-1, 1) * def.speed;
    e.vy = 0;
    e.r = def.radius;
    e.bite = 0;
    e.gold = Math.random() < 0.1;
    e.t = rand(0, 8);
    e.phase = rand(0, Math.PI * 2);
    e.cooldown = 0;
    e.state = '';
    e.life = 0;
    e.homeX = x;
    e.mesh = this.acquireMesh(def);
    const extra = def.kind === 'shark' ? 2.2 : def.kind === 'gw' ? 1.5 : 1;
    e.scale = def.radius * extra;
    e.mesh.position.set(x, y, e.z);
    e.mesh.scale.setScalar(e.scale);
    if (e.gold) this.applyGold(e, true);
  }

  private spawnHazard(kind: string, near = false): void {
    const e = this.getFree();
    if (!e) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const zone = zoneAt(this.player.y);
    const x = clamp(this.player.x + side * (near ? rand(16, 34) : rand(22, 50)), -442, 442);
    const y = clamp(this.player.y + rand(-12, 12), zone.bottom + 4, zone.top - 4);
    e.active = true;
    e.kind = kind;
    e.def = null;
    e.x = x; e.y = y; e.z = rand(-2, 2);
    e.vx = kind === 'sub' ? (Math.random() < 0.5 ? -1 : 1) * 1.8 : 0;
    e.vy = 0;
    e.r = kind === 'sub' ? 2.0 : kind === 'mine' ? 0.9 : 1.0;
    e.bite = 0; e.gold = false; e.t = rand(0, 5); e.phase = rand(0, 6);
    e.cooldown = kind === 'sub' ? rand(1.5, 3) : 0;
    e.life = 0;
    e.state = '';
    e.mesh = this.acquireHazard(kind);
    e.scale = kind === 'sub' ? 0.85 : kind === 'mine' ? 0.9 : 1.1;
    e.mesh.position.set(x, y, e.z);
    e.mesh.scale.setScalar(e.scale);
  }

  setGoldRush(on: boolean): void {
    this.goldRush = on;
    for (const e of this.fish) {
      if (!e.active) continue;
      const col = on || e.gold ? 0xffd35c : (e.def?.color ?? 0xffffff);
      this.fishMesh.setColorAt(e.slot, this.tmpColor.setHex(col));
    }
    if (this.fishMesh.instanceColor) this.fishMesh.instanceColor.needsUpdate = true;
    for (const e of this.ents) {
      if (e.active && e.def) this.applyGold(e, on || e.gold);
    }
  }

  shake(n: number): void {
    this.shakeAmt = Math.min(1.6, this.shakeAmt + n);
  }

  bubble(x: number, y: number): void {
    this.spawnParticle(x + rand(-0.3, 0.3), y + rand(-0.3, 0.3), rand(-1, 1), rand(-0.6, 0.6), rand(0.4, 1.4), 0xbfeaff, rand(0.3, 0.7));
  }

  /** 菜单/结算背景：只跑环境与生物，不做战斗结算 */
  updateAmbientScene(dt: number): void {
    this.time += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6;
      this.maintainPopulation();
    }
    this.updateEntities(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateAmbient(dt);
  }

  private spawnParticle(x: number, y: number, z: number, vx: number, vy: number, color: number, life: number): void {
    const i = this.pCursor;
    this.pCursor = (this.pCursor + 1) % PART_MAX;
    this.pPos[i * 3] = x;
    this.pPos[i * 3 + 1] = y;
    this.pPos[i * 3 + 2] = z;
    this.pVel[i * 2] = vx;
    this.pVel[i * 2 + 1] = vy;
    this.pLife[i] = life;
    this.pMaxLife[i] = life;
    this.tmpColor.setHex(color);
    this.pCol[i * 3] = this.tmpColor.r;
    this.pCol[i * 3 + 1] = this.tmpColor.g;
    this.pCol[i * 3 + 2] = this.tmpColor.b;
  }

  burst(x: number, y: number, color: number, n = 10, spread = 6): void {
    for (let i = 0; i < n; i++) {
      this.spawnParticle(x, y, rand(-2, 2), rand(-spread, spread), rand(-spread, spread), color, rand(0.35, 0.9));
    }
  }

  private spawnRing(): void {
    if (!this.lowQuality) {
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        this.spawnParticle(this.player.x + Math.cos(a) * 2, this.player.y + Math.sin(a) * 2, 0,
          Math.cos(a) * 9, Math.sin(a) * 9, 0xffd35c, 0.6);
      }
    }
  }

  private updateFishSlot(e: Ent): void {
    const d = this.fishDummy;
    d.position.set(e.x, e.y, e.z);
    const ang = Math.atan2(e.vy, e.vx || 1);
    d.rotation.set(0, 0, ang);
    d.scale.setScalar(e.scale);
    d.updateMatrix();
    this.fishMesh.setMatrixAt(e.slot, d.matrix);
    this.fishMesh.instanceMatrix.needsUpdate = true;
    const col = this.goldRush || e.gold ? 0xffd35c : (e.def?.color ?? 0xffffff);
    this.fishMesh.setColorAt(e.slot, this.tmpColor.setHex(col));
    if (this.fishMesh.instanceColor) this.fishMesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    this.time += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.55;
      this.maintainPopulation();
    }

    this.updateEntities(dt);
    this.updateCollectibles(dt);
    this.checkCollisions(dt);
    this.updateBoss(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateAmbient(dt);
    this.boss.hitCd = Math.max(0, this.boss.hitCd - dt);
  }

  private maintainPopulation(): void {
    const zone = zoneAt(this.player.y);
    let fishCount = 0;
    for (const e of this.fish) if (e.active) fishCount++;
    if (fishCount < zone.fish) this.spawnSchool(Math.min(9, 4 + Math.floor(Math.random() * 5)));

    let mid = 0, hazard = 0, big = 0;
    for (const e of this.ents) {
      if (!e.active) continue;
      if (e.kind === 'shark' || e.kind === 'gw') big++;
      else if (!e.def) hazard++;
      else if (e.def.cls >= 3) mid++;
    }
    if (mid < zone.mid) { this.spawnRandomMid(); if (Math.random() < 0.5) this.spawnRandomMid(); }
    if (hazard < zone.hazard) this.spawnRandomHazard();
    if (big < zone.big && Math.random() < 0.5) {
      this.spawnPrey(zone.id === 'abyss' && Math.random() < 0.25 ? 'gw' : 'shark');
    }
  }

  private updateEntities(dt: number): void {
    const p = this.player;
    for (const e of this.ents) {
      if (!e.active) continue;
      e.t += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      const def = e.def;

      if (e.kind === 'missile') {
        e.life -= dt;
        if (e.life <= 0) { this.deactivate(e); continue; }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.mesh) {
          e.mesh.position.set(e.x, e.y, e.z);
          e.mesh.rotation.z = Math.atan2(e.vy, e.vx);
        }
      } else if (def) {
        const flee = p.def && p.def.diet >= def.cls && dist < 14;
        switch (def.kind) {
          case 'fish':
            e.vx += Math.sin(e.t * 2 + e.phase) * 2.4 * dt;
            e.vy += Math.cos(e.t * 2.6 + e.phase) * 1.6 * dt;
            if (flee) { e.vx += (dx / (dist || 1)) * 16 * dt * 3; e.vy += (dy / (dist || 1)) * 16 * dt * 3; }
            break;
          case 'crab':
            e.vy += (-146 - e.y) * 1.5 * dt;
            e.vx += Math.sin(e.t * 0.8 + e.phase) * 2 * dt;
            break;
          case 'turtle':
            e.vy = Math.sin(e.t * 0.8 + e.phase) * 0.5;
            if (flee) e.vx += Math.sign(-dx || 1) * 4 * dt;
            break;
          case 'pelican':
            e.y += Math.sin(e.t * 1.4 + e.phase) * 0.9 * dt;
            if (flee) { e.vx += (dx / (dist || 1)) * 18 * dt; e.vy += (dy / (dist || 1)) * 14 * dt + 6 * dt; }
            break;
          case 'fisher':
            if (dist < 16 && e.state === 'boat') { e.state = 'swim'; e.vy = -2.5; }
            if (e.state === 'swim') {
              e.vy -= 1.2 * dt;
              e.vx += (dx / (dist || 1)) * -3 * dt;
              if (e.y < -30) e.y = -30;
            } else {
              e.x = e.homeX + Math.sin(e.t * 0.7) * 2;
              e.y += Math.sin(e.t * 1.3) * 0.2 * dt;
            }
            break;
          case 'diver':
            if (flee) { e.vx += (dx / (dist || 1)) * 10 * dt; e.vy += (dy / (dist || 1)) * 10 * dt; }
            else e.vy = Math.sin(e.t * 1.2 + e.phase) * 1.5;
            break;
          case 'manta':
            e.vy = Math.sin(e.t * 0.7 + e.phase) * 1.6;
            e.vx += Math.sin(e.t * 0.31 + e.phase) * 1.2 * dt;
            break;
          case 'sailfish':
            if (Math.abs(e.x - p.x) > 90) e.vx = -e.vx;
            break;
          case 'gulper':
          case 'angler':
            e.vy = Math.sin(e.t * 0.6 + e.phase) * 0.7;
            if (dist < 16 && p.def.diet >= def.cls) {
              e.vx += (dx / (dist || 1)) * 6 * dt;
              e.vy += (dy / (dist || 1)) * 6 * dt;
            }
            break;
          case 'shark':
          case 'gw': {
            const aggro = this.time > 6 && dist < 42;
            if (aggro) {
              e.vx += (dx / (dist || 1)) * 18 * dt;
              e.vy += (dy / (dist || 1)) * 18 * dt;
            } else {
              e.vx += Math.sin(e.t * 0.4 + e.phase) * 3 * dt;
            }
            break;
          }
          default: break;
        }

        if (def.kind !== 'fisher' || e.state === 'swim') {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }
        const maxSp = def.speed * (e.gold ? 1.35 : 1) * 1.7;
        const sp = Math.hypot(e.vx, e.vy);
        if (sp > maxSp) { e.vx *= maxSp / sp; e.vy *= maxSp / sp; }
        if (def.kind !== 'fish' && def.kind !== 'fisher') {
          e.vx *= 1 - 1.2 * dt;
          e.vy *= 1 - 1.2 * dt;
        }
        if (def.kind === 'crab' || def.kind === 'angler') e.y = Math.max(e.y, -147);
        if (e.y < -148) e.y = -148;
        if (e.y > 4) e.y = 4;
        if (e.x < -446) e.x = -446;
        if (e.x > 446) e.x = 446;

        if (e.mesh) {
          e.mesh.position.set(e.x, e.y, e.z);
          const ang = Math.atan2(e.vy, e.vx || 0.001);
          if (def.kind === 'shark' || def.kind === 'gw') e.mesh.rotation.z = ang;
          else if (def.kind === 'fish' || def.kind === 'sailfish' || def.kind === 'gem') e.mesh.rotation.z = ang;
          const bob = 1 + Math.sin(e.t * 3 + e.phase) * 0.03;
          e.mesh.scale.setScalar(e.scale * bob);
        }
      } else {
        switch (e.kind) {
          case 'jelly':
            e.y += Math.sin(e.t * 1.1 + e.phase) * 0.9 * dt;
            e.x += Math.cos(e.t * 0.5 + e.phase) * 0.4 * dt;
            break;
          case 'mine':
            e.y += Math.sin(e.t * 1.6 + e.phase) * 0.25 * dt;
            break;
          case 'sub': {
            if (e.x < -420 || e.x > 420) e.vx = -e.vx;
            e.x += e.vx * dt;
            e.y += Math.sin(e.t * 0.6 + e.phase) * 0.5 * dt;
            e.cooldown -= dt;
            if (e.cooldown <= 0 && dist < 46) {
              e.cooldown = rand(3.2, 5);
              this.fireMissile(e);
            }
            break;
          }
          default: break;
        }
        if (e.mesh) {
          e.mesh.position.set(e.x, e.y, e.z);
          if (e.kind === 'jelly') {
            e.mesh.scale.setScalar(e.scale * (1 + Math.sin(e.t * 2.4) * 0.08));
          } else if (e.kind === 'mine') {
            e.mesh.rotation.z += dt * 0.5;
          } else if (e.kind === 'sub') {
            e.mesh.rotation.z = Math.atan2(e.vy, e.vx) * 0.15;
            e.mesh.scale.setScalar(e.scale * (1 + Math.sin(e.t * 4) * 0.01));
          }
        }
      }

      if (e.kind !== 'fisher' && Math.abs(e.x - p.x) > 125) { this.deactivate(e); continue; }
      if (Math.abs(e.y - p.y) > 85) { this.deactivate(e); continue; }
    }

    for (const e of this.fish) {
      if (!e.active || !e.def) continue;
      e.t += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      e.vx += Math.sin(e.t * 2 + e.phase) * 2.2 * dt;
      e.vy += Math.cos(e.t * 2.4 + e.phase) * 1.4 * dt;
      if (p.def && p.def.diet >= 1 && dist < 9) {
        e.vx += (dx / (dist || 1)) * 2.2 * dt * 4;
        e.vy += (dy / (dist || 1)) * 2.2 * dt * 4;
      }
      const maxSp = e.def.speed * (e.gold ? 1.4 : 1) * 1.5;
      const sp = Math.hypot(e.vx, e.vy);
      if (sp > maxSp) { e.vx *= maxSp / sp; e.vy *= maxSp / sp; }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < -446) e.x = -446;
      if (e.x > 446) e.x = 446;
      if (e.y < -147) e.y = -147;
      if (e.y > 3) e.y = 3;
      this.updateFishSlot(e);
      if (Math.abs(e.x - p.x) > 115 || Math.abs(e.y - p.y) > 70) this.deactivate(e);
    }
  }

  private fireMissile(from: Ent): void {
    const e = this.getFree();
    if (!e) return;
    const p = this.player;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    e.active = true;
    e.kind = 'missile';
    e.def = null;
    e.x = from.x; e.y = from.y; e.z = 1;
    e.vx = (dx / d) * 12;
    e.vy = (dy / d) * 12;
    e.r = 0.5;
    e.life = 4;
    e.gold = false;
    e.bite = 0;
    e.t = 0;
    e.mesh = this.acquireHazard('missile');
    e.scale = 1;
    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.scale.setScalar(1);
    this.bus.emit('sfx', 'missile');
  }

  private updateCollectibles(dt: number): void {
    const p = this.player;
    for (const c of this.collectibles) {
      if (!c.active) continue;
      c.t += dt;
      if (c.mesh) {
        c.mesh.position.y = c.y + Math.sin(c.t * 1.6) * 0.18;
        c.mesh.rotation.y += dt * 0.9;
      }
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      if (dx * dx + dy * dy < (p.radius + 1.1) * (p.radius + 1.1)) {
        c.active = false;
        if (c.mesh) this.scene.remove(c.mesh);
        if (c.kind === 'shell') {
          this.bus.emit('world:pickup', { kind: 'shell', coins: 25 });
        } else {
          this.bus.emit('world:pickup', { kind: 'object', coins: 60 });
        }
        this.burst(c.x, c.y, 0xffd35c, 10, 5);
      }
    }
  }

  private checkCollisions(dt: number): void {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.ents) {
      if (!e.active) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.r + p.radius + (e.def ? 0.85 : 0);
      if (dx * dx + dy * dy > rr * rr) continue;

      if (e.kind === 'missile') {
        p.takeDamage(25, 'missile');
        this.deactivate(e);
        continue;
      }

      if (e.def) {
        const def = e.def;
        if (p.goldRush || p.def.diet >= def.cls) {
          if (e.bite === 0) this.bus.emit('sfx', 'bite');
          e.bite += dt * p.bitePower;
          if (e.bite >= def.biteTime) this.eatEntity(e, def);
        } else {
          const dmg = def.kind === 'gw' ? 32 : def.kind === 'shark' ? 20 : 8;
          if (p.takeDamage(dmg, 'prey')) {
            this.burst(e.x, e.y, 0x6a1414, 8, 4);
            this.shake(0.25);
          }
        }
        continue;
      }

      switch (e.kind) {
        case 'jelly':
          if (!p.def.immunePoison) {
            if (p.takeDamage(8, 'jelly')) {
              p.addPoison(3);
              this.bus.emit('sfx', 'jelly');
              this.burst(e.x, e.y, 0xb27de8, 8, 3);
            }
          }
          break;
        case 'mine':
          if (p.goldRush) {
            this.deactivate(e);
            this.bus.emit('world:stat', { stat: 'mine' });
            this.burst(e.x, e.y, 0xffd35c, 12, 6);
          } else if (p.takeDamage(35, 'mine')) {
            this.bus.emit('sfx', 'mine');
            this.deactivate(e);
            this.bus.emit('world:stat', { stat: 'mine' });
            this.burst(e.x, e.y, 0xff8a3c, 22, 10);
            this.shake(0.9);
          }
          break;
        case 'sub':
          if (p.boosting && p.def.diet >= 4) {
            this.deactivate(e);
            this.bus.emit('world:stat', { stat: 'sub' });
            this.bus.emit('world:coin', { amount: 80 });
            this.bus.emit('sfx', 'mine');
            this.burst(e.x, e.y, 0xffb648, 18, 9);
            this.shake(0.7);
          } else if (p.takeDamage(22, 'sub')) {
            this.bus.emit('sfx', 'damage');
            this.shake(0.4);
          }
          break;
        case 'shark':
        case 'gw':
          break;
        default:
          break;
      }
    }

    // 实例化鱼群也参与捕食判定
    for (const e of this.fish) {
      if (!e.active || !e.def) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.r + p.radius + 0.85;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (p.goldRush || p.def.diet >= e.def.cls) {
        if (e.bite === 0) this.bus.emit('sfx', 'bite');
        e.bite += dt * p.bitePower;
        if (e.bite >= e.def.biteTime) this.eatEntity(e, e.def);
      }
    }
  }

  private eatEntity(e: Ent, def: PreyDef): void {
    const p = this.player;
    const wasGold = e.gold || this.goldRush;
    const coins = wasGold ? (e.gold ? 8 + Math.floor(def.score * 0.05) : 2 + Math.floor(Math.random() * 5)) : 0;
    p.onEat(def, wasGold);
    this.bus.emit('world:eat', { def, gold: wasGold, coins, kind: e.kind });
    this.bus.emit('sfx', 'gulp');
    this.burst(e.x, e.y, e.kind === 'gem' ? 0x7ef2c8 : 0x7a1414, 10, 4);
    this.deactivate(e);
  }

  private updateBoss(dt: number): void {
    const p = this.player;
    const b = this.boss;
    if (!b.mesh) return;
    if (this.bossDefeated) return;

    if (!this.bossActive) {
      if (p.x < -382) {
        this.bossActive = true;
        b.state = 'idle';
        b.timer = 1.8;
        this.bus.emit('boss:start');
        this.bus.emit('sfx', 'boss');
        this.shake(0.6);
      }
      return;
    }

    const clawR = b.mesh.userData.clawR as THREE.Group;
    const clawL = b.mesh.userData.clawL as THREE.Group;
    const weak = b.mesh.userData.weak as THREE.Mesh;
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    b.timer -= dt;
    b.vuln = Math.max(0, b.vuln - dt);

    let clawAngle = 0;
    if (b.state === 'telegraph') clawAngle = -0.4 * (1 - Math.max(0, b.timer) / 0.7);
    if (b.state === 'strike') clawAngle = 0.9;
    clawR.rotation.z = clawAngle;
    clawL.rotation.z = -clawAngle;

    const weakMat = weak.material as THREE.MeshBasicMaterial;
    weakMat.opacity = b.vuln > 0 ? 0.55 + Math.sin(this.time * 12) * 0.3 : 0;

    switch (b.state) {
      case 'idle':
        if (b.timer <= 0) {
          b.state = 'telegraph';
          b.timer = 0.7;
          this.bus.emit('sfx', 'boss');
        }
        break;
      case 'telegraph':
        if (b.timer <= 0) {
          b.state = 'strike';
          b.timer = 0.25;
          const hit = dist < 26 && Math.abs(p.y - b.y) < 18;
          if (hit) {
            p.takeDamage(28, 'crab');
            this.burst(p.x, p.y, 0x6a1414, 14, 6);
            this.shake(1);
          } else {
            b.dodge++;
            this.bus.emit('boss:dodge', { count: b.dodge });
          }
        }
        break;
      case 'strike':
        if (b.timer <= 0) {
          if (b.dodge >= 3) {
            b.state = 'vulnerable';
            b.vuln = 4;
            b.timer = 4;
            b.dodge = 0;
            this.bus.emit('boss:vulnerable');
          } else {
            b.state = 'idle';
            b.timer = 1.5;
          }
        }
        break;
      case 'vulnerable':
        if (p.boosting && dist < b.r + p.radius + 3) {
          b.phase--;
          b.vuln = 0;
          b.state = 'idle';
          b.timer = 1.2;
          this.bus.emit('boss:hp', { phase: b.phase });
          this.bus.emit('sfx', 'bosshit');
          this.shake(1.4);
          this.burst(b.x, b.y, 0xff8a3c, 26, 12);
          if (b.phase <= 0) this.defeatBoss();
        } else if (b.timer <= 0) {
          b.state = 'idle';
          b.timer = 1.5;
        }
        break;
      default:
        break;
    }

    if (b.state !== 'vulnerable' && dist < b.r + p.radius && b.hitCd <= 0) {
      if (p.takeDamage(18, 'crab')) {
        b.hitCd = 1;
        this.burst(p.x, p.y, 0x6a1414, 8, 4);
        this.shake(0.5);
      }
    }
  }

  private defeatBoss(): void {
    this.bossDefeated = true;
    this.bossActive = false;
    const b = this.boss;
    if (b.mesh) {
      const weak = b.mesh.userData.weak as THREE.Mesh;
      (weak.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    this.bus.emit('boss:dead');
    this.bus.emit('sfx', 'goldrush');
    this.burst(b.x, b.y, 0xffd35c, 40, 18);
    this.shake(1.6);
  }

  private updateParticles(dt: number): void {
    const pos = this.pPos;
    const col = this.pCol;
    for (let i = 0; i < PART_MAX; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        pos[i * 3 + 1] = -9999;
        continue;
      }
      pos[i * 3] += this.pVel[i * 2] * dt;
      pos[i * 3 + 1] += this.pVel[i * 2 + 1] * dt;
      this.pVel[i * 2] *= 1 - 1.6 * dt;
      this.pVel[i * 2 + 1] *= 1 - 1.6 * dt;
      const f = this.pLife[i] / this.pMaxLife[i];
      col[i * 3] *= 1 - 0.7 * dt;
      col[i * 3 + 1] *= 1 - 0.7 * dt;
      col[i * 3 + 2] *= 1 - 0.7 * dt;
      if (f < 0.05) pos[i * 3 + 1] = -9999;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;
  }

  private updateCamera(dt: number): void {
    const p = this.player;
    let tx: number;
    let ty: number;
    let tz: number;
    if (this.bossActive && !this.bossDefeated) {
      tx = (p.x + this.boss.x) / 2;
      ty = (p.y + this.boss.y) / 2 - 2;
      tz = 38;
    } else {
      tx = p.x + clamp(p.vx * 0.36, -6, 6);
      ty = p.y + 2.6 + clamp(p.vy * 0.12, -2, 2);
      tz = 18 + (p.boosting ? 1.6 : 0);
    }
    const k = Math.min(1, dt * 5.2);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camZ += (tz - this.camZ) * Math.min(1, dt * 2.6);

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.4);
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    this.camera.position.set(this.camX + sx, this.camY + sy, this.camZ);
    if (this.bossActive && !this.bossDefeated) {
      this.camera.lookAt(this.camX, this.camY - 1.0, 0);
    } else {
      this.camera.lookAt(this.camX + 2.0, this.camY - 1.0, 0);
    }

    const zone = zoneAt(this.camY);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.lerp(this.tmpColor.setHex(zone.fog), Math.min(1, dt * 1.6));
    fog.density += (zone.density - fog.density) * Math.min(1, dt * 1.6);
    this.renderer.setClearColor(fog.color);
    this.lamp.color.lerp(this.tmpColor.setHex(zone.amb), Math.min(1, dt * 1.6));
    this.lamp.intensity = zone.id === 'abyss' ? 0.55 : zone.id === 'open' ? 0.9 : 1.25;

    const fov = 52 + (p.boosting ? 5 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.1) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateAmbient(dt: number): void {
    this.bgUniforms.uTime.value = this.time;
    this.bgUniforms.uSunX.value = this.camX * 0.4;
    const t = this.time;
    for (let i = 0; i < this.shafts.length; i++) {
      const s = this.shafts[i];
      const mat = s.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.035 * (0.85 + Math.sin(t * 0.4 + i) * 0.15);
      s.position.x += Math.sin(t * 0.1 + i) * 0.02;
    }

    for (let i = 0; i < 400; i++) {
      let x = this.snowPos[i * 3];
      let y = this.snowPos[i * 3 + 1];
      const z = this.snowPos[i * 3 + 2];
      x += 0.55 * dt;
      y -= 0.35 * dt;
      if (x - this.camX > 70) x -= 140;
      if (x - this.camX < -70) x += 140;
      if (y - this.camY > 45) y -= 90;
      if (y - this.camY < -45) y += 90;
      this.snowPos[i * 3] = x;
      this.snowPos[i * 3 + 1] = y;
      this.snowPos[i * 3 + 2] = z;
    }
    this.snowGeo.attributes.position.needsUpdate = true;

    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = 0.22;
      const bx = this.camX + rand(-26, 26);
      const by = this.camY + rand(-13, -2);
      this.spawnParticle(bx, by, rand(-4, -1), rand(-0.2, 0.2), rand(0.6, 1.5), 0xcdefff, rand(1.2, 2.2));
    }
  }

  resize = (): void => {
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowQuality ? 1.25 : 2));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  setLowQuality(): void {
    this.lowQuality = true;
    for (const s of this.shafts) s.visible = false;
    this.resize();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  bossPhase(): number {
    return this.boss.phase;
  }

  bossState(): string {
    return this.boss.state;
  }

  bossDodge(): number {
    return this.boss.dodge;
  }

  debugVisuals(): string[] {
    const out: string[] = [];
    this.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      const sprite = o as THREE.Sprite;
      if (!mesh.isMesh && !sprite.isSprite) return;
      const mat = mesh.material as THREE.Material | undefined;
      if (!mat) return;
      if (!mat.transparent && mat.blending !== THREE.AdditiveBlending) return;
      const geo = (mesh.geometry as THREE.BufferGeometry | undefined)?.type ?? 'sprite';
      out.push(`${o.type}:${geo} p=${o.position.x.toFixed(0)},${o.position.y.toFixed(0)},${o.position.z.toFixed(0)} s=${o.scale.x.toFixed(1)},${o.scale.y.toFixed(1)} o=${mat.opacity.toFixed(2)}`);
    });
    return out;
  }

  /** 仅调试用：在指定位置生成一小群鱼 */
  spawnTestFish(x: number, y: number, n = 8): void {
    const def = PREY.sardine;
    for (let i = 0; i < n; i++) {
      const e = this.getFreeFish();
      if (!e) return;
      e.active = true;
      e.kind = 'fish';
      e.def = def;
      e.x = x + rand(-2, 2);
      e.y = y + rand(-1.5, 1.5);
      e.z = rand(-1, 1);
      e.vx = 0;
      e.vy = 0;
      e.r = def.radius;
      e.bite = 0;
      e.gold = i === 0;
      e.t = rand(0, 5);
      e.phase = rand(0, 6);
      e.scale = def.radius * (e.gold ? 1.1 : 1);
      this.updateFishSlot(e);
    }
  }

  /** 供 UI 读取的调试/状态值 */
  get debug(): { fish: number; ents: number; calls: number } {
    let f = 0, e = 0;
    for (const x of this.fish) if (x.active) f++;
    for (const x of this.ents) if (x.active) e++;
    return { fish: f, ents: e, calls: this.renderer.info.render.calls };
  }
}

import * as THREE from 'three';
import type { SharkDef, PreyDef } from './data';
import type { UpgradeSet } from './state';
import { totalSpeed, totalBite, boostRegen } from './state';
import { createSharkMesh } from './mesh';
import type { Bus } from './bus';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export class Player {
  def!: SharkDef;
  level = 1;
  x = 0;
  y = -26;
  vx = 0;
  vy = 0;
  hp = 100;
  maxHp = 100;
  boost = 100;
  boosting = false;
  heading = 0;
  invuln = 0;
  poison = 0;
  poisonTick = 0;
  hungerCd = 0;
  boostCd = 0;
  alive = true;
  goldRush = false;
  runScore = 0;
  boostDistance = 0;
  speedStat = 9;
  bitePower = 1;
  boostMul = 1.55;
  regen = 17;
  radius = 0.8;
  sizeMul = 1;
  pulse = 0;
  group!: THREE.Group;

  private bus: Bus;
  private t = 0;
  private upgrades: UpgradeSet = { bite: 0, speed: 0, boost: 0 };

  constructor(scene: THREE.Scene, bus: Bus) {
    this.bus = bus;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  reset(def: SharkDef, level: number, upgrades: UpgradeSet): void {
    this.def = def;
    this.level = level;
    this.upgrades = upgrades;
    this.x = 0;
    this.y = -26;
    this.vx = 0;
    this.vy = 0;
    this.maxHp = def.hp + (level - 1) * 8;
    this.hp = this.maxHp;
    this.boost = 100;
    this.boosting = false;
    this.heading = 0;
    this.invuln = 2.5;
    this.poison = 0;
    this.alive = true;
    this.goldRush = false;
    this.runScore = 0;
    this.boostDistance = 0;
    this.sizeMul = 1;
    this.pulse = 0;
    this.speedStat = totalSpeed(def.speed, upgrades.speed, level);
    this.bitePower = totalBite(def.bite, upgrades.bite);
    this.boostMul = def.boostMul;
    this.regen = boostRegen(upgrades.boost);

    this.group.clear();
    const mesh = createSharkMesh(def);
    this.group.add(mesh);
    this.group.add(this.makeGlow());
    this.group.rotation.set(0, 0, 0);
    this.group.position.set(this.x, this.y, 0);
    this.updateScale();
  }

  private makeGlow(): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(190,250,255,0.9)');
    grd.addColorStop(0.45, 'rgba(120,230,255,0.28)');
    grd.addColorStop(1, 'rgba(80,200,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({
      map: tex, color: 0xbfefff, transparent: true, opacity: 0.22,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(2.2);
    sprite.position.z = -0.2;
    return sprite;
  }

  private get levelScale(): number {
    return 1 + 0.035 * (this.level - 1);
  }

  private updateScale(): void {
    const grow = 1 + Math.min(0.28, this.runScore * 0.00004);
    this.sizeMul = this.levelScale * grow;
    const s = this.def.length * this.sizeMul * (1 + this.pulse);
    this.group.scale.setScalar(s);
    this.radius = this.def.length * 0.21 * this.sizeMul;
  }

  update(dt: number, dir: THREE.Vector2, wantBoost: boolean): void {
    if (!this.alive) return;
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.pulse = Math.max(0, this.pulse - dt * 0.4);

    const depth = -this.y;
    if (depth > this.def.depth) {
      this.hp -= 6 * dt;
      if (this.hp <= 0) this.die();
    }

    // 饥饿与中毒
    const hunger = 1.0 + depth * 0.004 + (this.sizeMul - 1) * 1.6;
    this.hp -= hunger * dt;
    if (this.poison > 0) {
      this.poison -= dt;
      this.poisonTick += dt;
      if (this.poisonTick >= 0.5) {
        this.poisonTick -= 0.5;
        this.hp -= 1.5;
      }
    }
    if (this.hp <= 0) this.die();
    if (!this.alive) return;

    // 冲刺
    const canBoost = wantBoost && (this.goldRush || this.boost > 1);
    this.boosting = canBoost;
    if (canBoost && !this.goldRush) {
      this.boost = Math.max(0, this.boost - 46 * dt);
      this.boostCd = 0.45;
    } else {
      if (this.goldRush) this.boost = 100;
      this.boostCd = Math.max(0, this.boostCd - dt);
      if (this.boostCd <= 0) this.boost = Math.min(100, this.boost + this.regen * dt);
    }

    // 运动
    const hasInput = dir.lengthSq() > 0.0001;
    const accel = (this.boosting ? 78 : 52) * (this.goldRush ? 1.08 : 1);
    this.vx += dir.x * accel * dt;
    this.vy += dir.y * accel * dt;

    const drag = hasInput ? 0.85 : 2.6;
    const damp = 1 / (1 + drag * dt);
    this.vx *= damp;
    this.vy *= damp;

    const baseSpeed = this.speedStat * (this.boosting ? this.boostMul : 1);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > baseSpeed) {
      const k = baseSpeed / sp;
      this.vx *= k;
      this.vy *= k;
    }

    if (this.y > -1) {
      this.vy -= 16 * dt;
      this.vx *= 1 - 0.4 * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -448) { this.x = -448; this.vx = Math.abs(this.vx) * 0.2; }
    if (this.x > 448) { this.x = 448; this.vx = -Math.abs(this.vx) * 0.2; }
    if (this.y < -148) { this.y = -148; this.vy = Math.abs(this.vy) * 0.2; }
    if (this.y > 5.5) { this.y = 5.5; this.vy = Math.min(0, this.vy); }

    if (this.boosting) this.boostDistance += Math.hypot(this.vx, this.vy) * dt;

    if (sp > 0.6) {
      const target = Math.atan2(this.vy, this.vx);
      let diff = target - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 10);
    }

    this.group.position.set(this.x, this.y, 0);
    this.group.rotation.z = this.heading;
    const tail = this.group.children[0]?.userData?.tail as THREE.Group | undefined;
    if (tail) {
      const speedFactor = clamp(sp / Math.max(1, this.speedStat), 0.2, 1.6);
      tail.rotation.z = Math.sin(this.t * (6 + speedFactor * 8)) * (0.18 + speedFactor * 0.22);
    }
    if (this.boosting && Math.random() < dt * 22) {
      this.bus.emit('fx:bubble', { x: this.x - Math.cos(this.heading) * this.radius, y: this.y - Math.sin(this.heading) * this.radius });
    }
    this.updateScale();
  }

  takeDamage(n: number, source: string): boolean {
    if (!this.alive) return false;
    if (this.goldRush) return false;
    if (this.invuln > 0) return false;
    this.hp -= n;
    this.invuln = 0.65;
    this.bus.emit('player:damage', { amount: n, source });
    if (this.hp <= 0) this.die();
    return true;
  }

  addPoison(seconds: number): void {
    if (this.def?.immunePoison) return;
    this.poison = Math.max(this.poison, seconds);
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  setLevel(level: number): void {
    this.level = level;
    const newMax = this.def.hp + (level - 1) * 8;
    const diff = newMax - this.maxHp;
    this.maxHp = newMax;
    this.hp = Math.min(newMax, this.hp + Math.max(0, diff) + newMax * 0.15);
    this.speedStat = totalSpeed(this.def.speed, this.upgrades.speed, level);
    this.bitePower = totalBite(this.def.bite, this.upgrades.bite);
    this.regen = boostRegen(this.upgrades.boost);
    this.updateScale();
  }

  onEat(def: PreyDef, gold: boolean): void {
    this.heal(def.heal);
    this.runScore += def.score * (gold ? 3 : 1);
    this.pulse = 0.035;
    this.bus.emit('player:eat', { def, gold });
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.boosting = false;
    this.bus.emit('player:death');
  }

  revive(): void {
    this.alive = true;
    this.hp = this.maxHp * 0.5;
    this.invuln = 2.0;
    this.poison = 0;
    this.boost = 60;
  }

  get depth(): number {
    return Math.max(0, -this.y);
  }
}

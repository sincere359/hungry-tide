import { Vector2 } from 'three';

const MAX_RADIUS = 56;
const DEAD_ZONE = 8;

export class Input {
  readonly dir = new Vector2();
  enabled = false;
  onFirstGesture: (() => void) | null = null;

  private joyId: number | null = null;
  private ox = 0;
  private oy = 0;
  private cx = 0;
  private cy = 0;
  private boostPointers = new Set<number>();
  private boostButtonDown = false;
  private joyEl: HTMLElement | null = null;
  private knobEl: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;

  get boost(): boolean {
    return this.enabled && (this.boostButtonDown || this.boostPointers.size > 0);
  }

  get joyActive(): boolean { return this.joyId !== null; }

  attach(canvas: HTMLCanvasElement, joyEl: HTMLElement, knobEl: HTMLElement, boostBtn: HTMLElement): void {
    this.canvas = canvas;
    this.joyEl = joyEl;
    this.knobEl = knobEl;

    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', this.reset);

    boostBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!this.enabled) return;
      this.boostButtonDown = true;
      this.fireGesture();
      try { boostBtn.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    });
    const up = () => { this.boostButtonDown = false; };
    boostBtn.addEventListener('pointerup', up);
    boostBtn.addEventListener('pointercancel', up);
    boostBtn.addEventListener('pointerleave', up);
  }

  private fireGesture(): void {
    if (this.onFirstGesture) {
      const cb = this.onFirstGesture;
      this.onFirstGesture = null;
      cb();
    }
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.fireGesture();
    if (this.joyId === null) {
      this.joyId = e.pointerId;
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.cx = e.clientX;
      this.cy = e.clientY;
      if (this.joyEl && this.knobEl) {
        this.joyEl.classList.remove('hidden');
        this.joyEl.style.left = `${this.ox}px`;
        this.joyEl.style.top = `${this.oy}px`;
        this.knobEl.style.transform = 'translate(-50%, -50%)';
      }
    } else {
      this.boostPointers.add(e.pointerId);
    }
    this.updateDir();
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.joyId) return;
    e.preventDefault();
    this.cx = e.clientX;
    this.cy = e.clientY;
    this.updateDir();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.dir.set(0, 0);
      this.joyEl?.classList.add('hidden');
    }
    this.boostPointers.delete(e.pointerId);
    if (e.pointerId === undefined) this.boostButtonDown = false;
  };

  private updateDir(): void {
    let dx = this.cx - this.ox;
    let dy = this.cy - this.oy;
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) {
      this.dir.set(0, 0);
    } else {
      const scale = Math.min(1, (len - DEAD_ZONE) / (MAX_RADIUS - DEAD_ZONE));
      this.dir.set((dx / len) * scale, -(dy / len) * scale);
    }
    if (this.knobEl) {
      const kx = len > MAX_RADIUS ? (dx / len) * MAX_RADIUS : dx;
      const ky = len > MAX_RADIUS ? (dy / len) * MAX_RADIUS : dy;
      this.knobEl.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    }
  }

  reset = (): void => {
    this.joyId = null;
    this.dir.set(0, 0);
    this.boostPointers.clear();
    this.boostButtonDown = false;
    this.joyEl?.classList.add('hidden');
  };

  pressBoostButton(down: boolean): void {
    this.boostButtonDown = down;
  }
}

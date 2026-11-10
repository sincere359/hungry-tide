export type Handler = (payload?: unknown) => void;

export class Bus {
  private map = new Map<string, Set<Handler>>();

  on(type: string, fn: Handler): () => void {
    let set = this.map.get(type);
    if (!set) {
      set = new Set();
      this.map.set(type, set);
    }
    set.add(fn);
    return () => set?.delete(fn);
  }

  emit(type: string, payload?: unknown): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  clear(): void {
    this.map.clear();
  }
}

export const HOLD_MS = 700;
export class HoldGesture {
  private keys = new Set<0 | 1>();
  private pending: { side: 0 | 1; start: number } | null = null;
  down(side: 0 | 1, repeat: boolean, now: number, enabled: boolean) {
    if (repeat || this.keys.has(side)) return;
    this.keys.add(side);
    this.pending =
      enabled && this.keys.size === 1 ? { side, start: now } : null;
  }
  up(side: 0 | 1) {
    this.keys.delete(side);
    if (this.pending?.side === side) this.pending = null;
  }
  cancel(clearKeys = false) {
    this.pending = null;
    if (clearKeys) this.keys.clear();
  }
  get side() {
    return this.pending?.side ?? null;
  }
  progress(now: number) {
    return this.pending ? Math.min(1, (now - this.pending.start) / HOLD_MS) : 0;
  }
  finish(now: number) {
    if (!this.pending || this.progress(now) < 1) return null;
    const side = this.pending.side;
    this.pending = null;
    return side;
  }
}

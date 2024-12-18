const SAMPLE_SIZE = 5;
const DELTA_THRESHOLD = 1;
const TIMING_TOLERANCE_MS = 50;

interface SavedWheelEvent {
  time: number;
  delta: number;
  deltaMode: number;
}

export class MomentumScrollDetector {
  private wheelEvents: SavedWheelEvent[] = [];

  constructor() {
    window.addEventListener('wheel', this.handleWheel, { passive: true });
  }

  destroy() {
    window.removeEventListener('wheel', this.handleWheel);
  }

  handleWheel = (e: WheelEvent) => {
    const now = Date.now();
    this.addEvent({
      time: now,
      delta: Math.abs(e.deltaY),
      deltaMode: e.deltaMode,
    });
  };

  addEvent(event: SavedWheelEvent) {
    this.wheelEvents.push(event);
    while (this.wheelEvents.length > SAMPLE_SIZE) {
      this.wheelEvents.shift();
    }
  }

  hasMomentumScroll() {
    if (this.wheelEvents.length < SAMPLE_SIZE) return false;

    const hasSmoothing = this.wheelEvents.every((event, i, events) => {
      if (i === 0) return true;
      return event.delta <= events[i - 1].delta * DELTA_THRESHOLD;
    });

    const hasConsistentTiming = this.wheelEvents.every((event, i, events) => {
      if (i === 0) return true;
      const timeDelta = event.time - events[i - 1].time;
      return timeDelta < TIMING_TOLERANCE_MS;
    });

    return hasSmoothing && hasConsistentTiming;
  }
}

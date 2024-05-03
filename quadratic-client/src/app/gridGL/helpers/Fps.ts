const TOLERANCE = 1;
const EXPECTED = [60, 120];

export class FPS {
  private lastTime = 0;
  private frameNumber = 0;
  private lastFPS = 0;

  // from https://github.com/davidfig/fps/blob/master/fps.ts
  update(): void {
    const span = document.querySelector('.debug-show-FPS') as HTMLSpanElement;
    if (!span) return;

    this.frameNumber++;
    const currentTime = performance.now() - this.lastTime;

    // skip large differences to remove garbage
    if (currentTime > 500) {
      if (this.lastTime !== 0) {
        const lastFPS = Math.floor(this.frameNumber / (currentTime / 1000));
        const expected = EXPECTED.find((expect) => Math.abs(expect - lastFPS) < TOLERANCE);
        if (expected) {
          this.lastFPS = expected;
        } else if (Math.abs(lastFPS - this.lastFPS) > TOLERANCE) {
          this.lastFPS = lastFPS;
        }
      }
      this.lastTime = performance.now();
      this.frameNumber = 0;
    }
    span.innerText = this.lastFPS === 0 ? '--' : this.lastFPS + '';
  }
}

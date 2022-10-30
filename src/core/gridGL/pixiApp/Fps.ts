const MAX_FPS = 60;
const TOLERANCE = 0;

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
        this.lastFPS = Math.floor(this.frameNumber / (currentTime / 1000));
        if (this.lastFPS > MAX_FPS || (this.lastFPS >= MAX_FPS - TOLERANCE && this.lastFPS <= MAX_FPS + TOLERANCE)) {
          this.lastFPS = MAX_FPS;
        }
      }
      this.lastTime = performance.now();
      this.frameNumber = 0;
    }
    span.innerText = this.lastFPS === 0 ? '--' : this.lastFPS + '';
  }
}

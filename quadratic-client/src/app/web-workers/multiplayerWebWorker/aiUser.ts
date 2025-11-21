import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsSelection } from '@/app/quadratic-core/quadratic_core';
import { multiplayer } from './multiplayer';

const AI_SESSION_ID = 'ai-analyst';
const ANIMATION_DURATION = 250; // milliseconds
const EASING = (t: number) => {
  // cubic-bezier(0.17, 0.93, 0.38, 1) approximation
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

interface AnimationState {
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  startTime: number;
  animationFrameId?: number;
}

class AIUser {
  private animationState?: AnimationState;

  /**
   * Smoothly animates the AI cursor to a target position.
   * Updates player.x and player.y directly during animation.
   */
  animateToPosition(targetX: number, targetY: number): void {
    const player = multiplayer.users.get(AI_SESSION_ID);
    if (!player) return;

    // Cancel any existing animation
    if (this.animationState?.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationState.animationFrameId);
    }

    // Use current position as start, or target if no current position
    const startX = player.x ?? targetX;
    const startY = player.y ?? targetY;

    // If already at target, just update and return
    if (startX === targetX && startY === targetY) {
      player.x = targetX;
      player.y = targetY;
      return;
    }

    // Set up animation state
    this.animationState = {
      targetX,
      targetY,
      startX,
      startY,
      startTime: performance.now(),
    };

    // Start animation loop
    this.animate();
  }

  private animate = (): void => {
    const state = this.animationState;
    if (!state) return;

    const player = multiplayer.users.get(AI_SESSION_ID);
    if (!player) {
      this.animationState = undefined;
      return;
    }

    const now = performance.now();
    const elapsed = now - state.startTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
    const eased = EASING(progress);

    // Interpolate position and update player directly
    player.x = state.startX + (state.targetX - state.startX) * eased;
    player.y = state.startY + (state.targetY - state.startY) * eased;

    // Trigger a render update
    events.emit('multiplayerCursor');

    if (progress < 1) {
      // Continue animation
      state.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      // Animation complete
      player.x = state.targetX;
      player.y = state.targetY;
      this.animationState = undefined;
    }
  };

  /**
   * Stops any ongoing animation
   */
  stopAnimation(): void {
    if (this.animationState?.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationState.animationFrameId);
    }
    this.animationState = undefined;
  }

  /**
   * Updates the AI user's selection and animates cursor to the selection's starting cell
   */
  updateSelection(selection: string, sheetId: string): void {
    const player = multiplayer.users.get(AI_SESSION_ID);
    if (!player) return;

    // Update selection
    player.selection = selection;
    player.parsedSelection = new JsSelection(sheetId);
    if (selection) {
      player.parsedSelection.load(selection);
    }

    // Get cursor position from selection
    const cursor = player.parsedSelection.getCursor();
    const cellOffsets = sheets.sheet.getCellOffsets(cursor.x, cursor.y);
    const targetX = cellOffsets.x + cellOffsets.width / 2;
    const targetY = cellOffsets.y + cellOffsets.height / 2;

    // Update sheet and visibility
    player.visible = true;
    const sheetChanged = player.sheet_id !== sheetId;
    player.sheet_id = sheetId;

    // Animate cursor to target position (updates player.x and player.y during animation)
    this.animateToPosition(targetX, targetY);

    if (sheetChanged) {
      events.emit('multiplayerChangeSheet');
    }

    if (player.sheet_id === sheets.current) {
      events.emit('setDirty', { multiplayerCursor: true });
      events.emit('multiplayerCursor');
    }
    events.emit('multiplayerUpdate', multiplayer.getUsers());
  }
}

export const aiUser = new AIUser();

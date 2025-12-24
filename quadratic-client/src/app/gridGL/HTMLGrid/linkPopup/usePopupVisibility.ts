import { useCallback, useMemo, useRef, useState } from 'react';

const FADE_OUT_DELAY = 400;
const CLOSE_COOLDOWN = 300;

export type PopupMode = 'view' | 'edit';

interface UsePopupVisibilityOptions {
  onClose?: () => void;
}

/**
 * Hook to manage popup visibility timing: hover delays, fade out, close cooldown
 */
export function usePopupVisibility(options: UsePopupVisibilityOptions = {}) {
  const [hovering, setHovering] = useState(false);
  const [skipFade, setSkipFade] = useState(false);

  const hoveringRef = useRef(false);
  const modeRef = useRef<PopupMode>('view');
  const fadeOutTimeoutRef = useRef<number | undefined>(undefined);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const justClosedRef = useRef(false);
  const justClosedTimeoutRef = useRef<number | undefined>(undefined);
  const afterCooldownRef = useRef<(() => void) | undefined>(undefined);

  // Update mode ref (called by parent hook)
  const setModeRef = useCallback((mode: PopupMode) => {
    modeRef.current = mode;
  }, []);

  // Check if we just closed (for preventing immediate reopen)
  const isJustClosed = useCallback(() => justClosedRef.current, []);

  // Check if in edit mode
  const isEditMode = useCallback(() => modeRef.current === 'edit', []);

  // Register callback to run after cooldown
  const setAfterCooldown = useCallback((fn: () => void) => {
    afterCooldownRef.current = fn;
  }, []);

  // Close with cooldown to prevent immediate reappearance
  const triggerClose = useCallback(
    (instant = false) => {
      setSkipFade(instant);
      setHovering(false);
      hoveringRef.current = false;
      clearTimeout(hoverTimeoutRef.current);
      clearTimeout(fadeOutTimeoutRef.current);

      justClosedRef.current = true;
      clearTimeout(justClosedTimeoutRef.current);
      justClosedTimeoutRef.current = window.setTimeout(() => {
        justClosedRef.current = false;
        setSkipFade(false);
        afterCooldownRef.current?.();
      }, CLOSE_COOLDOWN);

      options.onClose?.();
    },
    [options]
  );

  // Mouse handlers
  const handleMouseEnter = useCallback(() => {
    hoveringRef.current = true;
    setHovering(true);
    clearTimeout(fadeOutTimeoutRef.current);
    clearTimeout(hoverTimeoutRef.current);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (!hoveringRef.current) {
      hoveringRef.current = true;
      setHovering(true);
    }
    clearTimeout(fadeOutTimeoutRef.current);
    clearTimeout(hoverTimeoutRef.current);
  }, []);

  const handleMouseLeave = useCallback((onFadeOut: () => void) => {
    hoveringRef.current = false;
    setHovering(false);

    if (modeRef.current === 'edit') return;

    fadeOutTimeoutRef.current = window.setTimeout(() => {
      if (!hoveringRef.current && modeRef.current !== 'edit') {
        onFadeOut();
      }
    }, FADE_OUT_DELAY);
  }, []);

  // Clear timeouts
  const clearTimeouts = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
    clearTimeout(fadeOutTimeoutRef.current);
  }, []);

  // Check if hovering
  const isHovering = useCallback(() => hoveringRef.current, []);

  // Set hover timeout (for delayed show)
  const setHoverTimeout = useCallback((callback: () => void, delay: number) => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(callback, delay);
  }, []);

  // Set fade out timeout (for delayed hide)
  const setFadeOutTimeout = useCallback((callback: () => void, delay: number) => {
    clearTimeout(fadeOutTimeoutRef.current);
    fadeOutTimeoutRef.current = window.setTimeout(callback, delay);
  }, []);

  // Memoize ONLY the callbacks - these are stable and won't cause useEffect re-runs
  // hovering and skipFade are added directly (not memoized) so they update reactively
  // but changing them won't affect useEffect dependencies that only use the callbacks
  const stableCallbacks = useMemo(
    () => ({
      setModeRef,
      isJustClosed,
      isEditMode,
      isHovering,
      setAfterCooldown,
      triggerClose,
      handleMouseEnter,
      handleMouseMove,
      handleMouseLeave,
      clearTimeouts,
      setHoverTimeout,
      setFadeOutTimeout,
    }),
    [
      setModeRef,
      isJustClosed,
      isEditMode,
      isHovering,
      setAfterCooldown,
      triggerClose,
      handleMouseEnter,
      handleMouseMove,
      handleMouseLeave,
      clearTimeouts,
      setHoverTimeout,
      setFadeOutTimeout,
    ]
  );

  return {
    ...stableCallbacks,
    hovering,
    skipFade,
  };
}

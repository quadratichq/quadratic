/**
 * A React hook that animates an element from its normal position and size to match
 * the position and size of a target element (identified by DOM id).
 *
 * This hook provides smooth transform-based animations using CSS transitions with
 * a cubic-bezier easing function. It calculates the translation and scale needed
 * to morph the source element into the target element's dimensions and position.
 */

import { useCallback, useRef, useState, type RefObject } from 'react';

interface AnimateElementProps {
  /** Element to be animated */
  ref: RefObject<HTMLElement | null>;

  /** Id of the target element to animate when hiding */
  animateToId: string;

  durationMs: number;

  onHide: () => void;
}

interface AnimateElementResult {
  transform: string | undefined;
  transition: string | undefined;

  /** Trigger the animation. Pass true to show (scale up), false to hide (scale down) and animate to the target element when hiding */
  animate: (show: boolean) => void;
}

interface AnimationTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

type State = 'showing' | 'hiding' | undefined;

export const useAnimateElement = (props: AnimateElementProps): AnimateElementResult => {
  const { ref, animateToId, durationMs, onHide } = props;
  const [state, setState] = useState<State>(undefined);
  const [animationTransform, setAnimationTransform] = useState<AnimationTransform | undefined>();
  const timeoutRef = useRef<number | undefined>(undefined);

  const calculateTransform = useCallback(() => {
    if (!ref.current) return null;

    const rect = ref.current.getBoundingClientRect();
    const trigger = document.getElementById(animateToId);

    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();

    // Calculate the center of both elements
    const containerCenterX = rect.left + rect.width / 2;
    const containerCenterY = rect.top + rect.height / 2;
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;

    // Calculate translation needed to move container center to trigger center
    const translateX = triggerCenterX - containerCenterX;
    const translateY = triggerCenterY - containerCenterY;

    // Calculate scale to match target size
    const currentSize = Math.max(rect.width, rect.height);
    const targetSize = Math.max(triggerRect.width, triggerRect.height);
    const scale = targetSize / currentSize;

    return { translateX, translateY, scale, width: rect.width, height: rect.height };
  }, [ref, animateToId]);

  const onHideCallback = useCallback(() => {
    setState(undefined);
    setAnimationTransform(undefined);
    timeoutRef.current = undefined;
    onHide();
  }, [onHide]);

  const animate = useCallback(
    (show: boolean) => {
      if (!ref.current) return;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      const transform = calculateTransform();
      if (!transform) return;

      if (show) {
        setState('showing');
        setAnimationTransform({
          translateX: 0,
          translateY: 0,
          scale: 1,
        });
      } else {
        setState('hiding');
        setAnimationTransform({
          translateX: transform.translateX,
          translateY: transform.translateY,
          scale: transform.scale,
        });
      }

      // Clean up state after animation completes
      if (!show) {
        timeoutRef.current = window.setTimeout(() => {
          onHideCallback();
        }, durationMs);
      }
    },
    [calculateTransform, onHideCallback, durationMs, ref]
  );

  return {
    transform:
      state && animationTransform
        ? `translate(${animationTransform.translateX}px, ${animationTransform.translateY}px) scale(${animationTransform.scale})`
        : undefined,
    transition: state ? `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
    animate,
  };
};

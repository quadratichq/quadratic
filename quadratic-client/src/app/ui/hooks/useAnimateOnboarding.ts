import { bonusPromptsLoadedAtom, onboardingChecklistAtom } from '@/app/atoms/bonusPromptsAtom';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';

// Animation timing constants (in milliseconds)
const ANIMATION_DURATION = 450;

// Cubic bezier easing function (0.4, 0, 0.2, 1)
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

type AnimationState = 'idle' | 'opening' | 'open' | 'closing';

interface TransformState {
  translateX: number;
  translateY: number;
  scale: number;
  width: number;
  height: number;
}

export const useAnimateOnboarding = (showOnboardingChecklist: boolean, demoRunning: boolean) => {
  const hideChecklist = useSetAtom(onboardingChecklistAtom);
  const bonusPromptsLoaded = useAtomValue(bonusPromptsLoadedAtom);

  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [showIconOnly, setShowIconOnly] = useState(false);
  const [currentTransform, setCurrentTransform] = useState<TransformState>({
    translateX: 0,
    translateY: 0,
    scale: 1,
    width: 0,
    height: 0,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number>(0);
  const fullSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const naturalPositionRef = useRef<{ centerX: number; centerY: number }>({ centerX: 0, centerY: 0 });

  // Track if checklist was open on initial page load (to skip animation)
  // Use null to indicate we haven't captured the initial state yet
  const wasOpenOnMountRef = useRef<boolean | null>(null);

  // Capture the initial state only after bonus prompts data is loaded
  useEffect(() => {
    if (bonusPromptsLoaded && wasOpenOnMountRef.current === null) {
      wasOpenOnMountRef.current = showOnboardingChecklist;
    }
  }, [bonusPromptsLoaded, showOnboardingChecklist]);

  // Calculate position and scale for animation
  const calculateTransform = useCallback((progress: number, isOpening: boolean) => {
    if (!containerRef.current) return null;

    const trigger = document.getElementById('onboarding-checklist-trigger');
    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();
    const fullSize = fullSizeRef.current;
    const naturalPosition = naturalPositionRef.current;

    // Calculate trigger center
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;

    // Use stored natural position (calculated before any transforms were applied)
    const containerNaturalCenterX = naturalPosition.centerX;
    const containerNaturalCenterY = naturalPosition.centerY;

    // Calculate total translation needed
    const totalTranslateX = triggerCenterX - containerNaturalCenterX;
    const totalTranslateY = triggerCenterY - containerNaturalCenterY;

    // For closing animation
    if (!isOpening) {
      const easedProgress = easeInOutCubic(progress);
      const currentSize = Math.max(fullSize.width, fullSize.height);
      // Use the actual trigger button size for perfect alignment
      const targetSize = Math.max(triggerRect.width, triggerRect.height);
      const scaleTarget = targetSize / currentSize;

      // First half (0 to 0.5): full content, start scaling down
      // Second half (0.5 to 1): icon only, continue scaling down to final position
      if (progress < 0.5) {
        // First half - show full content, scale from 1 to scaleTarget
        const halfProgress = easedProgress * 2; // 0 to ~1

        return {
          translateX: totalTranslateX * easedProgress,
          translateY: totalTranslateY * easedProgress,
          scale: 1 - (1 - scaleTarget) * halfProgress,
          width: fullSize.width,
          height: fullSize.height,
          showIcon: false,
        };
      } else {
        // Second half - show icon, continue with container at full size but content is icon
        return {
          translateX: totalTranslateX * easedProgress,
          translateY: totalTranslateY * easedProgress,
          scale: scaleTarget, // Keep the same scale
          width: fullSize.width,
          height: fullSize.height,
          showIcon: true,
        };
      }
    }

    // For opening animation
    else {
      const easedProgress = easeInOutCubic(progress);
      const currentSize = Math.max(fullSize.width, fullSize.height);
      // Use the actual trigger button size for perfect alignment
      const targetSize = Math.max(triggerRect.width, triggerRect.height);
      const scaleStart = targetSize / currentSize;

      // First half (0 to 0.5): icon only, start expanding from trigger
      // Second half (0.5 to 1): full content, continue expanding to final size
      if (progress < 0.5) {
        // First half - show icon at scale, container at full size
        return {
          translateX: totalTranslateX * (1 - easedProgress),
          translateY: totalTranslateY * (1 - easedProgress),
          scale: scaleStart,
          width: fullSize.width,
          height: fullSize.height,
          showIcon: true,
        };
      } else {
        // Second half - show full content, continue scaling up
        const halfProgress = (easedProgress - 0.5) * 2;

        return {
          translateX: totalTranslateX * (1 - easedProgress),
          translateY: totalTranslateY * (1 - easedProgress),
          scale: scaleStart + (1 - scaleStart) * halfProgress,
          width: fullSize.width,
          height: fullSize.height,
          showIcon: false,
        };
      }
    }
  }, []);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    if (animationState !== 'opening' && animationState !== 'closing') {
      return;
    }

    const animate = (currentTime: number) => {
      if (animationStartTimeRef.current === 0) {
        animationStartTimeRef.current = currentTime;
      }

      const elapsed = currentTime - animationStartTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      const transform = calculateTransform(progress, animationState === 'opening');

      if (transform) {
        setCurrentTransform({
          translateX: transform.translateX,
          translateY: transform.translateY,
          scale: transform.scale,
          width: transform.width,
          height: transform.height,
        });
        setShowIconOnly(transform.showIcon);
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        if (animationState === 'closing') {
          hideChecklist('dismiss');
          setAnimationState('idle');
          setShowIconOnly(false);
          setIsInitialized(false);
        } else {
          setAnimationState('open');
          setShowIconOnly(false);
        }
        animationStartTimeRef.current = 0;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animationState, calculateTransform, hideChecklist]);

  // Initialize and start opening animation when component becomes visible
  useEffect(() => {
    if (!showOnboardingChecklist) {
      setIsInitialized(false);
      setAnimationState('idle');
      return;
    }

    if (!isInitialized && containerRef.current) {
      // First render - measure the full size and natural position
      const rect = containerRef.current.getBoundingClientRect();

      // Need valid dimensions to proceed
      if (rect.width === 0 || rect.height === 0) {
        // Try again on next frame
        const timer = setTimeout(() => {
          setIsInitialized(false);
        }, 10);
        return () => clearTimeout(timer);
      }

      fullSizeRef.current = { width: rect.width, height: rect.height };

      // Store the natural position (before any transforms are applied)
      const containerCenterX = rect.left + rect.width / 2;
      const containerCenterY = rect.top + rect.height / 2;
      naturalPositionRef.current = { centerX: containerCenterX, centerY: containerCenterY };

      // Check if checklist was open on initial page load - if so, skip animation and just appear
      // Only skip if we've captured the initial state (not null) and it was true
      if (wasOpenOnMountRef.current === true) {
        wasOpenOnMountRef.current = false;
        setIsInitialized(true);
        setAnimationState('open');
        setShowIconOnly(false);
        return;
      }

      // Calculate initial position (at trigger button)
      const trigger = document.getElementById('onboarding-checklist-trigger');
      if (trigger) {
        const triggerRect = trigger.getBoundingClientRect();

        const triggerCenterX = triggerRect.left + triggerRect.width / 2;
        const triggerCenterY = triggerRect.top + triggerRect.height / 2;

        // Calculate initial scale (small, at trigger size)
        const currentSize = Math.max(rect.width, rect.height);
        // Use the actual trigger button size for perfect alignment
        const targetSize = Math.max(triggerRect.width, triggerRect.height);
        const initialScale = targetSize / currentSize;

        setCurrentTransform({
          translateX: triggerCenterX - containerCenterX,
          translateY: triggerCenterY - containerCenterY,
          scale: initialScale,
          width: rect.width,
          height: rect.height,
        });
        setShowIconOnly(true);
        setIsInitialized(true);

        // Start opening animation on next frame
        requestAnimationFrame(() => {
          setAnimationState('opening');
        });
      }
    }
  }, [showOnboardingChecklist, isInitialized]);

  const handleClose = useCallback(() => {
    if (demoRunning) {
      return false; // Indicate that close was not handled
    }

    if (!containerRef.current) return false;

    // Capture the full size and natural position before starting closing animation
    const rect = containerRef.current.getBoundingClientRect();
    fullSizeRef.current = { width: rect.width, height: rect.height };

    // Recapture natural position (in case window was resized or anything changed)
    // Since we're in 'open' state, the transforms should be identity (0, 0, 1)
    const containerCenterX = rect.left + rect.width / 2;
    const containerCenterY = rect.top + rect.height / 2;
    naturalPositionRef.current = { centerX: containerCenterX, centerY: containerCenterY };

    // Start closing animation
    setAnimationState('closing');
    return true; // Indicate that close was handled
  }, [demoRunning]);

  const isAnimating = animationState === 'opening' || animationState === 'closing';

  // Show transform only during animation, not when fully open
  const showTransform = isInitialized && animationState !== 'open';

  return {
    containerRef,
    currentTransform,
    isInitialized,
    showIconOnly,
    isAnimating,
    showTransform,
    handleClose,
  };
};

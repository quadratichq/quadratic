import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { useRootRouteLoaderData } from '@/routes/_root';
import { AIIcon, DatabaseIcon, ScheduledTasksIcon } from '@/shared/components/Icons';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { ZoomInIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';

interface WalkthroughStep {
  target: string; // data-walkthrough attribute value
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'left' | 'right' | 'bottom' | 'top' | 'center';
}

const ALL_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    target: 'grid-canvas',
    title: 'The most flexible spreadsheet',
    description:
      'Pinch and zoom like a map, scroll infinitely in any direction, and run real Python, JavaScript, or SQL code directly in cells.',
    icon: <ZoomInIcon className="h-8 w-8" />,
    position: 'center',
  },
  {
    target: 'connections',
    title: 'Directly connect external data',
    description:
      'Connect to external data sources like Google Analytics, Databases, bank accounts, and more. Your spreadsheet becomes a live dashboard.',
    icon: <DatabaseIcon className="h-8 w-8" />,
    position: 'right',
  },
  {
    target: 'scheduled-tasks',
    title: 'Schedule sheets to update automatically',
    description:
      'Set your sheets to refresh on any schedule—hourly, daily, or custom intervals. Keep your data always up to date.',
    icon: <ScheduledTasksIcon className="h-8 w-8" />,
    position: 'right',
  },
  {
    target: 'ai-chat-input',
    title: 'Start with a prompt',
    description:
      'Tell Quadratic AI what you want to build. Describe your goal in plain language and let AI create formulas, analyze data, or build entire workflows for you.',
    icon: <AIIcon className="h-8 w-8" />,
    position: 'top',
  },
];

const STORAGE_KEY = 'quadratic-feature-walkthrough-completed';

export function FeatureWalkthrough() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const [completed, setCompleted] = useLocalStorage(STORAGE_KEY, false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [availableSteps, setAvailableSteps] = useState<WalkthroughStep[]>([]);
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);

  // Only show walkthrough for authenticated users who haven't completed it
  // For testing: clear localStorage key 'quadratic-feature-walkthrough-completed' and refresh
  const shouldShow = isAuthenticated && !completed;

  // Determine which steps are available based on visible elements
  useEffect(() => {
    if (!shouldShow) return;

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      const visibleSteps = ALL_WALKTHROUGH_STEPS.filter((step) => {
        // Center position (grid) is always available
        if (step.position === 'center') return true;
        // Check if the target element exists in the DOM
        return document.querySelector(`[data-walkthrough="${step.target}"]`) !== null;
      });
      setAvailableSteps(visibleSteps);
    }, 500);

    return () => clearTimeout(timer);
  }, [shouldShow]);

  const currentStep = useMemo(() => availableSteps[currentStepIndex], [availableSteps, currentStepIndex]);

  // Find and highlight the current target element
  const updateTargetRect = useCallback(() => {
    if (!shouldShow || !currentStep) return;

    const element = document.querySelector(`[data-walkthrough="${currentStep.target}"]`);

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      setIsVisible(true);
    } else {
      // Element not found - only continue if it's not required
      setTargetRect(null);
      setIsVisible(true);
    }
  }, [currentStep, shouldShow]);

  // Open AI panel when on the AI chat step
  useEffect(() => {
    if (!shouldShow || !currentStep) return;

    if (currentStep.target === 'ai-chat-input' && !showAIAnalyst) {
      setShowAIAnalyst(true);
    }
  }, [currentStep, shouldShow, showAIAnalyst, setShowAIAnalyst]);

  useEffect(() => {
    if (!shouldShow || availableSteps.length === 0) return;

    // Update immediately for step changes, small delay for initial load
    const timer = setTimeout(updateTargetRect, isVisible ? 50 : 300);

    // Update on resize
    window.addEventListener('resize', updateTargetRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
    };
  }, [updateTargetRect, shouldShow, availableSteps.length, currentStepIndex, isVisible]);

  const handleNext = () => {
    if (currentStepIndex < availableSteps.length - 1) {
      trackEvent('[FeatureWalkthrough].next', { step: currentStep.target, stepIndex: currentStepIndex });
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Complete the walkthrough
      trackEvent('[FeatureWalkthrough].completed', { totalSteps: availableSteps.length });
      setCompleted(true);
    }
  };

  const handleSkip = () => {
    trackEvent('[FeatureWalkthrough].skipped', { atStep: currentStep.target, stepIndex: currentStepIndex });
    setCompleted(true);
  };

  if (!shouldShow || !isVisible || availableSteps.length === 0 || !currentStep) {
    return null;
  }

  const isLastStep = currentStepIndex === availableSteps.length - 1;

  // Calculate tooltip position based on target element and step configuration
  // Using consistent top/left positioning for smooth CSS transitions
  const getTooltipStyle = (): React.CSSProperties => {
    const tooltipWidth = 420;
    const tooltipHeight = 220; // Approximate height
    const padding = 16;

    if (currentStep.position === 'center' || !targetRect) {
      return {
        position: 'fixed',
        top: (window.innerHeight - tooltipHeight) / 2,
        left: (window.innerWidth - tooltipWidth) / 2,
        width: tooltipWidth,
      };
    }

    // Calculate top position, ensuring tooltip stays on screen
    const calculateTop = () => {
      // Start aligned with top of target
      let top = targetRect.top;

      // If tooltip would go off bottom of screen, align to bottom of target instead
      if (top + tooltipHeight > window.innerHeight - padding) {
        top = targetRect.bottom - tooltipHeight;
      }

      // Ensure we don't go off the top either
      return Math.max(padding, top);
    };

    if (currentStep.position === 'right') {
      return {
        position: 'fixed',
        top: calculateTop(),
        left: targetRect.right + padding,
        width: tooltipWidth,
      };
    }

    if (currentStep.position === 'left') {
      return {
        position: 'fixed',
        top: calculateTop(),
        left: targetRect.left - padding - tooltipWidth,
        width: tooltipWidth,
      };
    }

    if (currentStep.position === 'bottom') {
      return {
        position: 'fixed',
        top: targetRect.bottom + padding,
        left: targetRect.left,
        width: tooltipWidth,
      };
    }

    if (currentStep.position === 'top') {
      // Position in the top-right area, well above the target
      const spotlightPadding = 16;
      const extraGap = 60; // Extra space to ensure no overlap
      const topOfSpotlight = targetRect.top - spotlightPadding;

      return {
        position: 'fixed',
        top: Math.max(padding, topOfSpotlight - tooltipHeight - extraGap),
        left: targetRect.right - tooltipWidth,
        width: tooltipWidth,
      };
    }

    return {};
  };

  // Calculate spotlight position and size
  const getSpotlightStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { display: 'none' };
    }

    const padding = currentStep.position === 'center' ? 16 : 8;
    const borderRadius = currentStep.position === 'center' ? 12 : 8;

    return {
      position: 'fixed',
      left: targetRect.left - padding,
      top: targetRect.top - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
      borderRadius: borderRadius,
      // Use a massive box-shadow to create the dark overlay effect
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
    };
  };

  return (
    <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
      {/* Spotlight cutout with box-shadow overlay */}
      {targetRect ? (
        <div className="pointer-events-none transition-all duration-300" style={getSpotlightStyle()} />
      ) : (
        /* Fallback full overlay when no target */
        <div className="absolute inset-0 bg-black/70" />
      )}

      {/* Spotlight ring/border around target element */}
      {targetRect && (
        <div
          className={cn(
            'pointer-events-none absolute border-2 border-primary transition-all duration-300',
            currentStep.position === 'center' ? 'rounded-xl' : 'rounded-lg'
          )}
          style={{
            left: targetRect.left - (currentStep.position === 'center' ? 16 : 8),
            top: targetRect.top - (currentStep.position === 'center' ? 16 : 8),
            width: targetRect.width + (currentStep.position === 'center' ? 32 : 16),
            height: targetRect.height + (currentStep.position === 'center' ? 32 : 16),
          }}
        />
      )}

      {/* Tooltip/Content card */}
      <div
        className="z-10 rounded-lg border border-border bg-background p-6 shadow-2xl transition-all duration-300"
        style={getTooltipStyle()}
      >
        {/* Step indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {availableSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 w-6 rounded-full transition-colors',
                  index === currentStepIndex ? 'bg-primary' : index < currentStepIndex ? 'bg-primary/50' : 'bg-muted'
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {currentStepIndex + 1} of {availableSteps.length}
          </span>
        </div>

        {/* Icon and content */}
        <div className="flex gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {currentStep.icon}
          </div>
          <div className="flex-1">
            <h2 className="mb-2 text-lg font-semibold leading-tight">{currentStep.title}</h2>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Skip tour
          </Button>
          <Button onClick={handleNext}>{isLastStep ? 'Get started' : 'Next'}</Button>
        </div>
      </div>
    </div>
  );
}

// Export a function to reset the walkthrough (useful for testing)
export function resetFeatureWalkthrough() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

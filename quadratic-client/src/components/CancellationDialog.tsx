import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { SpinnerIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/shadcn/ui/dialog';
import { Label } from '@/shared/shadcn/ui/label';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

type CancellationStep = 'loading-eligibility' | 'offer-discount' | 'get-feedback' | 'applying-discount';

type CancellationDialogProps = {
  teamUuid: string;
  trigger?: ReactNode;
};

export function CancellationDialog({ teamUuid, trigger }: CancellationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<CancellationStep>('loading-eligibility');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { loggedInUser } = useRootRouteLoaderData();
  const navigate = useNavigate();

  // Load eligibility for retention discount when the dialog opens
  useEffect(() => {
    if (isOpen && currentStep === 'loading-eligibility') {
      let isCancelled = false;

      const checkEligibility = async () => {
        try {
          // Add timeout to prevent hanging indefinitely
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 10000);
          });

          const result = await Promise.race([apiClient.teams.billing.retentionDiscount.get(teamUuid), timeoutPromise]);

          if (!isCancelled) {
            setCurrentStep(result.isEligible ? 'offer-discount' : 'get-feedback');
          }
        } catch (error) {
          console.error('[CancellationDialog] Error checking eligibility:', error);
          if (!isCancelled) {
            setCurrentStep('get-feedback');
          }
        }
      };

      checkEligibility();

      return () => {
        isCancelled = true;
      };
    }
  }, [isOpen, currentStep, teamUuid]);

  // Reset state when the dialog is closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('loading-eligibility');
      setFeedback('');
    }
  }, [isOpen]);

  // Track when the dialog opens
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      trackEvent('[CancellationFlow].opened');
    }
    setIsOpen(open);
  }, []);

  const handleAcceptOffer = useCallback(async () => {
    trackEvent('[CancellationFlow].accepted-retention-offer');
    setIsLoading(true);

    try {
      await apiClient.teams.billing.retentionDiscount.create(teamUuid);
      addGlobalSnackbar('50% off applied to your next month!', { severity: 'success' });
      setIsOpen(false);
    } catch (error) {
      console.error('Error applying coupon:', error);
      addGlobalSnackbar('Failed to apply discount. Please try again.', { severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [addGlobalSnackbar, teamUuid]);

  const handleDeclineOffer = useCallback(() => {
    trackEvent('[CancellationFlow].declined-retention-offer');
    setCurrentStep('get-feedback');
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    const feedbackToSubmit = feedback.trim();
    setIsLoading(true);

    try {
      // If there's feedback, send to API
      if (feedbackToSubmit) {
        trackEvent('[CancellationFlow].submitted-feedback', {
          feedback: feedbackToSubmit,
        });
        await apiClient.postFeedback({
          feedback: feedbackToSubmit,
          userEmail: loggedInUser?.email,
          context: 'Cancellation feedback',
        });
      }

      // Proceed to Stripe cancellation
      navigate(ROUTES.TEAM_BILLING_MANAGE(teamUuid));
    } catch (error) {
      console.error('Error submitting feedback:', error);
      addGlobalSnackbar('Failed to submit feedback. Please try again.', { severity: 'error' });
      setIsLoading(false);
    }
  }, [addGlobalSnackbar, feedback, navigate, loggedInUser?.email, teamUuid]);

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="w-full" data-testid="cancel-subscription">
      Cancel subscription
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel subscription</DialogTitle>
        </DialogHeader>

        {currentStep === 'loading-eligibility' && (
          <div className="flex flex-col justify-center gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {currentStep === 'offer-discount' && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                <strong>50% off next month if you stay with us.</strong> We’re improving Quadratic based on user
                feedback. If things haven’t been great, we’d love to try and fix that—with a discount too.
              </p>
            </div>
            <DialogFooter className="flex items-center">
              {isLoading && <SpinnerIcon className="mr-2 text-primary" />}
              <Button variant="outline" onClick={handleDeclineOffer} disabled={isLoading}>
                Continue cancellation
              </Button>
              <Button onClick={handleAcceptOffer} disabled={isLoading}>
                Get 50% off next month
              </Button>
            </DialogFooter>
          </>
        )}

        {currentStep === 'get-feedback' && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cancel-feedback" className="font-normal">
                We’d love to hear your feedback. Why are you looking to cancel?
              </Label>
              <Textarea
                id="cancel-feedback"
                placeholder="I think you could improve…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[100px] pt-2"
                autoFocus
              />
            </div>
            <DialogFooter className="flex items-center">
              {isLoading && <SpinnerIcon className="mr-2 text-primary" />}
              <Button variant="outline" onClick={handleSubmitFeedback} disabled={isLoading}>
                Continue cancellation
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

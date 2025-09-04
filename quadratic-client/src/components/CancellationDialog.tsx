import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { SpinnerIcon } from '@/shared/components/Icons';
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
import { useCallback, useEffect, useState } from 'react';

type CancellationStep = 'loading-eligibility' | 'offer-discount' | 'get-feedback' | 'applying-discount';

export function CancellationDialog({
  handleNavigateToStripePortal,
  teamUuid,
}: {
  handleNavigateToStripePortal: () => void;
  teamUuid: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<CancellationStep>('loading-eligibility');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { loggedInUser } = useRootRouteLoaderData();

  // Load eligibility for retention discount when the dialog opens
  useEffect(() => {
    if (isOpen && currentStep === 'loading-eligibility') {
      const checkEligibility = async () => {
        try {
          const { isEligible } = await apiClient.teams.billing.retentionDiscount.get(teamUuid);
          setCurrentStep(isEligible ? 'offer-discount' : 'get-feedback');
        } catch (error) {
          console.error('Error checking eligibility:', error);
          setCurrentStep('get-feedback');
        }
      };
      checkEligibility();
    }
  }, [isOpen, currentStep, teamUuid]);

  // Reset state when the dialog is closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('loading-eligibility');
      setFeedback('');
    }
  }, [isOpen]);

  const handleOpenDialog = useCallback(() => {
    trackEvent('[CancellationFlow].opened');
    setIsOpen(true);
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
      handleNavigateToStripePortal();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      addGlobalSnackbar('Failed to submit feedback. Please try again.', { severity: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [addGlobalSnackbar, feedback, handleNavigateToStripePortal, loggedInUser?.email]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full" onClick={handleOpenDialog}>
          Cancel subscription
        </Button>
      </DialogTrigger>
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

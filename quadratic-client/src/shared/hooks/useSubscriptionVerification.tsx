import { apiClient } from '@/shared/api/apiClient';
import { useEffect } from 'react';
import { useRevalidator, useSearchParams } from 'react-router';

/**
 * Hook to verify billing status updates after successful Stripe checkout.
 *
 * Uses a fast verification endpoint to check the checkout session directly.
 * If verification succeeds, updates the UI immediately.
 *
 * @param isOnPaidPlan - Optional current paid plan status from the loader data.
 *                       If true, immediately cleans up query params.
 * @param teamUuid - Optional team UUID. Required for fast checkout session verification.
 */
export function useSubscriptionVerification(isOnPaidPlan?: boolean, teamUuid?: string) {
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();

  useEffect(() => {
    const subscriptionParam = searchParams.get('subscription');
    const isReturningFromCheckout = subscriptionParam === 'created';

    if (!isReturningFromCheckout) {
      return;
    }

    // If already on paid plan, we're done - remove the query param
    if (isOnPaidPlan === true) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('subscription');
      newUrl.searchParams.delete('session_id');
      window.history.replaceState({}, '', newUrl.toString());
      return;
    }

    const cleanup = () => {
      // Remove the query params
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('subscription');
      newUrl.searchParams.delete('session_id');
      window.history.replaceState({}, '', newUrl.toString());
    };

    // Fast path: If we have session_id and teamUuid, verify checkout session directly
    const sessionId = searchParams.get('session_id');
    if (sessionId && teamUuid) {
      // Verify checkout session and update status immediately if active
      apiClient.teams.billing
        .verifyCheckoutSession(teamUuid, sessionId)
        .then((result) => {
          if (result.subscriptionActive) {
            // Subscription is active! Revalidate to get fresh data, then clean up
            revalidator.revalidate();
            setTimeout(() => {
              cleanup();
            }, 500);
          } else {
            // Session exists but subscription not active yet
            // Revalidate once in case webhook already processed it, then clean up
            revalidator.revalidate();
            setTimeout(() => {
              cleanup();
            }, 1000);
          }
        })
        .catch((error) => {
          // If verification fails, revalidate once in case webhook processed it, then clean up
          console.error('Failed to verify checkout session:', error);
          revalidator.revalidate();
          setTimeout(() => {
            cleanup();
          }, 1000);
        });
    } else {
      // No session_id or teamUuid, just revalidate once and clean up
      // (rely on webhooks to update status)
      revalidator.revalidate();
      setTimeout(() => {
        cleanup();
      }, 1000);
    }
  }, [searchParams, isOnPaidPlan, teamUuid, revalidator]);
}

import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useCallback, useEffect, useRef } from 'react';
import { useRevalidator, useSearchParams } from 'react-router';

const PENDING_SUBSCRIPTION_CONFIRMATION_KEY = 'pendingSubscriptionConfirmation';
const PENDING_CONFIRMATION_TIMESTAMP_KEY = 'pendingSubscriptionConfirmationTimestamp';
// Clear pending confirmation after 10 minutes if server hasn't confirmed
const PENDING_CONFIRMATION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Hook to handle billing status updates after successful Stripe checkout.
 *
 * When returning from checkout with query params, sets a localStorage flag to indicate
 * we're waiting for server confirmation, and optimistically shows paid status.
 * Once the server confirms isOnPaidPlan is true, clears the flag and cleans up query params.
 *
 * @param isOnPaidPlan - Current paid plan status from the loader data (server source of truth).
 * @param teamUuid - Optional team UUID (not used but kept for API compatibility).
 */
export function useSubscriptionVerification(isOnPaidPlan?: boolean, teamUuid?: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const { setIsOnPaidPlan } = useIsOnPaidPlan();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [pendingConfirmation, setPendingConfirmation] = useLocalStorage<boolean>(
    PENDING_SUBSCRIPTION_CONFIRMATION_KEY,
    false
  );
  const [pendingTimestamp, setPendingTimestamp] = useLocalStorage<number | null>(
    PENDING_CONFIRMATION_TIMESTAMP_KEY,
    null
  );
  // Track if we've already triggered revalidation for this checkout session
  const hasTriggeredRevalidationRef = useRef(false);
  // Track if we've already shown the success toast
  const hasShownSuccessToastRef = useRef(false);

  // Check if pending confirmation has expired
  const isPendingExpired = useCallback(() => {
    if (!pendingTimestamp) return false;
    return Date.now() - pendingTimestamp > PENDING_CONFIRMATION_TIMEOUT_MS;
  }, [pendingTimestamp]);

  // Clear pending confirmation and timestamp
  const clearPendingConfirmation = useCallback(() => {
    setPendingConfirmation(false);
    setPendingTimestamp(null);
  }, [setPendingConfirmation, setPendingTimestamp]);

  useEffect(() => {
    const subscriptionParam = searchParams.get('subscription');
    const isReturningFromCheckout = subscriptionParam === 'created';

    // Check if pending confirmation has expired
    if (pendingConfirmation && isPendingExpired()) {
      clearPendingConfirmation();
      // If expired and server says false, sync the server value
      if (isOnPaidPlan === false) {
        setIsOnPaidPlan(false);
      }
    }

    if (!isReturningFromCheckout) {
      // Reset flag when not returning from checkout
      hasTriggeredRevalidationRef.current = false;
      // Reset toast flag when not returning from checkout
      hasShownSuccessToastRef.current = false;

      // If we have pending confirmation but no query params, check server status
      if (pendingConfirmation) {
        // If server confirms we're NOT on paid plan and it's been a while, clear the flag
        // This handles the case where webhook failed or there was an error
        if (isOnPaidPlan === false && pendingTimestamp && Date.now() - pendingTimestamp > 3 * 60 * 1000) {
          // Give it at least 3 minutes for webhook to process, then trust server
          clearPendingConfirmation();
          setIsOnPaidPlan(false);
        }
        // If query params are gone but flag is still set, clear it (user navigated away)
        // But only if we're not in the middle of waiting for confirmation
        if (!pendingTimestamp || isPendingExpired()) {
          clearPendingConfirmation();
        }
      }
      return;
    }

    // Set pending confirmation flag and optimistically show as paid
    if (!pendingConfirmation) {
      setPendingConfirmation(true);
      setPendingTimestamp(Date.now());
      setIsOnPaidPlan(true);

      // Show success toast immediately when returning from checkout
      if (!hasShownSuccessToastRef.current) {
        addGlobalSnackbar('Thank you for subscribing! 🎉', { severity: 'success' });
        hasShownSuccessToastRef.current = true;
      }
    }

    // If server confirms we're on paid plan, clean up everything
    if (isOnPaidPlan === true) {
      clearPendingConfirmation();
      setIsOnPaidPlan(true);

      // Clean up URL params using setSearchParams to properly update React Router state
      if (isReturningFromCheckout || searchParams.has('subscription') || searchParams.has('session_id')) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('subscription');
        newSearchParams.delete('session_id');
        setSearchParams(newSearchParams, { replace: true });
      }
      hasTriggeredRevalidationRef.current = false;
      return;
    }

    // Trigger revalidation once when we first detect checkout return
    // The server will update isOnPaidPlan via the loader, which will trigger the cleanup above
    if (!hasTriggeredRevalidationRef.current) {
      hasTriggeredRevalidationRef.current = true;
      revalidator.revalidate();
    }
  }, [
    searchParams,
    isOnPaidPlan,
    revalidator,
    setIsOnPaidPlan,
    pendingConfirmation,
    setPendingConfirmation,
    pendingTimestamp,
    setPendingTimestamp,
    isPendingExpired,
    clearPendingConfirmation,
    addGlobalSnackbar,
    setSearchParams,
  ]);
}

/**
 * Check if we're waiting for subscription confirmation from the server.
 * Components should use this to avoid overwriting optimistic paid status.
 */
export function usePendingSubscriptionConfirmation(): boolean {
  const [pendingConfirmation] = useLocalStorage<boolean>(PENDING_SUBSCRIPTION_CONFIRMATION_KEY, false);
  return pendingConfirmation;
}

import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { redirect, type LoaderFunctionArgs } from 'react-router';

/**
 * This route is used to redirect users directly to Stripe’s checkout page.
 *
 * We use this as a route that way we can just <Link> people directly here, and
 * take advantage of the router going into a loading state while we get the
 * billing URL asynchronously.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { teamUuid } = params;
  if (!teamUuid) {
    return redirect('/');
  }

  try {
    // Extract plan query parameter from URL
    const url = new URL(request.url);
    const plan = url.searchParams.get('plan') as 'pro' | 'business' | null;
    // Default to 'pro' if no plan is specified
    const planParam: 'pro' | 'business' = plan === 'business' ? 'business' : 'pro';

    // Get returnTo parameter - this is where users go after checkout
    // Validate that it starts with '/' to prevent open redirect attacks
    const returnTo = url.searchParams.get('returnTo');
    const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : ROUTES.TEAM_SETTINGS(teamUuid);

    // Construct proper redirect URLs - use origin + path to ensure proper URL format
    const redirectUrlSuccess = `${url.origin}${safeReturnTo}`;
    const redirectUrlCancel = `${url.origin}${safeReturnTo}`;

    // Could throw because user doesn't have permission (unlikely but if the user knows the URL)
    const checkoutUrl = await apiClient.teams.billing
      .getCheckoutSessionUrl(teamUuid, redirectUrlSuccess, redirectUrlCancel, planParam)
      .then((data) => data.url);
    return new Response(null, {
      status: 302,
      headers: {
        Location: checkoutUrl,
      },
    });
  } catch (e) {
    console.error(e);
    return redirect('/');
  }
};

export const Component = () => {
  return null;
};

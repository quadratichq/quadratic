import { apiClient } from '@/shared/api/apiClient';
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
    // Could throw because user doesn't have permission (unlikely but if the user knows the URL)
    const url = await apiClient.teams.billing.getCheckoutSessionUrl(teamUuid).then((data) => data.url);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
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

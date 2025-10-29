import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';

export const getRedirectTo = (href?: string) => {
  const url = new URL(href ?? window.location.href);
  const redirectTo = url.searchParams.get(SEARCH_PARAMS.REDIRECT_TO.KEY);
  return redirectTo ? decodeURIComponent(redirectTo) : null;
};

export const getRedirectToOrLoginResult = () => {
  const url = new URL(window.location.href);
  let redirectTo = url.searchParams.get(SEARCH_PARAMS.REDIRECT_TO.KEY);
  if (!redirectTo) {
    url.pathname = ROUTES.LOGIN_RESULT;
    redirectTo = url.toString();
  }
  return decodeURIComponent(redirectTo);
};

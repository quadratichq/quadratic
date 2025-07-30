import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';

export const getRedirectTo = () => {
  const url = new URL(window.location.href);
  return url.searchParams.get(SEARCH_PARAMS.REDIRECT_TO.KEY);
};

export const getRedirectToOrLoginResult = () => {
  const url = new URL(window.location.href);
  let redirectTo = url.searchParams.get(SEARCH_PARAMS.REDIRECT_TO.KEY);
  if (!redirectTo) {
    url.pathname = ROUTES.LOGIN_RESULT;
    redirectTo = url.toString();
  }
  return redirectTo;
};

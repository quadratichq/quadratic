export function getURLParameter(key: string): string | null {
  const url = new URLSearchParams(window.location.search);
  return url.get(key);
}

export const getSearchParams = () => {
  return new URLSearchParams(window.location.search);
};

export const updateSearchParamsInUrl = (searchParams: URLSearchParams) => {
  const url = `${window.location.href.split('?')[0]}?${searchParams.toString()}`;
  window.history.replaceState(undefined, '', url);
};

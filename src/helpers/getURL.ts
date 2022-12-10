export function getURLParameter(key: string): string | null {
  const url = new URLSearchParams(window.location.search);
  return url.get(key);
}

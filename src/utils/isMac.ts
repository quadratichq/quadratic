// from https://stackoverflow.com/a/70519514/1955997
export function isMac(): boolean {
  return /(macintosh|macintel|macppc|mac68k|macos)/i.test(navigator.userAgent);
}
export function getAuth0AvatarSrc(picture?: string) {
  if (!picture) return undefined;
  try {
    const url = new URL(picture);
    if (url.hostname.includes('gravatar.com')) {
      const defaultSrc = url.searchParams.get('d');
      if (defaultSrc !== null) {
        return defaultSrc;
      }
    }
  } catch (e) {
    console.error('Error parsing picture', e);
  }
  return picture;
}

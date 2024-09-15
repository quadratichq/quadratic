function getLinkToOpen(url: string): string {
  if (url.match(/^https?:\/\//i)) {
    // URL already starts with http:// or https://
    return url;
  } else if (url.startsWith('/')) {
    // URL starts with /, it is a relative path
    return url;
  } else {
    // URL doesn't have a protocol, prepend https://
    return `https://${url}`;
  }
}

export function openLink(url: string) {
  window.open(getLinkToOpen(url), '_blank', 'noopener,noreferrer');
}

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

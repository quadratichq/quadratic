function getUrlToOpen(link: string): string {
  if (link.match(/^https?:\/\//i)) {
    // URL already starts with http:// or https://
    return link;
  } else if (link.startsWith('/')) {
    // URL starts with /, it is a relative path
    return link;
  } else {
    // URL doesn't have a protocol, prepend https://
    return `https://${link}`;
  }
}

export function openLink(url: string) {
  window.open(getUrlToOpen(url), '_blank', 'noopener,noreferrer');
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

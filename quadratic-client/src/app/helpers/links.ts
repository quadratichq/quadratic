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

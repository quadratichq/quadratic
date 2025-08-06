export function getUtmDataFromCookie(): {
  utm_source: string | undefined;
  utm_medium: string | undefined;
  utm_campaign: string | undefined;
  utm_content: string | undefined;
  utm_term: string | undefined;
} {
  let utmData = {
    utm_source: undefined,
    utm_medium: undefined,
    utm_campaign: undefined,
    utm_content: undefined,
    utm_term: undefined,
  };

  // get utm data from cookie
  const utmCookie = document.cookie.split('; ').find((row) => row.startsWith('quadratic_utm='));
  if (utmCookie) {
    try {
      utmData = JSON.parse(decodeURIComponent(utmCookie.split('=')[1]));
    } catch (error) {
      console.error('Error parsing UTM data from cookie', error);
    }
  }

  return utmData;
}

export const buildUrl = (route = '/') => {
  const baseUrl = (process.env.E2E_URL || 'http://qa.quadratic-preview.com/').replace(/\/$/, '');
  return `${baseUrl}${route}`;
};

export const buildUrl = (route = '/') => {
  const baseUrl = (process.env.E2E_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${baseUrl}${route}`;
};

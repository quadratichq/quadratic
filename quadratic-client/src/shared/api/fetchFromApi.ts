import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { captureException } from '@sentry/react';
import type z from 'zod';

export class ApiError extends Error {
  status: number;
  details?: string;
  method?: string;

  constructor(message: string, status: number, method?: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // Fetch response status code
    this.method = method; // Fetch request method
    this.details = details; // Details useful for debugging
  }
}

export async function fetchFromApi<T>(
  path: string,
  init: RequestInit,
  schema: z.Schema<T>
): Promise<z.infer<typeof schema>> {
  // We'll automatically inject additional headers to the request, starting with auth
  const isAuthenticated = await authClient.isAuthenticated();
  const token = isAuthenticated ? await authClient.getTokenOrRedirect() : '';
  const headers = new Headers(init.headers);
  if (isAuthenticated) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // And if we're submitting `FormData`, let the browser set the content-type automatically
  // This allows files to upload properly. Otherwise, we assume it's JSON.
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  // And finally, we'll set the headers back on the request
  init.headers = headers;

  // Make API call
  const url = apiClient.getApiUrl() + path;
  const response = await fetch(url, init);

  // Handle if the response is not JSON
  const json = await response.json().catch((error) => {
    captureException(error);
    throw new ApiError('An unknown error occurred: response is not JSON.', response.status, init.method);
  });

  // Handle response if a server error is returned
  if (!response.ok) {
    // TODO: ensure API only ever returns uniform error response, e.g. `json.errors` or `json.error.message`
    let details = 'No detailed error message provided';
    if (json?.error?.message) {
      details = json.error.message;
    } else if (json?.errors) {
      details = JSON.stringify(json.errors);
    }
    throw new ApiError(`Failed to fetch ${url}`, response.status, init.method, details);
  }

  // Compare the response to the expected schema
  const result = schema.safeParse(json);

  if (!result.success) {
    console.error(`Zod schema validation failed at: ${path}`, JSON.stringify(result.error, null, 2));

    const details = JSON.stringify(result.error);
    throw new ApiError('Unexpected response schema', response.status, init.method, details);
  }

  return result.data;
}

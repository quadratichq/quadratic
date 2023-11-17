import * as Sentry from '@sentry/react';
import z from 'zod';
import { authClient } from '../auth';
import { apiClient } from './apiClient';

export async function fetchFromApi<T>(path: string, init: RequestInit, schema: z.Schema<T>): Promise<T> {
  // We'll automatically inject additional headers to the request, starting with auth
  const isAuthenticated = await authClient.isAuthenticated();
  const headers = new Headers(init.headers);
  if (isAuthenticated) {
    headers.set('Authorization', `Bearer ${await authClient.getToken()}`);
  }
  // And if we're submitting `FormData`, let the browser set the content-type automatically
  // This allows files to upload properly. Otherwise, we assume it's JSON.
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  // And finally, we'll set the headers back on the request
  init.headers = headers;

  // Make API call
  const response = await fetch(apiClient.getApiUrl() + path, init);

  // Handle response if a server error is returned
  if (!response.ok) {
    const error = await createAPIError('Unsuccessful response', response, init.method);
    throw error;
  }

  // Handle if the response is not JSON
  const json = await response.json().catch(async () => {
    const error = await createAPIError('Not a JSON body', response, init.method);
    throw error;
  });

  // Compare the response to the expected schema
  const result = schema.safeParse(json);
  if (!result.success) {
    console.error(result.error);
    const error = await createAPIError('Unexpected response schema', response, init.method);
    throw error;
  }

  return result.data;
}

interface IAPIError {
  status: number;
  details: string;
  method?: string;
}
class APIError extends Error {
  status: number;
  details: string;
  method?: string;

  constructor(message: string, { status, method, details }: IAPIError) {
    super(message);
    this.status = status;
    this.details = details;
    this.method = method;
    this.name = 'APIError';
  }
}

async function createAPIError(reason: string, response: Response, method?: string) {
  const status = response.status;
  let details = '';

  try {
    const json = await response.json();
    details = json.error && json.error.message ? json.error.message : '';
  } catch (e) {
    details = await response.text().catch(() => 'Response .text() cannot be parsed.');
  }

  const sentryMessage = `fetchFromApi error: ${method} ${response.url} ${response.status}. ${reason}`;
  Sentry.captureException({ message: sentryMessage });

  return new APIError(reason, { status, details, method });
}

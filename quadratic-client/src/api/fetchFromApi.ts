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
    const error = await newHTTPError('Unsuccessful response', response, init.method);
    throw error;
  }

  // Handle if the response is not JSON
  const json = await response.json().catch(async () => {
    const error = await newHTTPError('Not a JSON body', response, init.method);
    throw error;
  });

  // Compare the response to the expected schema
  const result = schema.safeParse(json);
  if (!result.success) {
    console.error(result.error);
    const error = await newHTTPError('Unexpected response schema', response, init.method);
    throw error;
  }

  return result.data;
}

async function newHTTPError(reason: string, response: Response, method?: string) {
  const text = await response.text().catch(() => `Response .text() cannot be parsed.`);
  const message = `Error fetching ${method} ${response.url} ${response.status}. ${reason}`;
  console.error(`${message}. Response body: ${text}`);
  Sentry.captureException({ message });
  return new Error(message);
}

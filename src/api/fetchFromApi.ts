import * as Sentry from '@sentry/react';
import z from 'zod';
import { authClient } from '../auth';
import { apiClient } from './apiClient';

export async function fetchFromApi<T>(path: string, init: RequestInit, schema: z.Schema<T>): Promise<T> {
  // Set headers
  const isAuthenticated = await authClient.isAuthenticated();
  const sharedInit = {
    headers: {
      // 'Content-Type': content_type, TODO: verify this doesn't break anything, browser seems to figure it out
      // Only pass the auth if the user is auth'd
      ...(isAuthenticated ? { Authorization: `Bearer ${await authClient.getToken()}` } : {}),
    },
  };

  // Make API call
  const response = await fetch(apiClient.getApiUrl() + path, { ...sharedInit, ...init });

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

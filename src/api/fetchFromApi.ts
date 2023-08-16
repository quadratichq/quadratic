import * as Sentry from '@sentry/react';
import z from 'zod';
import { authClient } from '../auth';

if (!process.env.REACT_APP_QUADRATIC_API_URL) {
  throw new Error('REACT_APP_QUADRATIC_API_URL not set');
}

export const API_URL = process.env.REACT_APP_QUADRATIC_API_URL;

export async function fetchFromApi<T>(path: string, init: RequestInit, schema: z.Schema<T>): Promise<T> {
  // Set headers
  const token = await authClient.getToken();
  const sharedInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Make API call
  const response = await fetch(API_URL + path, { ...sharedInit, ...init });

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
    const error = await newHTTPError('Unexpected response schema', response, init.method);
    throw error;
  }

  return result.data;
}

async function newHTTPError(reason: string, response: Response, method?: string) {
  const text = await response?.text().catch(() => null);
  const message = `Error fetching ${method} ${response.url} ${response.status}. ${reason}`;
  console.error(`${message}. Response body: ${text}`);
  Sentry.captureException({ message });
  return new Error(message);
}

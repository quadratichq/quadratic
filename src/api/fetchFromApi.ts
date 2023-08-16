import * as Sentry from '@sentry/react';
import z from 'zod';
import { authClient } from '../auth';

if (!process.env.REACT_APP_QUADRATIC_API_URL) {
  throw new Error('REACT_APP_QUADRATIC_API_URL not set');
}

export const API_URL = process.env.REACT_APP_QUADRATIC_API_URL;

export async function fetchFromApi<T>(path: string, init: RequestInit, schema: z.Schema<T>): Promise<T> {
  // Options shared amongst all fetches
  const token = await authClient.getToken();
  const sharedInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(API_URL + path, { ...sharedInit, ...init });

  if (!response.ok) {
    const error = await newHTTPError('Unsuccessful response', response, init.method);
    throw error;
  }

  const json = await response.json().catch(async () => {
    const error = await newHTTPError('Not a JSON body', response, init.method);
    throw error;
  });

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

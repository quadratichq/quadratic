import { authClient } from '@/auth';
import * as Sentry from '@sentry/react';
import axios, { AxiosError, AxiosProgressEvent, AxiosRequestConfig } from 'axios';
import z from 'zod';

import { apiClient } from './apiClient';

export class ApiError extends Error {
  status: number;
  details?: string;
  method?: string;

  constructor(message: string, status: number, method?: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // Fetch response status code
    this.method = method; // Fetch request method
    this.details = details; // Details usefule for debugging
  }
}

export async function axiosFromApi<T>(
  path: string,
  config: AxiosRequestConfig,
  schema: z.Schema<T>,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
  onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<z.infer<typeof schema>> {
  try {
    // We'll automatically inject additional headers to the request, starting with auth
    const isAuthenticated = await authClient.isAuthenticated();
    const token = isAuthenticated ? await authClient.getTokenOrRedirect() : '';
    const headers: Record<string, string> = { ...(config.headers as Record<string, string>) };
    if (isAuthenticated) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // And if we're submitting `FormData`, let the browser set the content-type automatically
    // This allows files to upload properly. Otherwise, we assume it's JSON.
    if (!(config.data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Make API call
    const url = apiClient.getApiUrl() + path;
    const response = await axios({
      ...config,
      url,
      headers,
      onUploadProgress,
      onDownloadProgress,
    });

    // Compare the response to the expected schema
    const result = schema.safeParse(response.data);
    if (!result.success) {
      console.error(`Zod schema validation failed at: ${path}`, JSON.stringify(result.error, null, 2));

      const details = JSON.stringify(result.error);
      throw new ApiError('Unexpected response schema', response.status, config.method, details);
    }

    return result.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      let details = 'No detailed error message provided';

      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        if (data.error?.message) {
          details = data.error.message;
        } else if (data.errors) {
          details = JSON.stringify(data.errors);
        }
      }

      throw new ApiError(
        `Failed to fetch ${axiosError.config?.url}`,
        axiosError.response?.status || 500,
        axiosError.config?.method,
        details
      );
    }

    Sentry.captureException(error);
    throw new ApiError('An unknown error occurred', 500, config.method);
  }
}

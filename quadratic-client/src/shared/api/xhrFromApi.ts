import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { ApiError } from '@/shared/api/fetchFromApi';
import { captureException } from '@sentry/react';
import type z from 'zod';

interface XhrRequestConfig {
  method: string;
  headers?: Record<string, string>;
  data?: any;
  abortController?: AbortController;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

export async function xhrFromApi<T>(
  path: string,
  config: XhrRequestConfig,
  schema: z.Schema<T>
): Promise<z.infer<typeof schema>> {
  const { method, data, abortController, onUploadProgress, onDownloadProgress } = config;
  return new Promise(async (resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = apiClient.getApiUrl() + path;

    xhr.open(method, url, true);

    // Set up headers
    const isAuthenticated = await authClient.isAuthenticated();
    const skipRedirect = window.location.pathname.includes('/login-result');
    const token = isAuthenticated ? await authClient.getTokenOrRedirect(skipRedirect) : '';
    const headers: Record<string, string> = { ...config.headers };
    if (isAuthenticated && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    // Set up abort handler
    abortController?.signal.addEventListener('abort', () => xhr.abort());

    // Set up progress handlers
    if (onUploadProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onUploadProgress(event.loaded / event.total);
        }
      };
    }
    if (onDownloadProgress) {
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          onDownloadProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      // Check if the response status indicates an error
      if (xhr.status >= 400) {
        let details = 'No detailed error message provided';
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.error?.message) {
            details = json.error.message;
          } else if (json.errors) {
            details = JSON.stringify(json.errors);
          } else {
            details = JSON.stringify(json);
          }
        } catch (error) {
          // If parsing fails, use the raw response text
          details = xhr.responseText;
        }
        reject(new ApiError(`Request failed with status ${xhr.status}`, xhr.status, method, details));
        return;
      }

      try {
        const json = JSON.parse(xhr.responseText);
        const result = schema.safeParse(json);
        if (result.success) {
          resolve(result.data);
        } else {
          console.error(`Zod schema validation failed at: ${path}`, JSON.stringify(result.error, null, 2));
          reject(new ApiError('Unexpected response schema', xhr.status, method, JSON.stringify(result.error)));
        }
      } catch (error) {
        captureException(error);
        reject(new ApiError('An unknown error occurred: response is not JSON.', xhr.status, method));
      }
    };

    xhr.onerror = () => {
      let details = 'No detailed error message provided';
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.error?.message) {
          details = json.error.message;
        } else if (json.errors) {
          details = JSON.stringify(json.errors);
        }
      } catch (error) {
        // If parsing fails, use the raw response text
        details = xhr.responseText;
      }
      reject(new ApiError(`Failed to fetch ${url}`, xhr.status, method, details));
    };

    xhr.onabort = () => {
      reject(new ApiError('Request aborted', 499, method));
    };

    xhr.ontimeout = () => {
      reject(new ApiError('Request timed out', xhr.status, method));
    };

    // Send the request
    if (data instanceof FormData) {
      xhr.send(data);
    } else if (data) {
      xhr.send(JSON.stringify(data));
    } else {
      xhr.send();
    }
  });
}

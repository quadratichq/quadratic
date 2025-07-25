//! License Client
//!
//! Modifying this license check is violating the Quadratic Terms and Conditions and is stealing software, and we will come after you.

import axios from 'axios';
import { LicenseSchema } from 'quadratic-shared/typesAndSchemas';
import { convertError } from 'quadratic-shared/utils/error';
import type z from 'zod';
import dbClient from './dbClient';
import { LICENSE_API_URI, LICENSE_KEY } from './env-vars';
import { ApiError } from './utils/ApiError';
import { hash } from './utils/crypto';

type LicenseResponse = z.infer<typeof LicenseSchema>;

let cachedResult: LicenseResponse | null = null;
let lastCheckedTime: number | null = null;
const cacheDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
// const cacheDuration = 0; // disable the cache for testing

export const licenseClient = {
  post: async (seats: number): Promise<LicenseResponse | null> => {
    try {
      const body = { stats: { seats } };
      const response = await axios.post(`${LICENSE_API_URI}/api/license/${LICENSE_KEY}`, body);

      return LicenseSchema.parse(response.data) as LicenseResponse;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          JSON.stringify({
            message: 'Failed to get the license info from the license service',
            error: convertError(error),
          })
        );
        throw new ApiError(402, 'Failed to get the license info from the license service');
      }

      return null;
    }
  },
  checkFromServer: async (): Promise<LicenseResponse | null> => {
    // NOTE: Modifying this license check is violating the Quadratic Terms and Conditions and is stealing software, and we will come after you.
    if (hash(LICENSE_KEY) === '2ef876ddfe6cc783b83ac63cbef0ae84e6807c69fa72066801f130706e2a935a') {
      return licenseClient.adminLicenseResponse();
    }

    const userCount = await dbClient.user.count();

    return licenseClient.post(userCount);
  },
  adminLicenseResponse: async (): Promise<LicenseResponse | null> => {
    return {
      limits: {
        seats: 100000000000,
      },
      status: 'active',
    };
  },
  /**
   *
   * @param force boolean to force a license check (ignoring the cache)
   * @returns
   */
  check: async (force: boolean): Promise<LicenseResponse | null> => {
    const currentTime = Date.now();

    if (!force && cachedResult && lastCheckedTime && currentTime - lastCheckedTime < cacheDuration) {
      // Use cached result if within the cache duration
      return cachedResult;
    }
    // Otherwise, perform the check
    const result = await licenseClient.checkFromServer();

    // don't cache errors or non-active licenses
    if (!result || result.status === 'revoked') {
      return null;
    }

    // Cache the result and update the last checked time
    cachedResult = result;
    lastCheckedTime = currentTime;

    return result;
  },
};

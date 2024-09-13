//! License Client
//!
//! Modifying this license check is violating the Quadratic Terms and Conditions and is stealing software, and we will come after you.

import axios from 'axios';
import { LicenseSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from './dbClient';
import { LICENSE_API_URI, LICENSE_KEY } from './env-vars';

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
    } catch (err) {
      if (err instanceof Error) {
        console.error('Failed to get the license info from the license service', err.message);
      }

      return null;
    }
  },
  checkFromServer: async (): Promise<LicenseResponse | null> => {
    const userCount = await dbClient.user.count();

    return licenseClient.post(userCount);
  },
  check: async (): Promise<LicenseResponse | null> => {
    const currentTime = Date.now();

    if (cachedResult && lastCheckedTime && currentTime - lastCheckedTime < cacheDuration) {
      // Use cached result if within the cache duration
      return cachedResult;
    }

    // Otherwise, perform the check
    const result = await licenseClient.checkFromServer();

    // don't cache errors or non-active licenses
    if (!result || result.status !== 'active') {
      return null;
    }

    // Cache the result and update the last checked time
    cachedResult = result;
    lastCheckedTime = currentTime;

    return result;
  },
};

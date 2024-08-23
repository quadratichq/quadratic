import axios from 'axios';
import { LicenseSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { LICENSE_API_URI, LICENSE_KEY } from './env-vars';

type LicenseResponse = z.infer<typeof LicenseSchema>;

export const licenseClient = {
  license: {
    post: async (seats: number): Promise<LicenseResponse | null> => {
      try {
        const body = { stats: { seats } };
        const response = await axios.post(`${LICENSE_API_URI}/api/license/${LICENSE_KEY}`, body);
        return LicenseSchema.parse(response.data) as LicenseResponse;
      } catch (err) {
        console.error('Failed to get the license info from the license service', err);
        return null;
      }
    },
  },
};

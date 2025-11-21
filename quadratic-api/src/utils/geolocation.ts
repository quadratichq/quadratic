import type { Request } from 'express';
import geoip from 'geoip-lite';
import { isLocalHostAddress } from 'quadratic-shared/typesAndSchemasConnections';
import { RESTRICTED_MODEL_COUNTRIES } from '../env-vars';
import logger from './logger';

/**
 * Extracts the IP address from an Express request.
 * Checks x-forwarded-for header first (for proxied requests), then falls back to req.ip
 */
export function getIpFromRequest(req: Request): string {
  // Check x-forwarded-for header (common when behind proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : forwardedFor[0];
    return ip;
  }

  // Fall back to req.ip
  return req.ip || 'unknown';
}

/**
 * Gets the country code from an IP address using geoip-lite
 * @param ip - The IP address to lookup
 * @returns The country code (e.g., 'US', 'GB', 'DE') or 'unknown' if not found
 */
export function getCountryFromIp(ip: string): string {
  try {
    if (!ip || isLocalHostAddress(ip)) {
      return 'localdev';
    }

    // Remove IPv6 prefix if present (e.g., "::ffff:192.168.1.1" -> "192.168.1.1")
    const cleanIp = ip.replace(/^::ffff:/, '');

    const geo = geoip.lookup(cleanIp);

    if (geo && geo.country) {
      return geo.country;
    }

    return 'unknown';
  } catch (error) {
    logger.error('Error in getCountryFromIp', { ip, error });
    return 'unknown';
  }
}

/**
 * Checks if the request originates from a restricted country for model access.
 * @param req - The Express request object
 * @param isOnPaidPlan - Optional flag indicating if the user is on a paid plan. If true, restrictions are ignored.
 * @returns True if the country is restricted, false otherwise
 */
export function isRestrictedModelCountry(req: Request, isOnPaidPlan?: boolean): boolean {
  // If user is on a paid plan, ignore country restrictions
  if (isOnPaidPlan) {
    return false;
  }

  const ip = getIpFromRequest(req);
  const countryCode = getCountryFromIp(ip);
  if (!RESTRICTED_MODEL_COUNTRIES) {
    return false;
  }
  const restrictedCountries = RESTRICTED_MODEL_COUNTRIES.split(',').map((c) => c.trim().toUpperCase());
  return restrictedCountries.includes(countryCode.toUpperCase());
}

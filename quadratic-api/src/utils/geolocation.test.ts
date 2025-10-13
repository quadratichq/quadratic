import type { Request } from 'express';
import geoip from 'geoip-lite';
import { getCountryFromIp, getIpFromRequest, isRestrictedModelCountry } from './geolocation';

// Mock geoip-lite
jest.mock('geoip-lite');
const mockGeoip = geoip as jest.Mocked<typeof geoip>;

// Mock logger to avoid console output during tests
jest.mock('./logger', () => ({
  error: jest.fn(),
}));

// Mock env-vars
let mockRestrictedCountries = '';
jest.mock('../env-vars', () => ({
  get RESTRICTED_MODEL_COUNTRIES() {
    return mockRestrictedCountries;
  },
}));

describe('getIpFromRequest', () => {
  it('should return IP from x-forwarded-for header (string)', () => {
    const req = {
      headers: {
        'x-forwarded-for': '192.168.1.100',
      },
      ip: '10.0.0.1',
    } as unknown as Request;

    const result = getIpFromRequest(req);
    expect(result).toBe('192.168.1.100');
  });

  it('should return first IP from x-forwarded-for header with multiple IPs', () => {
    const req = {
      headers: {
        'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1',
      },
      ip: '10.0.0.1',
    } as unknown as Request;

    const result = getIpFromRequest(req);
    expect(result).toBe('192.168.1.100');
  });

  it('should return first IP from x-forwarded-for header (array)', () => {
    const req = {
      headers: {
        'x-forwarded-for': ['192.168.1.100', '10.0.0.1'],
      },
      ip: '10.0.0.1',
    } as unknown as Request;

    const result = getIpFromRequest(req);
    expect(result).toBe('192.168.1.100');
  });

  it('should trim whitespace from x-forwarded-for IP', () => {
    const req = {
      headers: {
        'x-forwarded-for': '  192.168.1.100  , 10.0.0.1',
      },
      ip: '10.0.0.1',
    } as unknown as Request;

    const result = getIpFromRequest(req);
    expect(result).toBe('192.168.1.100');
  });

  it('should fall back to req.ip when x-forwarded-for is not present', () => {
    const req = {
      headers: {},
      ip: '10.0.0.1',
    } as unknown as Request;

    const result = getIpFromRequest(req);
    expect(result).toBe('10.0.0.1');
  });

  it('should return "unknown" when neither x-forwarded-for nor req.ip is present', () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const result = getIpFromRequest(req);
    expect(result).toBe('unknown');
  });
});

describe('getCountryFromIp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return country code for valid IP', () => {
    const ip = '8.8.8.8';
    mockGeoip.lookup.mockReturnValue({
      range: [134744064, 134744071],
      country: 'US',
      region: '',
      eu: '0',
      timezone: 'America/Chicago',
      city: '',
      ll: [37.751, -97.822],
      metro: 0,
      area: 5000,
    });

    const result = getCountryFromIp(ip);
    expect(result).toBe('US');
    expect(mockGeoip.lookup).toHaveBeenCalledWith('8.8.8.8');
  });

  it('should return "localdev" for localhost IP addresses', () => {
    const localhostIps = ['127.0.0.1', 'localhost', '::1'];

    localhostIps.forEach((ip) => {
      const result = getCountryFromIp(ip);
      expect(result).toBe('localdev');
    });

    // geoip.lookup should not be called for localhost
    expect(mockGeoip.lookup).not.toHaveBeenCalled();
  });

  it('should handle IPv6 prefix correctly', () => {
    const ip = '::ffff:8.8.8.8';
    mockGeoip.lookup.mockReturnValue({
      range: [134744064, 134744071],
      country: 'GB',
      region: '',
      eu: '1',
      timezone: 'Europe/London',
      city: '',
      ll: [51.5074, -0.1278],
      metro: 0,
      area: 1000,
    });

    const result = getCountryFromIp(ip);
    expect(result).toBe('GB');
    // Should be called with cleaned IP (without ::ffff: prefix)
    expect(mockGeoip.lookup).toHaveBeenCalledWith('8.8.8.8');
  });

  it('should return "unknown" for empty IP', () => {
    const result = getCountryFromIp('');
    expect(result).toBe('localdev');
    expect(mockGeoip.lookup).not.toHaveBeenCalled();
  });

  it('should return "unknown" when geoip lookup returns null', () => {
    const ip = '192.168.1.1';
    mockGeoip.lookup.mockReturnValue(null);

    const result = getCountryFromIp(ip);
    expect(result).toBe('unknown');
    expect(mockGeoip.lookup).toHaveBeenCalledWith('192.168.1.1');
  });

  it('should return "unknown" when geoip lookup returns object without country', () => {
    const ip = '192.168.1.1';
    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: '',
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = getCountryFromIp(ip);
    expect(result).toBe('unknown');
  });

  it('should return "unknown" and log error when geoip.lookup throws', () => {
    const ip = '8.8.8.8';
    mockGeoip.lookup.mockImplementation(() => {
      throw new Error('Lookup failed');
    });

    const result = getCountryFromIp(ip);
    expect(result).toBe('unknown');
  });

  it('should handle various country codes', () => {
    const testCases = [
      { ip: '8.8.8.8', country: 'US' },
      { ip: '212.58.246.79', country: 'GB' },
      { ip: '88.198.23.45', country: 'DE' },
      { ip: '202.12.27.33', country: 'CN' },
      { ip: '103.28.248.1', country: 'IN' },
    ];

    testCases.forEach(({ ip, country }) => {
      mockGeoip.lookup.mockReturnValue({
        range: [0, 0],
        country,
        region: '',
        eu: '0',
        timezone: '',
        city: '',
        ll: [0, 0],
        metro: 0,
        area: 0,
      });

      const result = getCountryFromIp(ip);
      expect(result).toBe(country);
    });
  });
});

describe('isRestrictedModelCountry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock before each test
    mockRestrictedCountries = '';
  });

  it('should return false when RESTRICTED_MODEL_COUNTRIES is not set', () => {
    mockRestrictedCountries = '';

    const req = {
      headers: {
        'x-forwarded-for': '8.8.8.8',
      },
      ip: '8.8.8.8',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: 'US',
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(false);
  });

  it('should return true when country is in restricted list', () => {
    mockRestrictedCountries = 'CN,RU,IR';

    const req = {
      headers: {
        'x-forwarded-for': '202.12.27.33',
      },
      ip: '202.12.27.33',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: 'CN',
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(true);
  });

  it('should return false when country is not in restricted list', () => {
    mockRestrictedCountries = 'CN,RU,IR';

    const req = {
      headers: {
        'x-forwarded-for': '8.8.8.8',
      },
      ip: '8.8.8.8',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: 'US',
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(false);
  });

  it('should handle case-insensitive country code matching', () => {
    mockRestrictedCountries = 'cn,ru,ir';

    const req = {
      headers: {
        'x-forwarded-for': '202.12.27.33',
      },
      ip: '202.12.27.33',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: 'CN', // Uppercase
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(true);
  });

  it('should return false for localdev country', () => {
    mockRestrictedCountries = 'CN,RU,IR';

    const req = {
      headers: {
        'x-forwarded-for': '127.0.0.1',
      },
      ip: '127.0.0.1',
    } as unknown as Request;

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(false);
  });

  it('should return false for unknown country', () => {
    mockRestrictedCountries = 'CN,RU,IR';

    const req = {
      headers: {
        'x-forwarded-for': '192.168.1.1',
      },
      ip: '192.168.1.1',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue(null);

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(false);
  });

  it('should extract IP from x-forwarded-for and check restriction', () => {
    mockRestrictedCountries = 'RU';

    const req = {
      headers: {
        'x-forwarded-for': '5.45.207.0, 10.0.0.1',
      },
      ip: '10.0.0.1',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: 'RU',
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(true);
  });

  it('should handle empty restricted countries list', () => {
    mockRestrictedCountries = '';

    const req = {
      headers: {
        'x-forwarded-for': '8.8.8.8',
      },
      ip: '8.8.8.8',
    } as unknown as Request;

    mockGeoip.lookup.mockReturnValue({
      range: [0, 0],
      country: 'US',
      region: '',
      eu: '0',
      timezone: '',
      city: '',
      ll: [0, 0],
      metro: 0,
      area: 0,
    });

    const result = isRestrictedModelCountry(req);
    expect(result).toBe(false);
  });
});

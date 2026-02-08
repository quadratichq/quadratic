const { multerS3Storage } = require('./src/storage/s3');

// For auth we expect the following Authorization header format:
// Bearer ValidToken {user.sub} or Bearer ValidToken {user.sub} {user.email}
jest.mock('./src/middleware/validateAccessToken', () => {
  return {
    validateAccessToken: jest.fn().mockImplementation(async (req, res, next) => {
      const authHeader = req.headers?.authorization?.trim();
      // Accept "Bearer ValidToken ..." (case-insensitive) so env/HTTP stack cannot break tests
      if (authHeader?.toLowerCase().startsWith('bearer validtoken')) {
        const payload = authHeader.substring(17).trim(); // after "Bearer ValidToken"
        const [sub, emailStr] = payload.split(/\s+/);
        const email = (emailStr ? emailStr : `${sub}@test.com`).toLowerCase();
        req.auth = {
          sub: sub ?? '',
          email,
        };
        return next();
      } else {
        return res.status(401).json({ error: { message: 'No authorization token was found' } });
      }
    }),
  };
});

const licenseClientResponse = {
  limits: {
    seats: 10,
  },
  status: 'active',
};

jest.mock('./src/licenseClient', () => {
  return {
    licenseClient: {
      post: async () => licenseClientResponse,
      checkFromServer: async () => licenseClientResponse,
      check: async () => licenseClientResponse,
    },
  };
});

jest.mock('./src/storage/storage', () => {
  return {
    s3Client: {},
    getFileUrl: jest.fn().mockImplementation(async (str) => 'https://' + str),
    getPresignedFileUrl: jest.fn().mockImplementation(async (str) => 'https://' + str),
    uploadFile: jest.fn().mockImplementation(async () => {
      return { bucket: 'test-bucket', key: 'test-key' };
    }),
    uploadMiddleware: multerS3Storage,
  };
});

jest.mock('./src/stripe/stripe', () => {
  return {
    stripe: {
      coupons: {
        create: jest.fn().mockResolvedValue({ id: 'coupon_test123' }),
      },
      subscriptions: {
        update: jest.fn().mockResolvedValue({}),
      },
    },
    updateBilling: jest.fn().mockImplementation(async () => {}),
    updateCustomer: jest.fn().mockImplementation(async () => {}),
    updateSeatQuantity: jest.fn().mockImplementation(async () => {}),
    getIsMonthlySubscription: jest.fn().mockResolvedValue(false),
  };
});

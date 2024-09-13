const { multerS3Storage } = require('./src/storage/s3');

// For auth we expect the following Authorization header format:
// Bearer ValidToken {user.sub}
jest.mock('./src/middleware/validateAccessToken', () => {
  return {
    validateAccessToken: jest.fn().mockImplementation(async (req, res, next) => {
      // expected format is `Bearer ValidToken {user.sub}`
      if (req.headers.authorization?.substring(0, 17) === 'Bearer ValidToken') {
        req.auth = {
          sub: req.headers.authorization?.substring(18), // Extract user.sub from the Authorization header
        };
        return next();
      } else {
        return res.status(401).json({ error: { message: 'No authorization token was found' } });
      }
    }),
  };
});

jest.mock('./src/licenseClient', () => {
  return {
    post: async () => {
      return {
        limits: {
          seats: 10,
        },
        status: 'active',
      };
    },
  };
});

jest.mock('./src/storage/storage', () => {
  return {
    s3Client: {},
    getFileUrl: jest.fn().mockImplementation(async (str) => str),
    getPresignedFileUrl: jest.fn().mockImplementation(async (str) => str),
    uploadFile: jest.fn().mockImplementation(async () => {
      return { bucket: 'test-bucket', key: 'test-key' };
    }),
    uploadMiddleware: multerS3Storage,
  };
});

jest.mock('./src/stripe/stripe', () => {
  return {
    updateBillingIfNecessary: jest.fn().mockImplementation(async () => {}),
    updateCustomer: jest.fn().mockImplementation(async () => {}),
    updateSeatQuantity: jest.fn().mockImplementation(async () => {}),
  };
});

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

jest.mock('./src/aws/s3', () => {
  return {
    s3Client: {},
    generatePresignedUrl: jest.fn().mockImplementation(async (str) => str),
    uploadStringAsFileS3: jest.fn().mockImplementation(async () => {
      return { bucket: 'test-bucket', key: 'test-key' };
    }),
  };
});

import { auth0Mock } from '../../tests/auth0Mock';
jest.mock('auth0', () =>
  auth0Mock([
    {
      user_id: 'userHarvard',
      email: 'user@harvard.edu',
    },
    {
      user_id: 'userEligible',
      email: 'user@eligible-domain.com',
    },
    {
      user_id: 'userIneligible',
      email: 'user@ineligible-domain.com',
    },
  ])
);
jest.mock('quadratic-shared/sanityClient', () => ({
  sanityClient: {
    educationWhitelist: {
      get: jest.fn().mockImplementation(() => [
        {
          emailSuffix: 'user@eligible-domain.com',
        },
      ]),
    },
  },
}));

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb } from '../../tests/testDataGenerator';

beforeAll(async () => {
  await dbClient.user.create({
    data: {
      auth0Id: 'userHarvard',
      email: 'user@harvard.edu',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userEligible',
      email: 'user@eligible-domain.com',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userIneligible',
      email: 'user@ineligible-domain.com',
    },
  });
});

afterAll(clearDb);

describe('POST /v0/education', () => {
  describe('refresh education status', () => {
    it('marks an user from the universities list as enrolled', async () => {
      const { eduStatus } = await dbClient.user.findUniqueOrThrow({
        where: {
          auth0Id: 'userHarvard',
        },
      });
      expect(eduStatus).toBe(null);
      await request(app)
        .post('/v0/education')
        .set('Authorization', `Bearer ValidToken userHarvard user@harvard.edu`)
        .expect(200)
        .expect((res) => {
          expect(res.body.eduStatus).toBe('ENROLLED');
        });
    });

    it('marks a user eligible from sanity as enrolled', async () => {
      const { eduStatus } = await dbClient.user.findUniqueOrThrow({
        where: {
          auth0Id: 'userEligible',
        },
      });
      expect(eduStatus).toBe(null);
      await request(app)
        .post('/v0/education')
        .set('Authorization', `Bearer ValidToken userEligible user@eligible-domain.com`)
        .expect(200)
        .expect((res) => {
          expect(res.body.eduStatus).toBe('ENROLLED');
        });
    });

    it('marks an ineligible user as ineligible', async () => {
      const { eduStatus } = await dbClient.user.findUniqueOrThrow({
        where: {
          auth0Id: 'userIneligible',
        },
      });
      expect(eduStatus).toBe(null);
      await request(app)
        .post('/v0/education')
        .set('Authorization', `Bearer ValidToken userIneligible user@ineligible-domain.com`)
        .expect(200)
        .expect((res) => {
          expect(res.body.eduStatus).toBe('INELIGIBLE');
        });
    });
  });
});

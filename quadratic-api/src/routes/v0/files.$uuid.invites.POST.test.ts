import { auth0Mock } from '../../tests/auth0Mock';
jest.mock('auth0', () =>
  auth0Mock([
    {
      user_id: 'userOwner',
      email: 'owner@example.com',
    },
    {
      user_id: 'userEditor',
      email: 'editor@example.com',
    },
    {
      user_id: 'userViewer',
      email: 'userviewer@example.com',
    },
    {
      user_id: 'userNoRole',
      email: 'norole@example.com',
    },
    {
      user_id: 'duplicate_emails_user_1',
      email: 'duplicate@example.com',
    },
    {
      user_id: 'duplicate_emails_user_2',
      email: 'duplicate@example.com',
    },
    {
      user_id: 'userNotYetInDb',
      email: 'nodb@example.com',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  // Create some users & team
  const userOwner = await createUser({
    auth0Id: 'userOwner',
  });
  const userEditor = await createUser({
    auth0Id: 'userEditor',
  });
  const userViewer = await createUser({
    auth0Id: 'userViewer',
  });
  await createUser({
    auth0Id: 'userNoRole',
  });

  const team = await createTeam({
    users: [{ userId: userOwner.id, role: 'OWNER' }],
  });

  await createFile({
    data: {
      name: 'Personal File',
      uuid: '00000000-0000-4000-8000-000000000001',
      creatorUserId: userOwner.id,
      ownerUserId: userOwner.id,
      ownerTeamId: team.id,
      UserFileRole: {
        create: [
          { userId: userEditor.id, role: 'EDITOR' },
          { userId: userViewer.id, role: 'VIEWER' },
        ],
      },
      FileInvite: {
        create: [{ email: 'invite@example.com', role: 'EDITOR' }],
      },
    },
  });
});

afterEach(clearDb);

const expectUser = (res: request.Response) => {
  expect(typeof res.body.userId).toBe('number');
  expect(typeof res.body.role).toBe('string');
  expect(typeof res.body.id).toBe('number');
};
const expectInvite = (res: request.Response) => {
  expect(typeof res.body.email).toBe('string');
  expect(typeof res.body.role).toBe('string');
  expect(typeof res.body.id).toBe('number');
};

const invite = (payload: any, user: string, url = '/v0/files/00000000-0000-4000-8000-000000000001/invites') => {
  return request(app)
    .post(url)
    .send(payload)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ValidToken ${user}`)
    .expect('Content-Type', /json/);
};

describe('POST /v0/files/:uuid/invites', () => {
  describe('sending a bad request', () => {
    it('rejects for failing schema validation on the file UUID', async () => {
      await invite({ email: 'test@example.com', role: 'OWNER' }, 'userOwner', '/v0/files/foo/invites')
        .expect(400)
        .expect(expectError);
    });
    it('rejects for failing schema validation on the payload', async () => {
      await invite({ role: 'EDITOR' }, 'userOwner').expect(400).expect(expectError);
    });
    it('rejects for sending a bad email', async () => {
      await invite({ email: ' blahgmail.com ', role: 'EDITOR' }, 'userOwner').expect(400).expect(expectError);
    });
    it('rejects for sending a bad role', async () => {
      await invite({ email: 'test@gmail.com', role: 'OWNER' }, 'userOwner').expect(400).expect(expectError);
    });
  });

  describe('permissioning', () => {
    it('rejects inviting someone if you don’t have permission', async () => {
      await invite({ email: 'somebody@example.com', role: 'EDITOR' }, 'userViewer').expect(403).expect(expectError);
    });
    it('creates an invite for someone if you have permission', async () => {
      await invite({ email: 'somebody@example.com', role: 'EDITOR' }, 'userEditor').expect(201).expect(expectInvite);
    });
    it('adds a user to the file if you have permission', async () => {
      await invite({ email: 'norole@example.com', role: 'EDITOR' }, 'userOwner').expect(200).expect(expectUser);
    });

    describe('publicly editable file', () => {
      beforeEach(async () => {
        await dbClient.file.update({
          where: { uuid: '00000000-0000-4000-8000-000000000001' },
          data: { publicLinkAccess: 'EDIT' },
        });
      });
      it('adds yourself if the file is publicly editable', async () => {
        await invite({ email: 'norole@example.com', role: 'EDITOR' }, 'userNoRole').expect(200).expect(expectUser);
      });
      it('creates an invite for someone even if you’re just a viewer', async () => {
        await invite({ email: 'somebody@example.com', role: 'EDITOR' }, 'userViewer').expect(201).expect(expectInvite);
      });
    });
  });

  describe('inviting people already associated with the file', () => {
    it('rejects inviting yourself as the file owner', async () => {
      await invite({ email: 'owner@example.com', role: 'EDITOR' }, 'userOwner').expect(400).expect(expectError);
    });
    it('rejects inviting the file owner', async () => {
      await invite({ email: 'owner@example.com', role: 'EDITOR' }, 'userEditor').expect(400).expect(expectError);
    });
    it('rejects inviting yourself as an existing user', async () => {
      await invite({ email: 'editor@example.com', role: 'EDITOR' }, 'userEditor').expect(409).expect(expectError);
    });
    it('rejects inviting another existing user', async () => {
      await invite({ email: 'editor@example.com', role: 'EDITOR' }, 'userOwner').expect(409).expect(expectError);
    });
    it('rejects inviting an email associated with an existing invite', async () => {
      await invite({ email: 'invite@example.com', role: 'VIEWER' }, 'userOwner').expect(409).expect(expectError);
    });
    it('rejects inviting an email associated with multiple accounts', async () => {
      await invite({ email: 'duplicate@example.com', role: 'VIEWER' }, 'userOwner').expect(500).expect(expectError);
    });
  });

  describe('inviting people who already have a Quadratic account', () => {
    it('creates an invite for a user who exists in auth0 but not yet our database', async () => {
      await invite({ email: 'nodb@example.com', role: 'VIEWER' }, 'userOwner').expect(201).expect(expectInvite);
    });
    it('adds a user to the file', async () => {
      await invite({ email: 'norole@example.com', role: 'EDITOR' }, 'userEditor').expect(200).expect(expectUser);
    });
    it('rejects for a user in auth0 without an ID', async () => {
      await invite({ email: 'norole@example.com', role: 'EDITOR' }, 'userEditor').expect(200).expect(expectUser);
    });
  });

  describe('inviting people who don’t have a Quadratic account', () => {
    it('creates an invite', async () => {
      await invite({ email: 'somebody@example.com', role: 'EDITOR' }, 'userOwner').expect(201).expect(expectInvite);
    });
  });

  describe('inviting based on case sensitivity', () => {
    it('transforms email to lowercase and creates an invite', async () => {
      await invite({ email: 'ALL_CAPS_EMAIL@EXAMPLE.COM', role: 'EDITOR' }, 'userOwner')
        .expect(201)
        .expect(expectInvite)
        .expect((res) => {
          expect(res.body.email).toBe('all_caps_email@example.com');
        });
    });
    it('transforms email to lowercase and finds existing invite', async () => {
      await invite({ email: 'INVITE@example.com', role: 'EDITOR' }, 'userOwner').expect(409).expect(expectError);
    });
    it('finds existing users through auth0 based on case insensitivity', async () => {
      await invite({ email: 'EDITOR@EXAMPLE.com', role: 'EDITOR' }, 'userOwner').expect(409).expect(expectError);
    });
  });
});

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError, getUserIdByAuth0Id } from '../../tests/helpers';
import { clearDb } from '../../tests/testDataGenerator';

beforeEach(async () => {
  // Create some users
  const userOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner',
      email: 'userOwner@test.com',
    },
  });
  const userEditor = await dbClient.user.create({
    data: {
      auth0Id: 'userEditor',
      email: 'userEditor@test.com',
    },
  });
  const userEditor2 = await dbClient.user.create({
    data: {
      auth0Id: 'userEditor2',
      email: 'userEditor2@test.com',
    },
  });
  const userViewer = await dbClient.user.create({
    data: {
      auth0Id: 'userViewer',
      email: 'userViewer@test.com',
    },
  });
  const userViewer2 = await dbClient.user.create({
    data: {
      auth0Id: 'userViewer2',
      email: 'userViewer2@test.com',
    },
  });
  const userOwner2 = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner2',
      email: 'userOwner2@test.com',
    },
  });

  // Create a team with one owner and one with two
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      UserTeamRole: {
        create: [
          {
            userId: userOwner.id,
            role: 'OWNER',
          },
          { userId: userEditor.id, role: 'EDITOR' },
          { userId: userEditor2.id, role: 'EDITOR' },
          { userId: userViewer.id, role: 'VIEWER' },
          { userId: userViewer2.id, role: 'VIEWER' },
        ],
      },
    },
  });
  await dbClient.team.create({
    data: {
      name: 'Test Team 2',
      uuid: '00000000-0000-4000-8000-000000000002',
      UserTeamRole: {
        create: [
          {
            userId: userOwner.id,
            role: 'OWNER',
          },
          { userId: userOwner2.id, role: 'OWNER' },
        ],
      },
    },
  });
});

afterEach(clearDb);

const expectRole = (role: string) => (res: any) => {
  expect(res.body.role).toBe(role);
};

describe('PATCH /v0/teams/:uuid/users/:userId', () => {
  describe('bad request', () => {
    it('responds with a 400 for an invalid user', async () => {
      await request(app)
        .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/foo')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 404 a user that doesn’t exist in the database', async () => {
      await request(app)
        .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/999999')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
    it('responds with a 404 a user that exists in the database but isn’t part of the team', async () => {
      const userId = await getUserIdByAuth0Id('userViewer');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000002/users/${userId}`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
  });

  describe('changing your own role', () => {
    it('accepts changing to the same role', async () => {
      const auth0Id = 'userOwner';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .send({ role: 'OWNER' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(200)
        .expect(expectRole('OWNER'));
    });

    it('rejects upgrading from VIEWER to EDITOR', async () => {
      const auth0Id = 'userViewer';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .send({ role: 'EDITOR' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(403)
        .expect(expectError);
    });
    it('rejects upgrading from VIEWER to OWNER', async () => {
      const auth0Id = 'userViewer';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .send({ role: 'OWNER' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(403)
        .expect(expectError);
    });
    it('rejects upgrading from EDITOR to OWNER', async () => {
      const auth0Id = 'userEditor';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .send({ role: 'OWNER' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(403)
        .expect(expectError);
    });

    it('rejects downgrading as OWNER when there’s only one on the team', async () => {
      const auth0Id = 'userOwner';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .send({ role: 'EDITOR' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(403)
        .expect(expectError);
    });
    it('accepts downgrading as OWNER when there’s more than one on the team', async () => {
      const auth0Id = 'userOwner';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000002/users/${userId}`)
        .send({ role: 'EDITOR' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(200)
        .expect(expectRole('EDITOR'));
    });

    it('accepts downgrading EDITOR -> VIEWER', async () => {
      const auth0Id = 'userEditor';
      const userId = await getUserIdByAuth0Id(auth0Id);
      await request(app)
        .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .send({ role: 'VIEWER' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(200)
        .expect(expectRole('VIEWER'));
    });
  });

  describe('changing the role of someone else', () => {
    describe('as OWNER', () => {
      it('accepts downgrading an OWNER', async () => {
        const userId = await getUserIdByAuth0Id('userOwner2');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000002/users/${userId}`)
          .send({ role: 'EDITOR' })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect(expectRole('EDITOR'));
      });
      it('accepts downgrading an EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userEditor');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'VIEWER' })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect(expectRole('VIEWER'));
      });
      it('accepts upgrading an EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userEditor');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'OWNER' })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect(expectRole('OWNER'));
      });
      it('accepts upgrading a VIEWER', async () => {
        const userId = await getUserIdByAuth0Id('userViewer');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'EDITOR' })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect(expectRole('EDITOR'));
      });
      it('accepts changing to the same role', async () => {
        const userId = await getUserIdByAuth0Id('userOwner2');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000002/users/${userId}`)
          .send({ role: 'OWNER' })
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect(200)
          .expect(expectRole('OWNER'));
      });
    });

    describe('as EDITOR', () => {
      it('rejects downgrading an OWNER', async () => {
        const userId = await getUserIdByAuth0Id('userOwner');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'EDITOR' })
          .set('Authorization', `Bearer ValidToken userEditor`)
          .expect(403)
          .expect(expectError);
      });
      it('accepts downgrading an EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userEditor2');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'VIEWER' })
          .set('Authorization', `Bearer ValidToken userEditor`)
          .expect(200)
          .expect(expectRole('VIEWER'));
      });
      it('rejects upgrading an EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userEditor');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'OWNER' })
          .set('Authorization', `Bearer ValidToken userEditor2`)
          .expect(403)
          .expect(expectError);
      });
      it('accepts upgrading a VIEWER to EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userViewer');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'VIEWER' })
          .set('Authorization', `Bearer ValidToken userEditor`)
          .expect(200)
          .expect(expectRole('VIEWER'));
      });
      it('rejects upgrading a VIEWER to OWNER', async () => {
        const userId = await getUserIdByAuth0Id('userViewer');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'OWNER' })
          .set('Authorization', `Bearer ValidToken userEditor`)
          .expect(403)
          .expect(expectError);
      });
      it('accepts changing to the same role', async () => {
        const userId = await getUserIdByAuth0Id('userEditor2');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'EDITOR' })
          .set('Authorization', `Bearer ValidToken userEditor`)
          .expect(200)
          .expect(expectRole('EDITOR'));
      });
    });

    describe('as VIEWER', () => {
      it('rejects upgrading a VIEWER', async () => {
        const userId = await getUserIdByAuth0Id('userViewer2');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'EDITOR' })
          .set('Authorization', `Bearer ValidToken userViewer`)
          .expect(403)
          .expect(expectError);
      });
      it('rejects upgrading an EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userEditor');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'OWNER' })
          .set('Authorization', `Bearer ValidToken userViewer`)
          .expect(403)
          .expect(expectError);
      });
      it('rejects downgrading an EDITOR', async () => {
        const userId = await getUserIdByAuth0Id('userEditor');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'VIEWER' })
          .set('Authorization', `Bearer ValidToken userViewer`)
          .expect(403)
          .expect(expectError);
      });
      it('rejects downgrading an OWNER', async () => {
        const userId = await getUserIdByAuth0Id('userOwner');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'EDITOR' })
          .set('Authorization', `Bearer ValidToken userViewer`)
          .expect(403)
          .expect(expectError);
      });
      it('rejects changing to the same role (as viewers can’t make any change)', async () => {
        const userId = await getUserIdByAuth0Id('userViewer2');
        await request(app)
          .patch(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
          .send({ role: 'VIEWER' })
          .set('Authorization', `Bearer ValidToken userViewer`)
          .expect(403)
          .expect(expectError);
      });
    });
  });
});

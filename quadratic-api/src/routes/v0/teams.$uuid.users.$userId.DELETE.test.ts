import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError, getUserIdByAuth0Id } from '../../tests/helpers';
import { clearDb, createFile, createTeam, createUsers } from '../../tests/testDataGenerator';

describe('DELETE /v0/teams/:uuid/users/:userId', () => {
  beforeEach(async () => {
    // Create some users
    const [user1, user2, user3, user4, user5, user6] = await createUsers([
      'user1',
      'user2',
      'user3',
      'user4',
      'user5',
      'user6',
    ]);
    // Create a team with one owner
    const team1 = await createTeam({
      team: {
        name: 'Test Team 1',
        uuid: '00000000-0000-4000-8000-000000000001',
      },
      users: [
        {
          userId: user1.id,
          role: 'OWNER',
        },
        { userId: user2.id, role: 'EDITOR' },
        { userId: user3.id, role: 'VIEWER' },
      ],
    });
    // Create a private file owned by user2
    await createFile({
      data: {
        name: 'My private file',
        uuid: '00000000-0000-2000-1000-000000000000',
        creatorUserId: user2.id,
        ownerTeamId: team1.id,
        ownerUserId: user2.id,
      },
    });

    // Create a team with 2 owners
    const team2 = await createTeam({
      team: {
        name: 'Test Team 2',
        uuid: '00000000-0000-4000-8000-000000000002',
      },
      users: [
        {
          userId: user1.id,
          role: 'OWNER',
        },
        { userId: user2.id, role: 'OWNER' },
        { userId: user3.id, role: 'EDITOR' },
        { userId: user4.id, role: 'EDITOR' },
        { userId: user5.id, role: 'VIEWER' },
        { userId: user6.id, role: 'VIEWER' },
      ],
    });
    // Create another private file owned by user2
    await createFile({
      data: {
        name: 'My private file',
        uuid: '00000000-0000-2000-1000-000000000001',
        creatorUserId: user2.id,
        ownerTeamId: team2.id,
        ownerUserId: user2.id,
      },
    });
  });

  afterEach(clearDb);

  describe('invalid request', () => {
    it('responds with a 404 for a valid user that doesn’t exist', async () => {
      await request(app)
        .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/245')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(404)
        .expect(expectError);
    });
    it('responds with a 400 for an invalid user', async () => {
      await request(app)
        .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/foo')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('deleting yourself', () => {
    it('allows a team viewer to remove themselves from a team', async () => {
      const userId = await getUserIdByAuth0Id('user3');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user3`)
        .expect(200)
        .expect((res) => expect(res.body.redirect).toBe(true));
    });
    it('allows owners to remove themselves from a team IF there’s at least one other owner', async () => {
      const userId = await getUserIdByAuth0Id('user1');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000002/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(200)
        .expect((res) => expect(res.body.redirect).toBe(true));
    });
    it('does not allow owners to remove themselves from a team IF they’re the only owner', async () => {
      const userId = await getUserIdByAuth0Id('user1');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(403)
        .expect(expectError);
    });
    it('makes any files you owned privately now public to the team', async () => {
      const userId = await getUserIdByAuth0Id('user2');
      const fileBefore = await dbClient.file.findUniqueOrThrow({
        where: {
          uuid: '00000000-0000-2000-1000-000000000000',
        },
      });
      expect(fileBefore.ownerUserId).toBe(userId);
      const allUserFilesBefore = await dbClient.file.findMany({
        where: {
          ownerUserId: userId,
        },
      });
      expect(allUserFilesBefore.length).toBe(2);

      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(200);

      const fileAfter = await dbClient.file.findUniqueOrThrow({
        where: {
          uuid: '00000000-0000-2000-1000-000000000000',
        },
      });
      expect(fileAfter.ownerUserId).toBe(null);
      const allUserFilesAfter = await dbClient.file.findMany({
        where: {
          ownerUserId: userId,
        },
      });
      expect(allUserFilesAfter.length).toBe(1);
    });
  });

  describe('deleting others', () => {
    it('doesn’t allow users without sufficient permission to edit other users', async () => {
      const userId = await getUserIdByAuth0Id('user1');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000002/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user3`)
        .expect(403);
    });
    it('rejects requests to delete a user that isn’t part of the team', async () => {
      const userId = await getUserIdByAuth0Id('user4');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user1`)
        .expect(404)
        .expect(expectError);
    });
    it('rejects requests for an EDITOR to delete an OWNER', async () => {
      const userId = await getUserIdByAuth0Id('user1');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/users/${userId}`)
        .set('Authorization', `Bearer ValidToken user2`)
        .expect(403)
        .expect(expectError);
    });
  });
});

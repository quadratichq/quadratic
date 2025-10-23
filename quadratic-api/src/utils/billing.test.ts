import { clearDb, createFile, createTeam, createUser } from '../tests/testDataGenerator';
import { fileCountForTeam } from './billing';

let userId: number;

beforeEach(async () => {
  // Create a user
  userId = (
    await createUser({
      auth0Id: 'testUser',
    })
  ).id;
});

afterEach(clearDb);

describe('fileCountForTeam', () => {
  it('returns 0 when team has no files', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000001',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    const count = await fileCountForTeam(team);
    expect(count).toBe(0);
  });

  it('returns correct count when team has files', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000002',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 3 files for the team
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000010',
        name: 'File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000011',
        name: 'File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000012',
        name: 'File 3',
        creatorUserId: userId,
        ownerTeamId: team.id,
      },
    });

    const count = await fileCountForTeam(team);
    expect(count).toBe(3);
  });

  it('does not count deleted files', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000003',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 2 active files and 1 deleted file
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000020',
        name: 'Active File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: false,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000021',
        name: 'Active File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: false,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000022',
        name: 'Deleted File',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: true,
        deletedDate: new Date(),
      },
    });

    const count = await fileCountForTeam(team);
    expect(count).toBe(2);
  });

  it('returns 0 when all files are deleted', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000004',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 3 deleted files
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000030',
        name: 'Deleted File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: true,
        deletedDate: new Date(),
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000031',
        name: 'Deleted File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: true,
        deletedDate: new Date(),
      },
    });

    const count = await fileCountForTeam(team);
    expect(count).toBe(0);
  });

  it('only counts files for the specified team', async () => {
    const team1 = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000005',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    const team2 = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000006',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 2 files for team1
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000040',
        name: 'Team 1 File 1',
        creatorUserId: userId,
        ownerTeamId: team1.id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000041',
        name: 'Team 1 File 2',
        creatorUserId: userId,
        ownerTeamId: team1.id,
      },
    });

    // Create 3 files for team2
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000050',
        name: 'Team 2 File 1',
        creatorUserId: userId,
        ownerTeamId: team2.id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000051',
        name: 'Team 2 File 2',
        creatorUserId: userId,
        ownerTeamId: team2.id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000052',
        name: 'Team 2 File 3',
        creatorUserId: userId,
        ownerTeamId: team2.id,
      },
    });

    const count1 = await fileCountForTeam(team1);
    const count2 = await fileCountForTeam(team2);

    expect(count1).toBe(2);
    expect(count2).toBe(3);
  });
});

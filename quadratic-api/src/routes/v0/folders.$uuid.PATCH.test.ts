import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-4000-8000-000000000001';
const folderUuid = '00000000-0000-4000-8000-000000000010';
const subfolderUuid = '00000000-0000-4000-8000-000000000011';
const siblingUuid = '00000000-0000-4000-8000-000000000012';

const patchFolder = (uuid: string, payload: any, user: string = 'userOwner') =>
  request(app).patch(`/v0/folders/${uuid}`).send(payload).set('Authorization', `Bearer ValidToken ${user}`);

describe('PATCH /v0/folders/:uuid', () => {
  let teamId: number;
  let userOwnerId: number;
  let folderId: number;

  beforeAll(async () => {
    const [userOwner, userViewer, userNoTeam] = await createUsers(['userOwner', 'userViewer', 'userNoTeam']);
    userOwnerId = userOwner.id;

    const team = await dbClient.team.create({
      data: {
        name: 'test_team',
        uuid: teamUuid,
        UserTeamRole: {
          create: [
            { userId: userOwner.id, role: 'OWNER' },
            { userId: userViewer.id, role: 'VIEWER' },
          ],
        },
      },
    });
    teamId = team.id;
    await upgradeTeamToPro(team.id);

    // Create folders
    const folder = await createFolder({
      data: {
        name: 'Folder A',
        uuid: folderUuid,
        ownerTeamId: teamId,
      },
    });
    folderId = folder.id;

    await createFolder({
      data: {
        name: 'Subfolder B',
        uuid: subfolderUuid,
        ownerTeamId: teamId,
        parentFolderId: folderId,
      },
    });

    await createFolder({
      data: {
        name: 'Sibling C',
        uuid: siblingUuid,
        ownerTeamId: teamId,
      },
    });
  });

  afterAll(clearDb);

  describe('bad requests', () => {
    it('rejects unauthenticated request', async () => {
      await request(app).patch(`/v0/folders/${folderUuid}`).send({ name: 'New Name' }).expect(401).expect(expectError);
    });

    it('rejects request for a folder that does not exist', async () => {
      await patchFolder('00000000-0000-4000-8000-000000000099', { name: 'New' }).expect(404).expect(expectError);
    });

    it('rejects request when user does not have team access', async () => {
      await patchFolder(folderUuid, { name: 'New' }, 'userNoTeam').expect(403).expect(expectError);
    });

    it('rejects request from a viewer for a public folder', async () => {
      await patchFolder(folderUuid, { name: 'New' }, 'userViewer').expect(403).expect(expectError);
    });
  });

  describe('rename folder', () => {
    it('renames a folder', async () => {
      await patchFolder(folderUuid, { name: 'Renamed Folder' })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.name).toBe('Renamed Folder');
          expect(res.body.folder.uuid).toBe(folderUuid);
        });
    });
  });

  describe('move folder', () => {
    it('moves a folder to another parent', async () => {
      await patchFolder(subfolderUuid, { parentFolderUuid: siblingUuid })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.parentFolderUuid).toBe(siblingUuid);
        });
    });

    it('moves a folder to root', async () => {
      await patchFolder(subfolderUuid, { parentFolderUuid: null })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.parentFolderUuid).toBeNull();
        });
    });

    it('rejects moving a folder into itself', async () => {
      await patchFolder(folderUuid, { parentFolderUuid: folderUuid }).expect(400).expect(expectError);
    });

    it('rejects moving a folder into its own subfolder (circular reference)', async () => {
      // Move subfolder back under folder first
      await patchFolder(subfolderUuid, { parentFolderUuid: folderUuid }).expect(200);

      // Now try to move folder into subfolder (circular)
      await patchFolder(folderUuid, { parentFolderUuid: subfolderUuid }).expect(400).expect(expectError);
    });

    it('rejects moving to a non-existent parent', async () => {
      await patchFolder(folderUuid, { parentFolderUuid: '00000000-0000-4000-8000-000000000099' })
        .expect(404)
        .expect(expectError);
    });

    it('moves a subfolder from one root to a subfolder in another root', async () => {
      const rootXUuid = '00000000-0000-4000-8000-000000000030';
      const rootYUuid = '00000000-0000-4000-8000-000000000032';
      const subX1Uuid = '00000000-0000-4000-8000-000000000031';
      const subY1Uuid = '00000000-0000-4000-8000-000000000033';

      // Create two root folders, each with a subfolder
      const rootX = await createFolder({
        data: { name: 'Root X', uuid: rootXUuid, ownerTeamId: teamId },
      });
      const rootY = await createFolder({
        data: { name: 'Root Y', uuid: rootYUuid, ownerTeamId: teamId },
      });
      await createFolder({
        data: { name: 'Sub X1', uuid: subX1Uuid, ownerTeamId: teamId, parentFolderId: rootX.id },
      });
      const subY1 = await createFolder({
        data: { name: 'Sub Y1', uuid: subY1Uuid, ownerTeamId: teamId, parentFolderId: rootY.id },
      });

      // Move Sub X1 from under Root X to under Sub Y1 (which is under Root Y)
      await patchFolder(subX1Uuid, { parentFolderUuid: subY1Uuid })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.parentFolderUuid).toBe(subY1Uuid);
        });

      // Verify in the database
      const movedFolder = await dbClient.folder.findUnique({ where: { uuid: subX1Uuid } });
      expect(movedFolder!.parentFolderId).toBe(subY1.id);
    });

    it('move-only does not change file or descendant folder ownership', async () => {
      // Create a file in the subfolder (team-owned)
      const subfolder = await dbClient.folder.findUnique({ where: { uuid: subfolderUuid } });
      const fileInSubfolder = await createFile({
        data: {
          name: 'File in Subfolder',
          ownerTeamId: teamId,
          creatorUserId: userOwnerId,
          folderId: subfolder!.id,
        },
      });
      // Move subfolder to sibling (no ownership change)
      await patchFolder(subfolderUuid, { parentFolderUuid: siblingUuid }).expect(200);
      // File should still be team-owned (ownerUserId null)
      const fileAfter = await dbClient.file.findUnique({ where: { id: fileInSubfolder.id } });
      expect(fileAfter!.ownerUserId).toBeNull();
    });
  });

  describe('ownership cascade', () => {
    const cascadeParentUuid = '00000000-0000-4000-8000-000000000020';
    const cascadeChildUuid = '00000000-0000-4000-8000-000000000021';
    const cascadeGrandchildUuid = '00000000-0000-4000-8000-000000000022';

    let fileInParentId: number;
    let fileInChildId: number;
    let fileInGrandchildId: number;
    let fileOutsideId: number;

    beforeAll(async () => {
      // Create a folder hierarchy: parent → child → grandchild (all team-owned)
      const parent = await createFolder({
        data: {
          name: 'Cascade Parent',
          uuid: cascadeParentUuid,
          ownerTeamId: teamId,
        },
      });

      const child = await createFolder({
        data: {
          name: 'Cascade Child',
          uuid: cascadeChildUuid,
          ownerTeamId: teamId,
          parentFolderId: parent.id,
        },
      });

      const grandchild = await createFolder({
        data: {
          name: 'Cascade Grandchild',
          uuid: cascadeGrandchildUuid,
          ownerTeamId: teamId,
          parentFolderId: child.id,
        },
      });

      // Create files in each folder
      const fileInParent = await createFile({
        data: {
          name: 'File in Parent',
          ownerTeamId: teamId,
          creatorUserId: userOwnerId,
          folderId: parent.id,
        },
      });
      fileInParentId = fileInParent.id;

      const fileInChild = await createFile({
        data: {
          name: 'File in Child',
          ownerTeamId: teamId,
          creatorUserId: userOwnerId,
          folderId: child.id,
        },
      });
      fileInChildId = fileInChild.id;

      const fileInGrandchild = await createFile({
        data: {
          name: 'File in Grandchild',
          ownerTeamId: teamId,
          creatorUserId: userOwnerId,
          folderId: grandchild.id,
        },
      });
      fileInGrandchildId = fileInGrandchild.id;

      // Create a file in the existing sibling folder (should NOT be affected by cascade)
      const siblingFolder = await dbClient.folder.findUnique({ where: { uuid: siblingUuid } });
      const fileOutside = await createFile({
        data: {
          name: 'File Outside Cascade',
          ownerTeamId: teamId,
          creatorUserId: userOwnerId,
          folderId: siblingFolder!.id,
        },
      });
      fileOutsideId = fileOutside.id;
    });

    it('cascades ownership to all subfolders and files when moving team → private', async () => {
      await patchFolder(cascadeParentUuid, { ownerUserId: userOwnerId })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.ownerUserId).toBe(userOwnerId);
        });

      // Verify child and grandchild folders also got ownership updated
      const childFolder = await dbClient.folder.findUnique({ where: { uuid: cascadeChildUuid } });
      expect(childFolder!.ownerUserId).toBe(userOwnerId);

      const grandchildFolder = await dbClient.folder.findUnique({ where: { uuid: cascadeGrandchildUuid } });
      expect(grandchildFolder!.ownerUserId).toBe(userOwnerId);

      // Verify files in all folders got ownership updated
      const parentFile = await dbClient.file.findUnique({ where: { id: fileInParentId } });
      expect(parentFile!.ownerUserId).toBe(userOwnerId);

      const childFile = await dbClient.file.findUnique({ where: { id: fileInChildId } });
      expect(childFile!.ownerUserId).toBe(userOwnerId);

      const grandchildFile = await dbClient.file.findUnique({ where: { id: fileInGrandchildId } });
      expect(grandchildFile!.ownerUserId).toBe(userOwnerId);
    });

    it('does not affect files outside the folder tree', async () => {
      // The file in the sibling folder should still have no ownerUserId (team-owned)
      const outsideFile = await dbClient.file.findUnique({ where: { id: fileOutsideId } });
      expect(outsideFile!.ownerUserId).toBeNull();

      // The sibling folder itself should still be team-owned
      const sibling = await dbClient.folder.findUnique({ where: { uuid: siblingUuid } });
      expect(sibling!.ownerUserId).toBeNull();
    });

    it('cascades ownership back when moving private → team', async () => {
      await patchFolder(cascadeParentUuid, { ownerUserId: null })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.ownerUserId).toBeNull();
        });

      // Verify child and grandchild folders reverted
      const childFolder = await dbClient.folder.findUnique({ where: { uuid: cascadeChildUuid } });
      expect(childFolder!.ownerUserId).toBeNull();

      const grandchildFolder = await dbClient.folder.findUnique({ where: { uuid: cascadeGrandchildUuid } });
      expect(grandchildFolder!.ownerUserId).toBeNull();

      // Verify files reverted
      const parentFile = await dbClient.file.findUnique({ where: { id: fileInParentId } });
      expect(parentFile!.ownerUserId).toBeNull();

      const childFile = await dbClient.file.findUnique({ where: { id: fileInChildId } });
      expect(childFile!.ownerUserId).toBeNull();

      const grandchildFile = await dbClient.file.findUnique({ where: { id: fileInGrandchildId } });
      expect(grandchildFile!.ownerUserId).toBeNull();
    });

    it('cascades ownership when moving to a different parent and changing ownership simultaneously', async () => {
      // Move cascade parent into sibling folder AND change to private
      await patchFolder(cascadeParentUuid, { parentFolderUuid: siblingUuid, ownerUserId: userOwnerId })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.ownerUserId).toBe(userOwnerId);
          expect(res.body.folder.parentFolderUuid).toBe(siblingUuid);
        });

      // Verify descendants got ownership updated
      const childFolder = await dbClient.folder.findUnique({ where: { uuid: cascadeChildUuid } });
      expect(childFolder!.ownerUserId).toBe(userOwnerId);

      const grandchildFolder = await dbClient.folder.findUnique({ where: { uuid: cascadeGrandchildUuid } });
      expect(grandchildFolder!.ownerUserId).toBe(userOwnerId);

      // Verify files got ownership updated
      const parentFile = await dbClient.file.findUnique({ where: { id: fileInParentId } });
      expect(parentFile!.ownerUserId).toBe(userOwnerId);

      const childFile = await dbClient.file.findUnique({ where: { id: fileInChildId } });
      expect(childFile!.ownerUserId).toBe(userOwnerId);

      const grandchildFile = await dbClient.file.findUnique({ where: { id: fileInGrandchildId } });
      expect(grandchildFile!.ownerUserId).toBe(userOwnerId);

      // Sibling folder itself should still be team-owned
      const sibling = await dbClient.folder.findUnique({ where: { uuid: siblingUuid } });
      expect(sibling!.ownerUserId).toBeNull();

      // Clean up: move back to root and team
      await patchFolder(cascadeParentUuid, { parentFolderUuid: null, ownerUserId: null }).expect(200);
    });

    it('moves a subfolder from one root to a subfolder in another root with ownership cascade', async () => {
      const privateRootUuid = '00000000-0000-4000-8000-000000000040';
      const privateSubUuid = '00000000-0000-4000-8000-000000000041';

      // Create a private root folder with a subfolder
      const privateRoot = await createFolder({
        data: { name: 'Private Root', uuid: privateRootUuid, ownerTeamId: teamId, ownerUserId: userOwnerId },
      });
      const privateSub = await createFolder({
        data: {
          name: 'Private Sub',
          uuid: privateSubUuid,
          ownerTeamId: teamId,
          ownerUserId: userOwnerId,
          parentFolderId: privateRoot.id,
        },
      });

      // Create a file in the private subfolder
      const fileInPrivateSub = await createFile({
        data: {
          name: 'File in Private Sub',
          ownerTeamId: teamId,
          creatorUserId: userOwnerId,
          ownerUserId: userOwnerId,
          folderId: privateSub.id,
        },
      });

      // Move the private subfolder into the cascade child (which is currently team-owned under cascade parent).
      // This changes ownership from private to team and re-parents into a nested subfolder of another root.
      await patchFolder(privateSubUuid, { parentFolderUuid: cascadeChildUuid, ownerUserId: null })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.parentFolderUuid).toBe(cascadeChildUuid);
          expect(res.body.folder.ownerUserId).toBeNull();
        });

      // Verify in the database that ownership was cascaded
      const movedFolder = await dbClient.folder.findUnique({ where: { uuid: privateSubUuid } });
      const cascadeChild = await dbClient.folder.findUnique({ where: { uuid: cascadeChildUuid } });
      expect(movedFolder!.parentFolderId).toBe(cascadeChild!.id);
      expect(movedFolder!.ownerUserId).toBeNull();

      // Verify file ownership was cascaded
      const fileAfter = await dbClient.file.findUnique({ where: { id: fileInPrivateSub.id } });
      expect(fileAfter!.ownerUserId).toBeNull();
    });

    it('rejects moving a folder to private under a different user', async () => {
      // userViewer tries to set ownerUserId to userOwnerId (not themselves)
      await patchFolder(cascadeParentUuid, { ownerUserId: userOwnerId }, 'userViewer')
        .expect(403)
        .expect(expectError);
    });
  });
});

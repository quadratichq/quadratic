import { AccessSchema, RoleSchema } from '../permissions';

export const data = {
  team: {
    uuid: '1',
    name: 'Costco',
    // picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
    users: [
      {
        email: 'jim.nielsen@quadratichq.com',
        permissions: {
          role: RoleSchema.enum.OWNER,
          access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
        },
        name: 'Jim Nielsen',
        picture: 'https://avatars.githubusercontent.com/u/1051509?v=4',
      },
      {
        email: 'david.dimaria@quadratichq.com',
        permissions: {
          role: RoleSchema.enum.OWNER,
          access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
        },
        name: 'David DiMaria',
        picture: 'https://avatars.githubusercontent.com/u/1051510?v=4',
      },
      {
        email: 'david.kircos@quadratichq.com',
        permissions: { role: RoleSchema.enum.EDITOR, access: [AccessSchema.enum.TEAM_EDIT] },
        name: 'David Kircos',
        picture: 'https://avatars.githubusercontent.com/u/1051508?v=4',
      },
      {
        email: 'david.figatner@quadratichq.com',
        permissions: { role: RoleSchema.enum.EDITOR, access: [AccessSchema.enum.TEAM_EDIT] },
        name: 'David Figatner',
        picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
      },
      {
        email: 'peter.mills@quadartichq.com',
        permissions: { role: RoleSchema.enum.VIEWER, access: [AccessSchema.enum.TEAM_VIEW] },
        name: '',
        picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
      },
      {
        email: 'john.doe@example.com',
        permissions: { role: RoleSchema.enum.EDITOR, access: [AccessSchema.enum.TEAM_VIEW] },
      },
    ],
    files: [
      {
        uuid: '1234',
        name: 'My file name',
        public_link_access: 'EDIT',
        created_date: '2023-10-05T23:06:31.789Z',
        updated_date: '2023-10-05T23:06:31.789Z',
      },
    ],
  },
  permissions: {
    role: RoleSchema.enum.OWNER,
    access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
  },
};

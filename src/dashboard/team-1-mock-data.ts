import { ApiTypes } from '../api/types';
import { AccessSchema, RoleSchema } from '../permissions';

export const data: ApiTypes['/v0/teams/:uuid.GET.response'] = {
  team: {
    uuid: '1',
    name: 'Costco Wholesale Incorporated',
    // picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
    users: [
      {
        id: 1,
        email: 'jim.nielsen@quadratichq.com',
        hasAccount: true,
        role: RoleSchema.enum.OWNER,

        // access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
        name: 'Jim Nielsen',
        picture: 'https://avatars.githubusercontent.com/u/1051509?v=4',
      },
      {
        id: 2,
        email: 'david.dimaria@quadratichq.com',
        hasAccount: true,
        role: RoleSchema.enum.OWNER,
        // access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
        name: 'David DiMaria',
        picture: 'https://avatars.githubusercontent.com/u/1051510?v=4',
      },
      {
        id: 3,
        email: 'david.kircos@quadratichq.com',
        hasAccount: true,
        role: RoleSchema.enum.EDITOR,
        // access: [AccessSchema.enum.TEAM_EDIT],
        name: 'David Kircos',
        picture: 'https://avatars.githubusercontent.com/u/1051508?v=4',
      },
      {
        id: 4,
        email: 'david.figatner@quadratichq.com',
        hasAccount: true,
        role: RoleSchema.enum.EDITOR,
        // access: [AccessSchema.enum.TEAM_EDIT] },
        name: 'David Figatner',
        picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
      },
      {
        id: 5,
        email: 'peter.mills@quadartichq.com',
        hasAccount: true,
        role: RoleSchema.enum.VIEWER,
        // access: [AccessSchema.enum.TEAM_VIEW] },
        name: '',
        picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
      },
      {
        id: 6,
        email: 'john.doe@example.com',
        hasAccount: false,
        role: RoleSchema.enum.EDITOR,
        // access: [AccessSchema.enum.TEAM_VIEW] },
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
  role: RoleSchema.enum.OWNER,
  access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
};

export const data2: ApiTypes['/v0/teams/:uuid.GET.response'] = {
  team: {
    uuid: '2',
    name: 'Quadratic',
    // picture: 'https://avatars.githubusercontent.com/u/1051500?v=4',
    users: [
      {
        id: 1,
        email: 'jim.nielsen@quadratichq.com',
        hasAccount: true,
        role: RoleSchema.enum.OWNER,
        name: 'Jim Nielsen',
        picture: 'https://avatars.githubusercontent.com/u/1051509?v=4',
      },
    ],
    files: [],
  },
  role: RoleSchema.enum.OWNER,
  access: [AccessSchema.enum.TEAM_EDIT, AccessSchema.enum.TEAM_DELETE, AccessSchema.enum.TEAM_BILLING_EDIT],
};

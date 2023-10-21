const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');

const prisma = new PrismaClient();

async function seed() {
  // Seed Users
  const usersCount = 10;
  const users = [];
  for (let i = 0; i < usersCount; i++) {
    users.push({
      auth0_id: faker.string.uuid(),
    });
  }
  await prisma.user.createMany({ data: users });

  // Seed Teams
  const teamsCount = 3;
  const teams = [];
  for (let i = 0; i < teamsCount; i++) {
    teams.push({
      name: faker.company.name(),
    });
  }
  await prisma.team.createMany({ data: teams });

  // Seed UserTeamRole
  const userTeamRoles = [];
  for (let i = 0; i < 1; i++) {
    const userId = faker.number.int({ min: 2, max: usersCount });
    const teamId = faker.number.int({ min: 2, max: teamsCount });
    const role = faker.string.fromCharacters(['OWNER', 'EDITOR', 'VIEWER']);

    // Check if the relationship already exists
    const existingRelationship = await prisma.userTeamRole.findFirst({
      where: {
        userId,
        teamId,
      },
    });

    if (!existingRelationship) {
      userTeamRoles.push({
        userId,
        teamId,
        role,
      });
    }
    // userTeamRoles.push({
    //   userId: faker.number.int({ min: 2, max: 5 }), // Assuming you have 5 users
    //   teamId: faker.number.int({ min: 1, max: 3 }), // Assuming you have 3 teams
    //   // role: faker.string.fromCharacters(['OWNER', 'EDITOR', 'VIEWER']),
    //   role: 'OWNER',
    // });
  }
  await prisma.userTeamRole.createMany({ data: userTeamRoles });

  console.log('Seed data successfully inserted');
}

seed()
  .catch((error) => {
    console.error('Error seeding the database:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

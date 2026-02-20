import dbClient from '../dbClient';
import { clearDb, createFile, createTeam, createUser, upgradeTeamToPro } from '../tests/testDataGenerator';
import {
  canMakeAiRequest,
  getCurrentMonthAiCostForTeam,
  getCurrentMonthAiCostForUser,
  getCurrentMonthOverageCostForTeam,
  getMonthlyAiAllowancePerUser,
  getPlanType,
  getTeamMonthlyAiAllowance,
  getUserBudgetLimit,
  hasExceededAllowance,
  hasExceededTeamBudget,
  hasExceededUserBudget,
  hasTeamExceededAllowance,
  isBusinessPlan,
  isFreePlan,
  isProPlan,
  PlanType,
} from './planHelpers';

let userId1: number;
let userId2: number;

beforeEach(async () => {
  userId1 = (await createUser({ auth0Id: 'user1' })).id;
  userId2 = (await createUser({ auth0Id: 'user2' })).id;
});

afterEach(clearDb);

describe('getPlanType', () => {
  it('returns FREE for team without subscription', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000001' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const planType = getPlanType(team);
    expect(planType).toBe(PlanType.FREE);
  });

  it('returns PRO for team with ACTIVE subscription (when planType not set)', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000002' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const planType = getPlanType(updatedTeam);
    expect(planType).toBe(PlanType.PRO);
  });

  it('returns explicitly set planType when available', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000003' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS' },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const planType = getPlanType(updatedTeam);
    expect(planType).toBe(PlanType.BUSINESS);
  });
});

describe('isFreePlan, isProPlan, isBusinessPlan', () => {
  it('correctly identifies FREE plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000010' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    expect(isFreePlan(team)).toBe(true);
    expect(isProPlan(team)).toBe(false);
    expect(isBusinessPlan(team)).toBe(false);
  });

  it('correctly identifies PRO plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000011' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    expect(isFreePlan(updatedTeam)).toBe(false);
    expect(isProPlan(updatedTeam)).toBe(true);
    expect(isBusinessPlan(updatedTeam)).toBe(false);
  });

  it('correctly identifies BUSINESS plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000012' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS' },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    expect(isFreePlan(updatedTeam)).toBe(false);
    expect(isProPlan(updatedTeam)).toBe(false);
    expect(isBusinessPlan(updatedTeam)).toBe(true);
  });
});

describe('getMonthlyAiAllowancePerUser', () => {
  it('returns 0 for FREE plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000020' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const allowance = getMonthlyAiAllowancePerUser(team);
    expect(allowance).toBe(0);
  });

  it('returns 20 for PRO plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000021' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const allowance = getMonthlyAiAllowancePerUser(updatedTeam);
    expect(allowance).toBe(20);
  });

  it('returns 40 for BUSINESS plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000022' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS' },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const allowance = getMonthlyAiAllowancePerUser(updatedTeam);
    expect(allowance).toBe(40);
  });
});

describe('getTeamMonthlyAiAllowance', () => {
  it('returns 0 for FREE plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000030' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const allowance = await getTeamMonthlyAiAllowance(team);
    expect(allowance).toBe(0);
  });

  it('calculates total allowance based on user count for PRO plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000031' },
      users: [
        { userId: userId1, role: 'OWNER' },
        { userId: userId2, role: 'EDITOR' },
      ],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const allowance = await getTeamMonthlyAiAllowance(updatedTeam);
    expect(allowance).toBe(40); // 2 users * $20 = $40
  });

  it('calculates total allowance for BUSINESS plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000032' },
      users: [
        { userId: userId1, role: 'OWNER' },
        { userId: userId2, role: 'EDITOR' },
      ],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS' },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const allowance = await getTeamMonthlyAiAllowance(updatedTeam);
    expect(allowance).toBe(80); // 2 users * $40 = $80
  });
});

describe('getCurrentMonthAiCostForTeam and getCurrentMonthAiCostForUser', () => {
  it('returns 0 when no costs exist', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000040' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const teamCost = await getCurrentMonthAiCostForTeam(team.id);
    const userCost = await getCurrentMonthAiCostForUser(team.id, userId1);

    expect(teamCost).toBe(0);
    expect(userCost).toBe(0);
  });

  it('sums costs for current month correctly', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000041' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000042',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create costs for current month
    const now = new Date();
    await dbClient.aICost.createMany({
      data: [
        {
          userId: userId1,
          teamId: team.id,
          fileId: file.id,
          cost: 5.0,
          model: 'test-model',
          source: 'AIAnalyst',
          inputTokens: 100,
          outputTokens: 100,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          createdDate: now,
        },
        {
          userId: userId1,
          teamId: team.id,
          fileId: file.id,
          cost: 3.0,
          model: 'test-model',
          source: 'AIAnalyst',
          inputTokens: 50,
          outputTokens: 50,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          createdDate: now,
        },
      ],
    });

    const teamCost = await getCurrentMonthAiCostForTeam(team.id);
    const userCost = await getCurrentMonthAiCostForUser(team.id, userId1);

    expect(teamCost).toBe(8.0);
    expect(userCost).toBe(8.0);
  });

  it('excludes costs from previous months', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000043' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000044',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    // Create cost from last month
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 10.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 200,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: lastMonth,
      },
    });

    // Create cost for current month
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 5.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: now,
      },
    });

    const teamCost = await getCurrentMonthAiCostForTeam(team.id);
    const userCost = await getCurrentMonthAiCostForUser(team.id, userId1);

    expect(teamCost).toBe(5.0); // Only current month
    expect(userCost).toBe(5.0);
  });
});

describe('hasExceededAllowance', () => {
  it('returns false for FREE plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000050' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const exceeded = await hasExceededAllowance(team, userId1);
    expect(exceeded).toBe(false);
  });

  it('returns false when cost is below allowance', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000051' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000052',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost below allowance ($15 < $20)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 15.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasExceededAllowance(updatedTeam, userId1);
    expect(exceeded).toBe(false);
  });

  it('returns true when cost equals allowance', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000053' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000054',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost equal to allowance ($20 = $20)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 20.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasExceededAllowance(updatedTeam, userId1);
    expect(exceeded).toBe(true);
  });

  it('returns true when cost exceeds allowance', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000055' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000056',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above allowance ($25 > $20)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 25.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasExceededAllowance(updatedTeam, userId1);
    expect(exceeded).toBe(true);
  });
});

describe('hasTeamExceededAllowance', () => {
  it('returns false for FREE plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000060' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const exceeded = await hasTeamExceededAllowance(team);
    expect(exceeded).toBe(false);
  });

  it('returns true when team cost exceeds total allowance', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000061' },
      users: [
        { userId: userId1, role: 'OWNER' },
        { userId: userId2, role: 'EDITOR' },
      ],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000062',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Total allowance: 2 users * $20 = $40
    // Create cost above allowance ($45 > $40)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 45.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasTeamExceededAllowance(updatedTeam);
    expect(exceeded).toBe(true);
  });
});

describe('getUserBudgetLimit', () => {
  it('returns null when no budget limit is set', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000070' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const budgetLimit = await getUserBudgetLimit(team.id, userId1);
    expect(budgetLimit).toBeNull();
  });

  it('returns budget limit when set', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000071' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.userBudgetLimit.create({
      data: {
        userId: userId1,
        teamId: team.id,
        monthlyBudgetLimit: 100.0,
      },
    });

    const budgetLimit = await getUserBudgetLimit(team.id, userId1);
    expect(budgetLimit).not.toBeNull();
    expect(budgetLimit?.limit).toBe(100.0);
  });
});

describe('hasExceededUserBudget', () => {
  it('returns false when no budget limit is set', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000080' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const exceeded = await hasExceededUserBudget(team.id, userId1);
    expect(exceeded).toBe(false);
  });

  it('returns false when cost is below budget limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000081' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.userBudgetLimit.create({
      data: {
        userId: userId1,
        teamId: team.id,
        monthlyBudgetLimit: 100.0,
      },
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000082',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost below budget ($50 < $100)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 50.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasExceededUserBudget(team.id, userId1);
    expect(exceeded).toBe(false);
  });

  it('returns true when cost exceeds budget limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000083' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.userBudgetLimit.create({
      data: {
        userId: userId1,
        teamId: team.id,
        monthlyBudgetLimit: 100.0,
      },
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000084',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above budget ($150 > $100)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 150.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasExceededUserBudget(team.id, userId1);
    expect(exceeded).toBe(true);
  });

  it('returns false when cost is from previous month (budget automatically resets)', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000085' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.userBudgetLimit.create({
      data: {
        userId: userId1,
        teamId: team.id,
        monthlyBudgetLimit: 100.0,
      },
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000086',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost from last month (budgets reset automatically on 1st of month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(15); // Middle of last month

    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 150.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: lastMonth,
      },
    });

    const exceeded = await hasExceededUserBudget(team.id, userId1);
    expect(exceeded).toBe(false); // Cost is from last month, current month cost is 0
  });
});

describe('hasExceededTeamBudget', () => {
  it('returns false when no budget limit is set', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000090' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const exceeded = await hasExceededTeamBudget(team);
    expect(exceeded).toBe(false);
  });

  it('returns true when team cost exceeds budget limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000091' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        teamMonthlyBudgetLimit: 200.0,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000092',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above budget ($250 > $200)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 250.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const exceeded = await hasExceededTeamBudget(updatedTeam);
    expect(exceeded).toBe(true);
  });

  it('applies limit to overage only: returns false when total cost exceeds limit but overage is under limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000093' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        teamMonthlyBudgetLimit: 60.0,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000094',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // BUSINESS allowance is $40/user. Total cost $90 (included $40 + overage $50).
    // Limit $60 applies to overage only, so overage $50 < $60
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 90.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const overageCost = await getCurrentMonthOverageCostForTeam(updatedTeam);
    expect(overageCost).toBe(50);

    const exceeded = await hasExceededTeamBudget(updatedTeam);
    expect(exceeded).toBe(false);
  });
});

describe('canMakeAiRequest', () => {
  it('allows requests for FREE plan', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000100' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const result = await canMakeAiRequest(team, userId1);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows requests when within PRO plan allowance', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000101' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000102',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost below allowance ($15 < $20)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 15.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true);
  });

  it('blocks requests when PRO plan allowance exceeded', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000103' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000104',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above allowance ($25 > $20)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 25.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Monthly AI allowance exceeded');
  });

  it('allows requests when BUSINESS plan allowance exceeded but overage enabled and within budget', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000105' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        allowOveragePayments: true,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000106',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above allowance ($50 > $40) but within budget
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 50.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true); // Overage enabled, no budget limit set
  });

  it('blocks requests when BUSINESS plan allowance exceeded, overage enabled, but user budget exceeded', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000107' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        allowOveragePayments: true,
      },
    });

    await dbClient.userBudgetLimit.create({
      data: {
        userId: userId1,
        teamId: team.id,
        monthlyBudgetLimit: 60.0,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000108',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above allowance ($50 > $40) and above user budget ($50 < $60, but let's make it $65)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 65.0, // Above user budget of $60
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User monthly budget limit exceeded');
  });

  it('blocks requests when BUSINESS plan allowance exceeded, overage enabled, but team budget exceeded', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000109' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        allowOveragePayments: true,
        teamMonthlyBudgetLimit: 100.0,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000110',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost above allowance and above team budget
    // Overage = cost - allowance = $150 - $40 = $110 > budget limit of $100
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 150.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Team monthly budget limit exceeded');
  });

  it('blocks requests when BUSINESS plan within allowance but user budget exceeded', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000111' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
      },
    });

    await dbClient.userBudgetLimit.create({
      data: {
        userId: userId1,
        teamId: team.id,
        monthlyBudgetLimit: 30.0,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000112',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // Create cost within allowance ($35 < $40) but above user budget ($35 > $30)
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 35.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User monthly budget limit exceeded');
  });
});

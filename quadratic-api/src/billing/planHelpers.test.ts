import dbClient from '../dbClient';
import { reportUsageToStripe } from '../stripe/stripe';
import { clearDb, createFile, createTeam, createUser, upgradeTeamToPro } from '../tests/testDataGenerator';
import { reportAndTrackOverage } from './aiCostTracking.helper';
import {
  canMakeAiRequest,
  getBillingPeriodAiCostForTeam,
  getBillingPeriodAiCostForUser,
  getBillingPeriodDates,
  getBillingPeriodOverageCostForTeam,
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

const mockReportUsageToStripe = reportUsageToStripe as jest.MockedFunction<typeof reportUsageToStripe>;

const calendarMonthDates = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
};

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

describe('getBillingPeriodAiCostForTeam and getBillingPeriodAiCostForUser', () => {
  it('returns 0 when no costs exist', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000040' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const teamCost = await getBillingPeriodAiCostForTeam(team.id, calendarMonthDates().start, calendarMonthDates().end);
    const userCost = await getBillingPeriodAiCostForUser(
      team.id,
      userId1,
      calendarMonthDates().start,
      calendarMonthDates().end
    );

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

    const teamCost = await getBillingPeriodAiCostForTeam(team.id, calendarMonthDates().start, calendarMonthDates().end);
    const userCost = await getBillingPeriodAiCostForUser(
      team.id,
      userId1,
      calendarMonthDates().start,
      calendarMonthDates().end
    );

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

    const teamCost = await getBillingPeriodAiCostForTeam(team.id, calendarMonthDates().start, calendarMonthDates().end);
    const userCost = await getBillingPeriodAiCostForUser(
      team.id,
      userId1,
      calendarMonthDates().start,
      calendarMonthDates().end
    );

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

    const exceeded = await hasExceededUserBudget(team, userId1);
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

    const exceeded = await hasExceededUserBudget(team, userId1);
    expect(exceeded).toBe(false);
  });

  it('returns true when cost exceeds budget limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000083' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS' },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

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

    // BUSINESS allowance $40/user. Cost $150, overage=$110 > $100 budget
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
        overageEnabled: true,
      },
    });

    const exceeded = await hasExceededUserBudget(updatedTeam, userId1);
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

    const exceeded = await hasExceededUserBudget(team, userId1);
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
        overageEnabled: true,
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
        overageEnabled: true,
      },
    });

    const overageCost = await getBillingPeriodOverageCostForTeam(updatedTeam);
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
        stripeSubscriptionStatus: 'ACTIVE',
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
        stripeSubscriptionStatus: 'ACTIVE',
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

    // Create cost where overage exceeds user budget: $105 total, overage = $105 - $40 = $65 > $60 budget
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 105.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
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
        stripeSubscriptionStatus: 'ACTIVE',
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
        overageEnabled: true,
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Team monthly budget limit exceeded');
  });

  it('allows requests when BUSINESS plan within allowance even if total cost exceeds user budget value', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000111' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        stripeSubscriptionStatus: 'ACTIVE',
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

    // Cost within allowance ($35 < $40), so overage = $0, user budget ($30) not exceeded
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
    expect(result.allowed).toBe(true);
  });
});

describe('monthly reset - costs from previous month do not affect current month', () => {
  const getLastMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(15);
    return d;
  };

  const createCostForDate = async (teamId: number, userId: number, fileId: number, cost: number, date: Date) => {
    await dbClient.aICost.create({
      data: {
        userId,
        teamId,
        fileId,
        cost,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: date,
      },
    });
  };

  it('Pro plan: user allowance resets at month boundary', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000200' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000201',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    await createCostForDate(team.id, userId1, file.id, 25.0, getLastMonth());

    const userCost = await getBillingPeriodAiCostForUser(
      team.id,
      userId1,
      calendarMonthDates().start,
      calendarMonthDates().end
    );
    expect(userCost).toBe(0);

    const exceeded = await hasExceededAllowance(updatedTeam, userId1);
    expect(exceeded).toBe(false);

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true);
  });

  it('Pro plan: team allowance resets at month boundary', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000202' },
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
        uuid: '00000000-0000-0000-0000-000000000203',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    await createCostForDate(team.id, userId1, file.id, 50.0, getLastMonth());

    const teamCost = await getBillingPeriodAiCostForTeam(team.id, calendarMonthDates().start, calendarMonthDates().end);
    expect(teamCost).toBe(0);

    const exceeded = await hasTeamExceededAllowance(updatedTeam);
    expect(exceeded).toBe(false);
  });

  it('Business plan: user allowance resets at month boundary', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000204' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS', stripeSubscriptionStatus: 'ACTIVE' },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000205',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    await createCostForDate(team.id, userId1, file.id, 50.0, getLastMonth());

    const userCost = await getBillingPeriodAiCostForUser(
      team.id,
      userId1,
      calendarMonthDates().start,
      calendarMonthDates().end
    );
    expect(userCost).toBe(0);

    const exceeded = await hasExceededAllowance(updatedTeam, userId1);
    expect(exceeded).toBe(false);

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true);
  });

  it('Business plan: user budget resets at month boundary', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000206' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS', stripeSubscriptionStatus: 'ACTIVE', allowOveragePayments: true },
    });

    await dbClient.userBudgetLimit.create({
      data: { userId: userId1, teamId: team.id, monthlyBudgetLimit: 60.0 },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000207',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    await createCostForDate(team.id, userId1, file.id, 70.0, getLastMonth());

    const exceeded = await hasExceededUserBudget(team, userId1);
    expect(exceeded).toBe(false);

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true);
  });

  it('Business plan: team budget resets at month boundary', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000208' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        stripeSubscriptionStatus: 'ACTIVE',
        allowOveragePayments: true,
        teamMonthlyBudgetLimit: 50.0,
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000209',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    await createCostForDate(team.id, userId1, file.id, 200.0, getLastMonth());

    const overageCost = await getBillingPeriodOverageCostForTeam(updatedTeam);
    expect(overageCost).toBe(0);

    const exceeded = await hasExceededTeamBudget(updatedTeam);
    expect(exceeded).toBe(false);

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true);
  });

  it('limits are still enforced in current month when previous month also exceeded', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000210' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000211',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    await createCostForDate(team.id, userId1, file.id, 25.0, getLastMonth());
    await createCostForDate(team.id, userId1, file.id, 22.0, new Date());

    const userCost = await getBillingPeriodAiCostForUser(
      team.id,
      userId1,
      calendarMonthDates().start,
      calendarMonthDates().end
    );
    expect(userCost).toBe(22.0);

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Monthly AI allowance exceeded');
  });
});

describe('getBillingPeriodDates', () => {
  it('returns Stripe period dates when set on team', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000300' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const periodStart = new Date('2026-02-15T00:00:00Z');
    const periodEnd = new Date('2026-03-15T00:00:00Z');

    await dbClient.team.update({
      where: { id: team.id },
      data: { stripeCurrentPeriodStart: periodStart, stripeCurrentPeriodEnd: periodEnd },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const { start, end } = getBillingPeriodDates(updatedTeam);
    expect(start).toEqual(periodStart);
    expect(end).toEqual(periodEnd);
  });

  it('falls back to calendar month when period dates are null', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000301' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const { start, end } = getBillingPeriodDates(team);
    const now = new Date();
    expect(start.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(start.getUTCMonth()).toBe(now.getUTCMonth());
    expect(start.getUTCDate()).toBe(1);
    expect(end.getUTCMonth()).toBe(now.getUTCMonth());
  });
});

describe('billing period cost queries with mid-month periods', () => {
  it('includes costs within range and excludes costs outside', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000310' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000311',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    const periodStart = new Date('2026-02-15T00:00:00Z');
    const periodEnd = new Date('2026-03-15T00:00:00Z');

    // Cost before period
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 10.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date('2026-02-10T00:00:00Z'),
      },
    });

    // Cost within period
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 5.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 50,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date('2026-02-20T00:00:00Z'),
      },
    });

    // Cost after period
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 7.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 70,
        outputTokens: 70,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date('2026-03-20T00:00:00Z'),
      },
    });

    const teamCost = await getBillingPeriodAiCostForTeam(team.id, periodStart, periodEnd);
    expect(teamCost).toBe(5.0);

    const userCost = await getBillingPeriodAiCostForUser(team.id, userId1, periodStart, periodEnd);
    expect(userCost).toBe(5.0);
  });

  it('returns 0 when no costs exist in range', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000312' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    const periodStart = new Date('2026-02-15T00:00:00Z');
    const periodEnd = new Date('2026-03-15T00:00:00Z');

    const cost = await getBillingPeriodAiCostForTeam(team.id, periodStart, periodEnd);
    expect(cost).toBe(0);
  });
});

describe('canMakeAiRequest with stale subscription', () => {
  it('treats team as free when planType is PRO but subscription is CANCELED', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000320' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'PRO',
        stripeSubscriptionStatus: 'CANCELED',
      },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(true);
  });
});

describe('canMakeAiRequest: Business user budget caps overage only', () => {
  it('allows when user is within allowance even if total cost exceeds budget value', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000330' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS', stripeSubscriptionStatus: 'ACTIVE' },
    });

    await dbClient.userBudgetLimit.create({
      data: { userId: userId1, teamId: team.id, monthlyBudgetLimit: 30.0 },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000331',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // $35 spent (within $40 allowance), overage = $0, user budget ($30) not exceeded
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
    expect(result.allowed).toBe(true);
  });

  it('blocks when user overage exceeds user budget', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000332' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: { planType: 'BUSINESS', stripeSubscriptionStatus: 'ACTIVE', allowOveragePayments: true },
    });

    await dbClient.userBudgetLimit.create({
      data: { userId: userId1, teamId: team.id, monthlyBudgetLimit: 10.0 },
    });

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!updatedTeam) throw new Error('Team not found');

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000333',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    // $55 spent, overage = $55 - $40 = $15 > $10 budget
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 55.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
      },
    });

    const result = await canMakeAiRequest(updatedTeam, userId1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User monthly budget limit exceeded');
  });
});

describe('reportAndTrackOverage', () => {
  beforeEach(() => {
    mockReportUsageToStripe.mockClear();
  });

  const setupBusinessTeamWithOverage = async (uuid: string, fileUuid: string) => {
    const team = await createTeam({
      team: { uuid },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        stripeSubscriptionStatus: 'ACTIVE',
        allowOveragePayments: true,
        stripeOverageItemId: 'si_test_overage',
        stripeCustomerId: 'cus_test_123',
      },
    });

    const file = await createFile({
      data: {
        uuid: fileUuid,
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

    return { team, file };
  };

  it('reports correct overage cents when team exceeds allowance and nothing has been billed yet', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000400',
      '00000000-0000-0000-0000-000000000401'
    );

    // 1 user * $40 allowance = $40. Cost $50 => overage $10 => 1000 cents
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
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);

    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 1000);

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(1000);
    expect(updatedTeam?.stripeOverageBilledPeriodStart).toBeTruthy();
  });

  it('does not double-report: calling twice with the same cost data reports 0 the second time', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000402',
      '00000000-0000-0000-0000-000000000403'
    );

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
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);
    expect(mockReportUsageToStripe).toHaveBeenCalledTimes(1);

    mockReportUsageToStripe.mockClear();
    await reportAndTrackOverage(team.id);
    expect(mockReportUsageToStripe).not.toHaveBeenCalled();

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(1000);
  });

  it('reports only the incremental overage when additional costs are added after a prior report', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000404',
      '00000000-0000-0000-0000-000000000405'
    );

    // First cost: $50 => overage $10 => 1000 cents
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
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);
    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 1000);

    // Second cost: additional $5 => total overage $15 => delta 500 cents
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 5.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 50,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
      },
    });

    mockReportUsageToStripe.mockClear();
    await reportAndTrackOverage(team.id);
    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 500);

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(1500);
  });

  it('resets billed tracking on new billing period', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000406',
      '00000000-0000-0000-0000-000000000407'
    );

    // Simulate stale billed cents from a previous billing period
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await dbClient.team.update({
      where: { id: team.id },
      data: {
        stripeOverageBilledCents: 5000,
        stripeOverageBilledPeriodStart: lastMonth,
      },
    });

    // Current period cost: $50 => overage $10 => 1000 cents (ignoring stale 5000)
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
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);

    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 1000);

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(1000);
  });

  it('no-ops when team has no overage (cost under allowance)', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000408',
      '00000000-0000-0000-0000-000000000409'
    );

    // $30 cost < $40 allowance => no overage
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 30.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);

    expect(mockReportUsageToStripe).not.toHaveBeenCalled();
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(0);
  });

  it('no-ops when allowOveragePayments is false', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000410' },
      users: [{ userId: userId1, role: 'OWNER' }],
    });

    await dbClient.team.update({
      where: { id: team.id },
      data: {
        planType: 'BUSINESS',
        stripeSubscriptionStatus: 'ACTIVE',
        allowOveragePayments: false,
        stripeOverageItemId: 'si_test_overage',
        stripeCustomerId: 'cus_test_123',
      },
    });

    const file = await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000411',
        name: 'Test File',
        ownerTeamId: team.id,
        creatorUserId: userId1,
      },
    });

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

    await reportAndTrackOverage(team.id);

    expect(mockReportUsageToStripe).not.toHaveBeenCalled();
  });

  it('only bills overageEnabled costs to Stripe, not costs incurred before overage was enabled', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000412',
      '00000000-0000-0000-0000-000000000413'
    );

    // $45 incurred before overage was enabled (overageEnabled=false)
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
        overageEnabled: false,
      },
    });

    // $10 incurred after overage was enabled
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 10.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 50,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
      },
    });

    // totalCost=$55, allowance=$40, totalOverage=$15, overageEnabledCost=$10
    // billedOverage = min($15, $10) = $10 => 1000 cents
    await reportAndTrackOverage(team.id);

    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 1000);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(1000);
  });

  it('caps Stripe billing at teamMonthlyBudgetLimit', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000414',
      '00000000-0000-0000-0000-000000000415'
    );

    // Set a $5 budget limit
    await dbClient.team.update({
      where: { id: team.id },
      data: { teamMonthlyBudgetLimit: 5.0 },
    });

    // Cost $60 with overageEnabled => overage=$20 but limit=$5 => 500 cents
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 60.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);

    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 500);
    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(500);
  });

  it('bills previously unbilled overage when budget limit is raised', async () => {
    const { team, file } = await setupBusinessTeamWithOverage(
      '00000000-0000-0000-0000-000000000416',
      '00000000-0000-0000-0000-000000000417'
    );

    // Set a $5 budget limit
    await dbClient.team.update({
      where: { id: team.id },
      data: { teamMonthlyBudgetLimit: 5.0 },
    });

    // Cost $60 => overage=$20 but capped at $5 => 500 cents
    await dbClient.aICost.create({
      data: {
        userId: userId1,
        teamId: team.id,
        fileId: file.id,
        cost: 60.0,
        model: 'test-model',
        source: 'AIAnalyst',
        inputTokens: 100,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        createdDate: new Date(),
        overageEnabled: true,
      },
    });

    await reportAndTrackOverage(team.id);
    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 500);

    // Raise budget limit to $15
    await dbClient.team.update({
      where: { id: team.id },
      data: { teamMonthlyBudgetLimit: 15.0 },
    });

    // Now capped at $15, already billed $5, delta = $10 => 1000 cents
    mockReportUsageToStripe.mockClear();
    await reportAndTrackOverage(team.id);
    expect(mockReportUsageToStripe).toHaveBeenCalledWith('cus_test_123', 1000);

    const updatedTeam = await dbClient.team.findUnique({ where: { id: team.id } });
    expect(updatedTeam?.stripeOverageBilledCents).toBe(1500);
  });
});

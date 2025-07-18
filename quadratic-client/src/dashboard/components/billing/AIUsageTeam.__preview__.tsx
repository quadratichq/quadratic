import { useState } from 'react';
import { AIUsageTeam } from './AIUsageTeam';

export default function Component() {
  const [users, setUsers] = useState<
    {
      id: number;
      email: string;
      name: string;
      creditsMonthly: { used: number; limit: number };
      creditsAdditional: { used: number; limit: number };
    }[]
  >([
    {
      id: 1,
      email: 'test@test.com',
      name: 'Test User',
      creditsMonthly: { used: 10, limit: 20 },
      creditsAdditional: { used: 0, limit: 0 },
    },
    {
      id: 2,
      email: 'test2@test.com',
      name: 'Test User 2',
      creditsMonthly: { used: 10, limit: 20 },
      creditsAdditional: { used: 10, limit: 20 },
    },
  ]);
  return (
    <div className="-ml-[200px] flex max-w-4xl flex-col gap-4 pl-[200px]">
      <h2 className="text-lg font-semibold">Free</h2>
      <AIUsageTeam users={users.map((user) => ({ ...user, creditsAdditional: undefined }))} teamUuid={'foo'} />

      <h2 className="text-lg font-semibold">Paid, usage-based pricing ON</h2>
      <AIUsageTeam
        users={users}
        onChangeUserAdditionalLimit={({ userId, limit }) => {
          setUsers((prev) =>
            prev.map((user) =>
              user.id === userId ? { ...user, creditsAdditional: { ...user.creditsAdditional, limit } } : user
            )
          );
        }}
        teamUuid={'foo'}
      />

      <h2 className="text-lg font-semibold">Paid, usage-based pricing OFF</h2>
      <AIUsageTeam users={users} teamUuid={'foo'} />
    </div>
  );
}

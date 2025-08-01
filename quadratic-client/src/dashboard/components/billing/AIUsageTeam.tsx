import {
  formatToFractionalDollars,
  formatToWholeDollar,
  parseInputForNumber,
} from '@/dashboard/components/billing/utils';
import { Avatar } from '@/shared/components/Avatar';
import { CheckIcon, EditIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

type Props = {
  teamUuid: string;
  users: {
    id: number;
    email: string;
    name: string;
    picture?: string;
    creditsMonthly: { used: number; limit: number };

    // Optional means they're not on a paid plan if this data is not provided
    creditsAdditional?: { used: number; limit: number };
  }[];
  onChangeUserAdditionalLimit?: ({ userId, limit }: { userId: number; limit: number }) => void;
};

export function AIUsageTeam({ teamUuid, users, onChangeUserAdditionalLimit }: Props) {
  // TODO: what if they were on paid, used overages, then went back to free? How to display (if at all)?

  // TODO: permissions for this table?

  const isOnPaidPlan = users.some((user) => user.creditsAdditional !== undefined);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm shadow-sm">
      <table className="w-full table-fixed">
        <thead>
          <tr>
            <th className="w-[40%] pb-1 text-left font-medium">
              Users{' '}
              <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} className="font-normal text-muted-foreground hover:underline">
                (Manage)
              </Link>
            </th>
            <th className="w-[25%] pb-1 text-right font-medium">Base credits</th>
            <th className={cn('w-[35%] pb-1 text-right font-medium', !isOnPaidPlan && 'text-muted-foreground')}>
              Usage-based credits
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <RowItem key={i} user={user} onChangeUserAdditionalLimit={onChangeUserAdditionalLimit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowItem({
  user,
  onChangeUserAdditionalLimit,
}: {
  user: Props['users'][number];
  onChangeUserAdditionalLimit: Props['onChangeUserAdditionalLimit'];
}) {
  return (
    <tr key={user.id} className="border-t border-border">
      <td className="py-2">
        <div className="flex items-center gap-2">
          <div className="w-6">
            <Avatar src={user.picture}>{user.name}</Avatar>
          </div>
          <div className="flex flex-col">
            {/* TODO: handle truncation of email/username */}
            <span>{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
      </td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {formatToFractionalDollars(user.creditsMonthly.used)}{' '}
          <span className="text-muted-foreground">/ {formatToWholeDollar(user.creditsMonthly.limit)}</span>
        </div>
      </td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {user.creditsAdditional ? (
            <RowItemEdit
              userId={user.id}
              used={user.creditsAdditional.used}
              limit={user.creditsAdditional.limit}
              onChangeUserAdditionalLimit={onChangeUserAdditionalLimit}
            />
          ) : (
            <span className="text-muted-foreground">--- / ---</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function RowItemEdit({
  userId,
  used,
  limit,
  onChangeUserAdditionalLimit,
}: {
  userId: number;
  used: number;
  limit: number;
  onChangeUserAdditionalLimit: Props['onChangeUserAdditionalLimit'];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const formId = `additional-credits-form-user-${userId}`;
  const [value, setValue] = useState(String(limit));

  // When the editing mode changes, always reset to the current value
  useEffect(() => {
    setValue(String(limit));
  }, [isEditing, limit]);
  return (
    <>
      <span>{formatToFractionalDollars(used)}</span>
      {onChangeUserAdditionalLimit && (
        <>
          <span className="text-muted-foreground">/</span>
          {isEditing ? (
            <form
              id={formId}
              className="inline-flex items-center gap-x-1"
              onSubmit={(e) => {
                e.preventDefault();
                setIsEditing(false);
                // If they've left it empty, reset to the default value
                // Otherwise update the value
                if (value === '') {
                  setValue(String(limit));
                } else {
                  onChangeUserAdditionalLimit({ userId, limit: Number(value) });
                }
              }}
            >
              <span className="text-muted-foreground">$</span>
              <Input
                autoFocus
                onFocus={(e) => {
                  e.target.select();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
                onChange={(e) => {
                  setValue(parseInputForNumber(e.target.value));
                }}
                placeholder={String(limit)}
                type="text"
                className="h-7 w-16 px-2"
                value={value}
              />
              <Button variant="secondary" size="icon-sm" type="submit" form={formId}>
                <CheckIcon />
              </Button>
            </form>
          ) : (
            <span className="inline-flex items-center gap-x-1">
              <span className="text-muted-foreground">{formatToWholeDollar(limit)}</span>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  setIsEditing(true);
                }}
              >
                <EditIcon />
              </Button>
            </span>
          )}
        </>
      )}
    </>
  );
}

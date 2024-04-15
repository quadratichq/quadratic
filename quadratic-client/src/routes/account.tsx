import { Type } from '@/components/Type';
import { themes, useTheme } from '@/hooks/useTheme';
import { Button } from '@/shadcn/ui/button';
import { Checkbox } from '@/shadcn/ui/checkbox';
import { ReactNode } from 'react';
import { Form, useFetcher } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { useRootRouteLoaderData } from '../router';
import { getUpdateUserAction } from './user';

export const Component = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  const [theme, setTheme] = useTheme();

  return (
    <>
      <DashboardHeader title="My account" />
      <div className={`mt-6 flex flex-col gap-6`}>
        <Row>
          <Type variant="body2" className="font-bold">
            Name
          </Type>
          <Type variant="body2">{user?.name}</Type>
        </Row>
        <Row>
          <Type variant="body2" className="font-bold">
            Email
          </Type>
          <Type variant="body2">{user?.email}</Type>
        </Row>

        <EducationEnrollmentRow />

        {theme !== null && (
          <Row>
            <Type variant="body2" className="font-bold">
              Theme
            </Type>
            <div>
              <div className="inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                {themes.map((t) => (
                  <Button
                    key={t}
                    className={
                      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow'
                    }
                    data-state={theme === t ? 'active' : 'inactive'}
                    variant={null}
                    onClick={() => {
                      setTheme(t);
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </Row>
        )}

        <Type variant="body2" className="text-muted-foreground">
          Additional account management coming in the future.
        </Type>
        <Form method="post" action={ROUTES.LOGOUT}>
          <Button variant="outline" type="submit">
            Log out
          </Button>
        </Form>
      </div>
    </>
  );
};

function Row(props: { children: ReactNode }) {
  return (
    <div className={`grid items-center`} style={{ gridTemplateColumns: '160px 1fr' }}>
      {props.children}
    </div>
  );
}

function EducationEnrollmentRow() {
  const { loggedInQUser: quser } = useRootRouteLoaderData();
  const fetcher = useFetcher();

  // Optimistically update status
  const eduStatus =
    fetcher.state !== 'idle'
      ? (fetcher.json as ReturnType<typeof getUpdateUserAction>['data']).eduStatus
      : quser?.eduStatus;

  if (!(eduStatus === 'ENROLLED' || eduStatus === 'NOT_ENROLLED')) {
    return null;
  }

  return (
    <Row>
      <Type variant="body2" className="font-bold">
        Education plan
      </Type>
      <div className="flex items-center gap-2">
        <Checkbox
          id="education-enrollment"
          checked={eduStatus === 'ENROLLED'}
          onCheckedChange={(checked) => {
            const { data, options } = getUpdateUserAction(checked ? 'ENROLLED' : 'NOT_ENROLLED');
            fetcher.submit(data, options);
          }}
        />

        <label htmlFor="education-enrollment">
          <Type as="span">Enrolled</Type>
        </label>
      </div>
    </Row>
  );
}

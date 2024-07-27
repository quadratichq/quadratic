import type { ReactNode } from 'react';
import { Form } from 'react-router-dom';

import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { themes, useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/shadcn/ui/button';

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

        <Form method="post" action={ROUTES.LOGOUT} className="mt-4">
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
    <div className={`grid max-w-lg items-center`} style={{ gridTemplateColumns: '160px 1fr' }}>
      {props.children}
    </div>
  );
}

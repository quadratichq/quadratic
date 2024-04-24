import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { EducationDialog } from '@/dashboard/components/EducationDialog';
import { useRootRouteLoaderData } from '@/router';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL, QUADRATIC_FOR_EDUCATION } from '@/shared/constants/urls';
import { themes, useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/shadcn/ui/button';
import { ReloadIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { Form } from 'react-router-dom';

export const Component = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { teams } = useDashboardRouteLoaderData();
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

        <EducationDialog>
          {({ isEnrolled, isLoading, checkStatus }) => {
            let plan = 'Free';
            if (teams.length > 0) {
              plan = 'Team';
            } else if (isEnrolled) {
              plan = 'Education';
            }

            return (
              <Row>
                <Type variant="body2" className="font-bold">
                  Plan
                </Type>

                <div>
                  <Type variant="body2" className="flex items-center gap-2">
                    {plan}
                    <ReloadIcon
                      className={`animate-spin text-primary transition-opacity ${isLoading ? '' : ' opacity-0'}`}
                    />
                  </Type>

                  <Type variant="caption">
                    {plan === 'Education' ? (
                      <>
                        Based on you’re email, you’re eligible for <EduLink>Quadratic for education</EduLink>.
                      </>
                    ) : (
                      <>
                        With a school email, you may be eligible for <EduLink>Quadratic for education</EduLink>.
                        <br />
                        <button onClick={checkStatus} className="underline ">
                          Check your status
                        </button>{' '}
                        or, if that doesn’t work you can{' '}
                        <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
                          contact us
                        </a>
                        .
                      </>
                    )}
                  </Type>
                </div>
              </Row>
            );
          }}
        </EducationDialog>

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

function EduLink({ children }: { children: string }) {
  return (
    <a href={QUADRATIC_FOR_EDUCATION} className="underline hover:text-primary" target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { Labs } from '@/dashboard/components/Labs';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { ReactNode } from 'react';
import { Form } from 'react-router-dom';

export const Component = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();

  return (
    <>
      <div className="max-w-lg">
        <DashboardHeader
          title="My account"
          actions={
            <Form method="post" action={ROUTES.LOGOUT}>
              <Button variant="outline" type="submit">
                Log out
              </Button>
            </Form>
          }
        />
        <hr className="mt-1" />
      </div>

      <div className={`mt-6 flex max-w-lg flex-col gap-6`}>
        <div>
          <h3 className="text-lg font-medium">Your info</h3>
          <p className="text-sm text-muted-foreground">
            Currently you can’t change this information.{' '}
            <a href={CONTACT_URL} className="underline hover:text-primary">
              Contact us
            </a>{' '}
            if you’d like to.
          </p>
        </div>
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

        <hr />

        <Labs />
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

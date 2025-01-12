import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import type { ReactNode } from 'react';
import { Form } from 'react-router-dom';

export const Component = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();

  return (
    <>
      <div className="max-w-xl">
        <DashboardHeader title="My account" />

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
        <Row>
          <Form method="post" action={ROUTES.LOGOUT}>
            <Button variant="outline" type="submit">
              Log out
            </Button>
          </Form>
        </Row>
      </div>
    </>
  );
};

function Row(props: { children: ReactNode }) {
  return (
    <div className={`mt-4 grid items-center`} style={{ gridTemplateColumns: '160px 1fr' }}>
      {props.children}
    </div>
  );
}

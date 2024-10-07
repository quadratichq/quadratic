import { AccountSection } from '@/dashboard/components/AccountSection';
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
      <div className="max-w-xl">
        <DashboardHeader title="My account" />

        <AccountSection
          title="Your info"
          description={
            <>
              Currently you can’t change this information.{' '}
              <a href={CONTACT_URL} className="underline hover:text-primary">
                Contact us
              </a>{' '}
              if you’d like to.
            </>
          }
        >
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
        </AccountSection>

        <AccountSection title="Labs" description="Experimental features">
          <Labs />
        </AccountSection>
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

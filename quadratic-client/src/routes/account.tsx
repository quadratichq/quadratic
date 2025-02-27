import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import type { ReactNode } from 'react';
import { Form } from 'react-router-dom';

export const Component = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();

  return (
    <>
      <div className="max-w-xl">
        <DashboardHeader title="Profile & preferences" />

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
          <Type variant="body2" className="font-bold">
            Theme
          </Type>
          <div className="flex items-center gap-2">
            <ThemeAccentColors />
          </div>
        </Row>
        <Row>
          <Type variant="body2" className="font-bold">
            Appearance
          </Type>
          <div className="flex items-center gap-2">
            <ThemeAppearanceModes />
          </div>
        </Row>
        <Row className="mt-12">
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

function Row(props: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(`mt-4 grid items-center`, props.className)} style={{ gridTemplateColumns: '160px 1fr' }}>
      {props.children}
    </div>
  );
}

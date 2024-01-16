import { Type } from '@/components/Type';
import { Button } from '@/shadcn/ui/button';
import { ReactNode } from 'react';
import { Form } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useRootRouteLoaderData } from '../router';
import { DashboardHeader } from './components/DashboardHeader';

export const Component = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  // const [darkMode, setDarkMode] = useLocalStorage('dark-mode', false);
  // const hasDarkModeFeature = window.location.origin.includes('localhost');
  // useEffect(() => {
  //   if (hasDarkModeFeature) {
  //     if (darkMode) {
  //       document.body.classList.add('dark');
  //     } else {
  //       document.body.classList.remove('dark');
  //     }
  //   }
  // }, [darkMode, hasDarkModeFeature]);

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
        {/*hasDarkModeFeature && (
          <Row>
            <Type variant="body2" className="font-bold">
              Theme
            </Type>
            <div>
              <Button
                disabled={darkMode}
                variant={darkMode ? 'secondary' : 'outline'}
                onClick={() => {
                  setDarkMode((prev) => !prev);
                }}
              >
                Dark mode
              </Button>
              <Button
                disabled={!darkMode}
                variant={!darkMode ? 'secondary' : 'outline'}
                onClick={() => {
                  setDarkMode((prev) => !prev);
                }}
              >
                Light mode
              </Button>
            </div>
          </Row>
              )*/}

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

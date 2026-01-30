import { editorInteractionStateShowShareFileMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { Link } from 'react-router';
import { useSetRecoilState } from 'recoil';

export const TopBarShareButton = () => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const setShowShareFileMenu = useSetRecoilState(editorInteractionStateShowShareFileMenuAtom);

  return (
    <>
      {isAuthenticated ? (
        <Button
          size="sm"
          onClick={() => {
            setShowShareFileMenu((prev) => !prev);
            trackEvent('[FileSharing].menu.open', { context: 'app' });
          }}
          className="self-center"
        >
          Share
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className="self-center">
          <Link to={ROUTES.LOGIN_WITH_REDIRECT()} replace style={{ whiteSpace: 'nowrap' }}>
            Log in
          </Link>
        </Button>
      )}
    </>
  );
};

import { useRootRouteLoaderData } from '@/routes/_root';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import mixpanel from 'mixpanel-browser';
import { Link } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';

export const TopBarShareButton = () => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  return (
    <>
      {isAuthenticated ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditorInteractionState((prev) => ({ ...prev, showShareFileMenu: !prev.showShareFileMenu }));
            mixpanel.track('[FileSharing].menu.open', { context: 'app' });
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

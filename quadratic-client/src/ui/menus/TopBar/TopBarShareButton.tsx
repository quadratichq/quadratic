import { Button } from '@/shadcn/ui/button';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { isViewerOrAbove } from '../../../actions';

import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { ROUTES } from '../../../constants/routes';

export const TopBarShareButton = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { permission } = editorInteractionState;

  return (
    <>
      {isViewerOrAbove(permission) ? (
        <Button
          size="sm"
          onClick={() => {
            setEditorInteractionState((prev) => ({ ...prev, showShareFileMenu: !prev.showShareFileMenu }));
          }}
          className="self-center"
        >
          Share
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className=" self-center">
          <Link to={ROUTES.LOGIN_WITH_REDIRECT()} replace>
            Log in
          </Link>
        </Button>
      )}
    </>
  );
};

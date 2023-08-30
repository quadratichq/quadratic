import { Button } from '@mui/material';
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
          variant="contained"
          size="small"
          disableElevation
          onClick={() => {
            setEditorInteractionState((prev) => ({ ...prev, showShareFileMenu: !prev.showShareFileMenu }));
          }}
          sx={{ alignSelf: 'center' }}
        >
          Share
        </Button>
      ) : (
        <Button
          replace
          component={Link}
          to={ROUTES.LOGIN}
          variant="outlined"
          size="small"
          disableElevation
          sx={{ alignSelf: 'center' }}
        >
          Log in
        </Button>
      )}
    </>
  );
};

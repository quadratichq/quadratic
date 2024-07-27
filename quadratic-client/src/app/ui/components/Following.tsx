import { StopCircleOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useSetRecoilState } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import type { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { displayName } from '@/shared/utils/userUtil';

interface Props {
  follow?: MultiplayerUser;
}

export const Following = (props: Props) => {
  const { follow } = props;
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  if (!follow) return null;

  const stopFollowing = () => {
    setEditorInteractionState((editorInteractionStateAtom) => {
      return { ...editorInteractionStateAtom, follow: undefined };
    });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        padding: 'calc(0.3rem - 3px) 1rem 0.3rem',
        background: follow.colorString,
        color: 'white',
        fontSize: '0.85rem',
        width: 'fit-content',
        height: 'fit-content',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        transform: 'translateX(-50%)',
      }}
    >
      <div>Following {displayName(follow, false)}</div>
      <IconButton aria-label="stop" onClick={stopFollowing} sx={{ padding: 0 }}>
        <StopCircleOutlined sx={{ color: 'white' }} />
      </IconButton>
    </div>
  );
};

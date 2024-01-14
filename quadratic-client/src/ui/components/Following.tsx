import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { convertName } from '@/utils/userUtil';
import { StopCircleOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useSetRecoilState } from 'recoil';

interface Props {
  follow?: MultiplayerUser;
}

export const Following = (props: Props) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  if (!props.follow) return null;

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
        padding: '0 0.25rem 0 1rem',
        background: 'red',
        color: 'white',
        fontSize: '0.85rem',
        width: 'fit-content',
        height: 'fit-content',
        display: 'flex',
        alignItems: 'center',
        transform: 'translateX(-50%)',
      }}
    >
      <div>Following {convertName(props.follow, false)}</div>
      <IconButton aria-label="stop" onClick={stopFollowing}>
        <StopCircleOutlined style={{ color: 'white' }} />
      </IconButton>
    </div>
  );
};

import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { convertName } from '@/utils/userUtil';
import { StopCircleOutlined } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useSetRecoilState } from 'recoil';

interface Props {
  follow?: MultiplayerUser;
  color?: string;
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
        padding: 'calc(0.3rem - 3px) 1rem 0.3rem',
        background: props.color,
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
      <div>Following {convertName(props.follow, false)}</div>
      <IconButton aria-label="stop" onClick={stopFollowing} sx={{ padding: 0 }}>
        <StopCircleOutlined sx={{ color: 'white' }} />
      </IconButton>
    </div>
  );
};

import { editorInteractionStateFollowAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { StopCircleIcon } from '@/shared/components/Icons';
import { displayName } from '@/shared/utils/userUtil';
import { useMemo } from 'react';
import { useRecoilState } from 'recoil';

export const Following = () => {
  const [editorInteractionStateFollow, setFollow] = useRecoilState(editorInteractionStateFollowAtom);
  const { users } = useMultiplayerUsers();
  const follow = useMemo(
    () =>
      editorInteractionStateFollow ? users.find((user) => user.session_id === editorInteractionStateFollow) : undefined,
    [editorInteractionStateFollow, users]
  );

  if (!follow) return null;

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-r rounded-s px-4 py-1.5 text-sm text-white"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          background: follow.colorString,
          width: 'fit-content',
          height: 'fit-content',
          transform: 'translateX(-50%)',
        }}
      >
        Following {displayName(follow, false)}
        <button
          aria-label="Stop following"
          className="flex items-center opacity-80 hover:opacity-100"
          onClick={() => setFollow(undefined)}
        >
          <StopCircleIcon />
        </button>
      </div>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'absolute',
          border: follow ? `3px solid ${follow.colorString}` : '',
          pointerEvents: 'none',
        }}
      ></div>
    </>
  );
};

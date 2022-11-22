import { colors } from '../../theme/colors';

import { isElectron } from '../../utils/isElectron';

import { electronMaximizeCurrentWindow } from '../../helpers/electronMaximizeCurrentWindow';

export const TopBar = (props: any) => {
  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(255, 255, 255)',
        color: '#212121',
        //@ts-expect-error
        WebkitAppRegion: 'drag', // this allows the window to be dragged in Electron
        paddingLeft: isElectron() ? '4.5rem' : '2rem',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        paddingRight: '1rem',
        border: colors.mediumGray,
        borderWidth: '0 0 1px 0',
        borderStyle: 'solid',
        zIndex: 10000000,
      }}
      onDoubleClick={(event) => {
        // if clicked (not child clicked), maximize window. For electron.
        if (event.target === event.currentTarget) electronMaximizeCurrentWindow();
      }}
    >
      {props.children}
    </div>
  );
};

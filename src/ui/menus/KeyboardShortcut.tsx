import { useMemo } from 'react';
import { isMac } from '../../utils/isMac';

export interface IKeyboardShortcut {
  text: string;
  shortcut?: string;
  ctrl?: boolean;
}

export const KeyboardShortcut = (props: IKeyboardShortcut): JSX.Element => {
  const shortcut = useMemo(() => {
    if (!props.shortcut) return undefined;
    let shortcut = '';
    if (props.ctrl) {
      if (isMac()) {
        shortcut += '⌘ ';
      } else {
        shortcut += 'CTRL ';
      }
    }
    shortcut += props.shortcut;
    return shortcut;
  }, [props.shortcut, props.ctrl]);

  return <div style={{ display: 'flex', width: '175px' }}>
    <div style={{ width: '140px' }}>{props.text}</div>
    {shortcut && <div style={{ fontSize: '14px', color: '#aaaaaa' }}>{shortcut}</div>}
  </div>
}

export interface IKeyboardShortcut {
  text: string;
  shortcut: string;
  modifier?: string;
}

export const KeyboardShortcut = ({ modifier = '', shortcut, text }: IKeyboardShortcut): JSX.Element => {
  return (
    <div style={{ display: 'flex', width: '175px', justifyContent: 'space-between' }}>
      <div style={{ width: '140px' }}>{text}</div>
      <div style={{ fontSize: '14px', color: '#aaaaaa' }}>{modifier + shortcut}</div>
    </div>
  );
};

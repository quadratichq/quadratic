export interface IKeyboardShortcut {
  text: string;
  shortcut: string;
  modifier?: string;
  icon?: JSX.Element | undefined;
}

export const KeyboardShortcut = ({ modifier = '', shortcut, text, icon }: IKeyboardShortcut): JSX.Element => {
  return (
    <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {icon && icon}
        {text}
      </div>
      <div style={{ marginLeft: '24px', fontSize: '14px', color: '#aaaaaa' }}>{modifier + shortcut}</div>
    </div>
  );
};

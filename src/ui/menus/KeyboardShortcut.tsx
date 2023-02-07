export interface IKeyboardShortcut {
  text: string;
  shortcut: string;
  modifier?: string;
  icon?: JSX.Element | undefined;
}

export const KeyboardShortcut = ({ modifier = '', shortcut, text, icon }: IKeyboardShortcut): JSX.Element => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '175px', justifyContent: 'space-between' }}>
      <div style={{ width: '140px', display: 'flex', alignItems: 'center' }}>
        {icon && icon}
        {text}
      </div>
      <div style={{ fontSize: '14px', color: '#aaaaaa' }}>{modifier + shortcut}</div>
    </div>
  );
};

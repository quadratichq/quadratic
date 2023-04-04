interface IMenuLineItem {
  primary: string;
  secondary?: string | JSX.Element;
  Icon?: any;
  // This is used for smaller menu items, like the floating formatting menu
  size?: 'default' | 'small';
}

export const MenuLineItem = (props: IMenuLineItem): JSX.Element => {
  const { primary, secondary, Icon, size = 'default' } = props;
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...(size === 'small' ? { fontSize: '.875rem' } : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {Icon && <Icon style={{ color: 'inherit' }} {...(size === 'small' ? { fontSize: 'small' } : {})} />}
        {primary}
      </div>
      {secondary && <div style={{ marginLeft: '24px', fontSize: '14px', color: '#aaaaaa' }}>{secondary}</div>}
    </div>
  );
};

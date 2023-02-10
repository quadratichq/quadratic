interface IMenuLineItem {
  primary: string;
  secondary?: string | JSX.Element;
  Icon?: any;
}

export const MenuLineItem = ({ primary, secondary, Icon }: IMenuLineItem): JSX.Element => {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {Icon && <Icon style={{ color: 'inherit' }} />}
        {primary}
      </div>
      {secondary && <div style={{ marginLeft: '24px', fontSize: '14px', color: '#aaaaaa' }}>{secondary}</div>}
    </div>
  );
};

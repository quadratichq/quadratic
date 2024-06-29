import { useTheme } from '@mui/material';

interface IMenuLineItem {
  primary: string;
  secondary?: string | JSX.Element | React.ReactNode;
  icon?: any;
  iconColor?: string;
  indent?: boolean;
}

export const MenuLineItem = (props: IMenuLineItem): JSX.Element => {
  const { primary, secondary, icon: Icon, indent, iconColor } = props;
  const theme = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '.875rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          ...(indent && !Icon ? { paddingLeft: '2.25rem' } : {}),
        }}
      >
        {Icon && <Icon style={{ color: iconColor ?? 'inherit' }} fontSize="small" />}
        {primary}
      </div>
      {secondary && (
        <div style={{ marginLeft: '24px', fontSize: '14px', color: theme.palette.text.disabled }}>{secondary}</div>
      )}
    </div>
  );
};

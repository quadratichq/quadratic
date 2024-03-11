import { useTheme } from '@mui/material';

interface IMenuLineItem {
  primary: string;
  secondary?: string | JSX.Element | React.ReactNode;
  Icon?: any;
  indent?: boolean;
}

export const MenuLineItem = (props: IMenuLineItem): JSX.Element => {
  const { primary, secondary, Icon, indent } = props;
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
        {Icon && <Icon style={{ color: 'inherit' }} fontSize="small" />}
        {primary}
      </div>
      {secondary && (
        <div style={{ marginLeft: '24px', fontSize: '14px', color: theme.palette.text.disabled }}>{secondary}</div>
      )}
    </div>
  );
};

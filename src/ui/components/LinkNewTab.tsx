import { Link } from '@mui/material';

export function LinkNewTab(props: { href: string; children: React.ReactNode }) {
  const { href, children, ...rest } = props;
  return (
    <Link {...rest} href={href} target="_blank" rel="noopener">
      {children}
    </Link>
  );
}

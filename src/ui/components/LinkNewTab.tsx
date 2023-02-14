import { Link } from '@mui/material';

interface LinkNewTabProps {
  children: React.ReactNode;
  href: string;
}

export function LinkNewTab({ href, children, ...rest }: LinkNewTabProps) {
  return (
    <Link {...rest} href={href} target="_blank" rel="noopener">
      {children}
    </Link>
  );
}

import { ChevronRightIcon } from '@/shared/components/Icons';
import { Link } from 'react-router';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

export function FolderBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-0.5 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-0.5">
            {index > 0 && <ChevronRightIcon className="text-muted-foreground" />}
            {item.href && !isLast ? (
              <Link to={item.href} className="text-muted-foreground no-underline hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium' : 'text-muted-foreground'}>{item.name}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

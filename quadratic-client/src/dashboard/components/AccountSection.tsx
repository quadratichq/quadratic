import type { ReactNode } from 'react';

export function AccountSection({
  title,
  description,
  children,
}: {
  title: string | ReactNode;
  description: string | ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="w-full border-t border-border pb-4 pt-4">
      <h3 className="flex items-center gap-2 text-lg font-medium">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

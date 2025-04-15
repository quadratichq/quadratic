import { memo, type HTMLAttributes } from 'react';

export const TeamAvatar = memo(({ name, ...props }: { name: string } & HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-foreground capitalize text-background"
      {...props}
    >
      {name.slice(0, 1)}
    </div>
  );
});

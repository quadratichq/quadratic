import { Avatar, AvatarFallback, AvatarImage } from '@/shadcn/ui/avatar';
import { cn } from '@/shadcn/utils';
import { PersonIcon } from '@radix-ui/react-icons';

export function AvatarTeam({ className, src }: { className?: string; src?: string }) {
  return (
    <Avatar className={cn(className, 'rounded bg-transparent')}>
      <AvatarImage src={src} />
      <AvatarFallback className={'rounded bg-transparent text-muted-foreground'}>
        <PersonIcon />
        <PersonIcon className="-ml-1" />
      </AvatarFallback>
    </Avatar>
  );
}

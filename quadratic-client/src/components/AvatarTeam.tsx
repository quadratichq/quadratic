import { Avatar, AvatarFallback, AvatarImage } from '@/shadcn/ui/avatar';
import { PersonIcon } from '@radix-ui/react-icons';

export function AvatarTeam({ className, src }: { className?: string; src?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={src} />
      <AvatarFallback className={'bg-muted text-muted-foreground'}>
        <PersonIcon />
      </AvatarFallback>
    </Avatar>
  );
}

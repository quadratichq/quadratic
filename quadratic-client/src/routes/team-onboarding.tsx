import { CreateTeamForm } from '@/routes/teams.create';
import { Type } from '@/shared/components/Type';

export const Component = () => {
  return (
    <div className="m-auto mt-8 max-w-lg rounded border border-border p-8 shadow-lg">
      <img src="/logo192.png" width="32" height="32" alt="Quadratic logo" className="mb-6" />
      <Type as="h1" className="text-xl font-medium">
        Create a team
      </Type>
      <Type className="mb-6 text-muted-foreground">
        A team is your collaborative space for working with other people.
      </Type>
      <CreateTeamForm />
    </div>
  );
};

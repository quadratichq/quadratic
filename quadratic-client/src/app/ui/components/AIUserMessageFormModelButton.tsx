import { AIIcon, ArrowDropDownIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';
import { Link } from 'react-router';

const modelsById = {
  basic: { label: 'Basic', description: 'good for everyday tasks' },
  pro: { label: 'Pro', description: 'smartest and most capable' },
};

export const AIUserMessageFormModelButton = () => {
  const isFreeUser = false; // TODO: Pull this from...? will probably have to update API
  const [activeModel, setActiveModel] = useState<keyof typeof modelsById>(isFreeUser ? 'basic' : 'pro');
  const activeModelLabel = modelsById[activeModel].label;

  return (
    <Popover>
      {/* Needs a min-width or it shifts as the popover closes */}
      <PopoverTrigger className="group flex min-w-24 items-center justify-end gap-0 text-right">
        Model: {activeModelLabel} <ArrowDropDownIcon className="group-[[aria-expanded=true]]:rotate-180" />
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-2">
        <div className="mt-2 flex flex-col items-center">
          <AIIcon className="mb-2 text-primary" size="lg" />
          <h4 className="text-lg font-semibold">AI models</h4>
          <p className="text-sm text-muted-foreground">Choose the best fit for your needs.</p>
        </div>
        <form className="flex flex-col gap-1 rounded border border-border text-sm">
          <RadioGroup
            value={activeModel}
            onValueChange={(val) => setActiveModel(val as keyof typeof modelsById)}
            className="flex flex-col gap-0"
          >
            {Object.entries(modelsById).map(([id, { label, description }], i) => (
              <Label
                className={cn(
                  'cursor-pointer px-4 py-3 has-[:disabled]:cursor-not-allowed has-[[aria-checked=true]]:bg-accent has-[:disabled]:text-muted-foreground',
                  i !== 0 && 'border-t border-border'
                )}
                key={id}
              >
                <strong className="font-bold">{label}</strong>: <span className="font-normal">{description}</span>
                <RadioGroupItem value={id} className="float-right ml-auto" disabled={isFreeUser} />
              </Label>
            ))}
          </RadioGroup>
        </form>

        {isFreeUser && (
          <Button variant="link" asChild>
            <Link to={ROUTES.ACTIVE_TEAM_SETTINGS} target="_blank">
              Upgrade to Pro
            </Link>
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};

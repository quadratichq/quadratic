import { useConnectionsContext } from '@/shared/components/connections/ConnectionsContext';
import { Button } from '@/shared/shadcn/ui/button';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';

interface ConnectionFormSshProps {
  form: UseFormReturn<any>;
}

const DEFAULTS = {
  SSH_PORT: '22',
};

const Children = ({ form }: ConnectionFormSshProps) => {
  const { sshPublicKey } = useConnectionsContext();
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="sshHost"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>SSH host</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sshPort"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SSH port</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder={`e.g. ${DEFAULTS.SSH_PORT}`} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <FormField
          control={form.control}
          name="sshUsername"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SSH username</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ssh-public-key">SSH public key</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ssh-public-key"
            onClick={(e) => {
              e.currentTarget.select();
            }}
            readOnly
            autoComplete="off"
            value={sshPublicKey}
          />
          <CopyButton value={sshPublicKey} />
        </div>
        <FormDescription>This is your team’s public key (you’ll need it if you’re connecting via SSH).</FormDescription>
      </div>
    </>
  );
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-24"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

export const ConnectionFormSsh = ({ form }: ConnectionFormSshProps) => {
  const name = 'useSsh';
  const useSsh: boolean = form.watch(name);

  return (
    <>
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem className="space-y-0 pt-2">
            <FormLabel className="inline-flex items-center gap-2">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              Connect via SSH
            </FormLabel>
            <FormMessage />
          </FormItem>
        )}
      />

      {useSsh && <Children form={form} />}
    </>
  );
};

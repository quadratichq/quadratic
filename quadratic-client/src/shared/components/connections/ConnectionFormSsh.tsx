import { ConnectionFormSshKey } from '@/shared/components/connections/ConnectionFormSshKey';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Switch } from '@/shared/shadcn/ui/switch';
import type { UseFormReturn } from 'react-hook-form';

interface ConnectionFormSshProps {
  form: UseFormReturn<any>;
}

const DEFAULTS = {
  SSH_PORT: '22',
};

const Children = ({ form, showSsh }: ConnectionFormSshProps & { showSsh: boolean }) => {
  if (!showSsh) return null;

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

      <div className="grid grid-cols-2 gap-4">
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
        <FormField
          control={form.control}
          name="sshKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SSH public key</FormLabel>
              <FormControl>
                <ConnectionFormSshKey {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
};

// Change the component signature to use the new props type
export const ConnectionFormSsh = ({ form }: ConnectionFormSshProps) => {
  return (
    <>
      <FormField
        control={form.control}
        name="useSsh"
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

      <Children form={form} showSsh={form.getValues('useSsh')} />
    </>
  );
};

import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { ConnectionInputSshKey } from '@/shared/components/connections/ConnectionInputSshKey';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Switch } from '@mui/material';
import type { UseFormReturn } from 'react-hook-form';

interface ConnectionFormSshProps {
  form: UseFormReturn<any>;
}

const DEFAULTS = {
  SSH_PORT: '22',
};

const Children = ({ form, showSsh }: ConnectionFormSshProps & { showSsh: boolean }) => {
  const { data } = useConnectionsFetcher();
  const sshPublicKey = data?.sshPublicKey;

  if (!showSsh) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="sshHost"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>SSH Host</FormLabel>
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
              <FormLabel>SSH Port</FormLabel>
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
              <FormLabel>SSH Username</FormLabel>
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
              <FormLabel>SSH Key</FormLabel>
              <FormControl>
                <ConnectionInputSshKey value={sshPublicKey?.sshPublicKey} />
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
        render={({ field: { value, onChange, ...field } }) => (
          <FormItem className="col-span-4">
            <FormLabel className="flex items-center gap-2">Use SSH</FormLabel>
            <FormControl>
              <Switch checked={value} onChange={onChange} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Children form={form} showSsh={form.getValues('useSsh')} />
    </>
  );
};

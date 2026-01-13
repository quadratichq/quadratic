import { connectionFormSshAtom } from '@/shared/atom/connectionFormSshAtom';
import { useConnectionsContext } from '@/shared/components/connections/ConnectionsContext';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useEffect } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useSetRecoilState } from 'recoil';

interface ConnectionFormSshProps {
  form: UseFormReturn<any>;
}

const DEFAULTS = {
  SSH_PORT: '22',
};

const Children = ({ form }: ConnectionFormSshProps) => {
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
    </>
  );
};

// Component to sync SSH state to Recoil (only used when inside RecoilRoot)
const SshRecoilSync = ({ useSsh }: { useSsh: boolean }) => {
  const setUseSsh = useSetRecoilState(connectionFormSshAtom);

  useEffect(() => {
    setUseSsh(useSsh);

    return () => {
      setUseSsh(false);
    };
  }, [setUseSsh, useSsh]);

  return null;
};

// Change the component signature to use the new props type
export const ConnectionFormSsh = ({ form }: ConnectionFormSshProps) => {
  const name = 'useSsh';
  const useSsh: boolean = form.getValues(name);
  const { skipRecoilUpdates } = useConnectionsContext();

  return (
    <>
      {!skipRecoilUpdates && <SshRecoilSync useSsh={useSsh} />}
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

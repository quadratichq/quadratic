import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/shadcn/ui/form';
import { Input } from '@/shared/shadcn/ui/input';
import type { UseFormReturn } from 'react-hook-form';

export function isLocalHostAddress(host: string): boolean {
  host = host.trim();

  // Check for localhost variations
  if (host.includes('localhost')) return true;

  // Check for local IP ranges
  if (host.startsWith('127.')) return true; // Loopback addresses
  if (host.includes('0.0.0.0')) return true; // Default route
  if (host.startsWith('169.254.')) return true; // Link-local addresses

  return false;
}

export const ConnectionInputHost = ({ form }: { form: UseFormReturn<any> }) => {
  const useSsh = form.watch('useSsh');

  return (
    <FormField
      control={form.control}
      name="host"
      render={({ field }) => (
        <FormItem className="col-span-2">
          <FormLabel>Hostname (IP or domain)</FormLabel>
          <FormControl>
            <Input autoComplete="off" {...field} />
          </FormControl>
          <FormMessage />
          {field.value && !useSsh && isLocalHostAddress(field.value) && (
            <p className="text-sm text-muted-foreground">
              Please note: Quadratic runs in the cloud. Connecting to a local database has limited support.
            </p>
          )}
        </FormItem>
      )}
    />
  );
};

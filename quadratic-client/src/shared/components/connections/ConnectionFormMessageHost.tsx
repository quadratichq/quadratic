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

<<<<<<< HEAD
export const ConnectionFormMessageHost = ({ value }: { value: string | undefined }) => {
=======
export const ConnectionFormMessageHost = ({ value }: { value?: string }) => {
>>>>>>> origin/qa
  return value && isLocalHostAddress(value) ? (
    <p className="text-xs text-muted-foreground">
      Note: Quadratic runs in the cloud. Connecting to a local database requires SSH or self-hosting.
    </p>
  ) : null;
};

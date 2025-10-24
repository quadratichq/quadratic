import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks if a port is being used and kills the process if it is.
 * Fast implementation using platform-specific commands.
 *
 * @param port - The port number to check and kill
 * @param method - The protocol method (tcp or udp), defaults to tcp
 * @returns Promise that resolves when done, rejects if port is invalid
 */
export async function killPort(port: number, method: 'tcp' | 'udp' = 'tcp'): Promise<void> {
  if (!port || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${port}`);
  }

  try {
    if (process.platform === 'win32') {
      // Windows: Use netstat to find PIDs and TaskKill to terminate them
      const { stdout } = await execAsync('netstat -nao');

      if (!stdout) return;

      const lines = stdout.split('\n');
      const lineWithLocalPortRegEx = new RegExp(
        `^ *${method.toUpperCase()} *[^ ]*:${port}`,
        'gm'
      );
      const linesWithLocalPort = lines.filter(line => line.match(lineWithLocalPortRegEx));

      if (linesWithLocalPort.length === 0) return;

      const pids = linesWithLocalPort.reduce((acc: string[], line) => {
        const match = line.match(/(\d+)\s*$/);
        const pid = match && match[1];
        return pid && !acc.includes(pid) ? [...acc, pid] : acc;
      }, []);

      if (pids.length > 0) {
        await execAsync(`TaskKill /F /PID ${pids.join(' /PID ')}`);
      }
    } else {
      // macOS/Linux: Use lsof to find and kill the process listening on the port
      // For TCP, we use -sTCP:LISTEN to only match processes that are listening, not just connected
      // For UDP, there's no LISTEN state, so we match any process using the port
      const stateFilter = method === 'tcp' ? '-sTCP:LISTEN' : '';
      const command = `lsof -ti ${method}:${port} ${stateFilter} | xargs -r kill -9 2>/dev/null || true`;
      await execAsync(command);
    }
  } catch (error) {
    // Silently ignore errors - port may not be in use
    // This makes it safe to call even if nothing is running
  }
}
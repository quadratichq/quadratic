import '@/app/web-workers/pythonWebWorker/worker/python';
import { pythonClient } from '@/app/web-workers/pythonWebWorker/worker/pythonClient';

pythonClient.start();

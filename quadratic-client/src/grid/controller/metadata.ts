import { GridMetadata } from '@/web-workers/coreWebWorker/coreMessages';

class Metadata {
  load(metadata: GridMetadata) {
    console.log(metadata);
  }
}

export const metadata = new Metadata();

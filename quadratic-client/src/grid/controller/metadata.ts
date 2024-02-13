import { GridMetadata } from '@/web-workers/coreWebWorker/coreMessages';

class Metadata {
  private metadata?: GridMetadata;

  load(metadata: GridMetadata) {
    this.metadata = metadata;

    // todo...
  }
}

export const metadata = new Metadata();

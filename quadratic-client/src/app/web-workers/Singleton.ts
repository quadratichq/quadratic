import { debugFlag } from '@/app/debugFlags/debugFlags';

export class Singleton {
  private static instances = new Map<Function, any>();

  constructor() {
    const constructor = this.constructor;

    if (Singleton.instances.has(constructor)) {
      return Singleton.instances.get(constructor);
    }

    Singleton.instances.set(constructor, this);

    if (debugFlag('debugWebWorkers')) console.log(`[Singleton] ${constructor.name} initialized`);
  }

  refreshSingleton() {
    const constructor = this.constructor;
    Singleton.instances.delete(constructor);

    if (debugFlag('debugWebWorkers')) console.log(`[Singleton] ${constructor.name} refreshed`);
  }
}

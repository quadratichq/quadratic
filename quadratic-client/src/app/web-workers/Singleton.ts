import { debugFlag } from '@/app/debugFlags/debugFlags';

/**
 * Singleton class to ensure only one instance of a class is created.
 * Allows for easy refreshing of the singleton instance.
 * Intended to be used for web worker messengers, but can be used for any class.
 * Meant to be extended by the class it is managing.
 */
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

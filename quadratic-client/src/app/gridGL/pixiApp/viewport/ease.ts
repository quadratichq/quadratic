import Penner from 'penner';

/**
 * Returns correct Penner equation using string or Function.
 *
 * @internal
 * @ignore
 * @param {(function|string)} [ease]
 * @param {defaults} default penner equation to use if none is provided
 */

export default function ease(ease: any, defaults?: keyof typeof Penner): any {
  if (!ease) {
    return Penner[defaults as keyof typeof Penner];
  } else if (typeof ease === 'function') {
    return ease;
  } else if (typeof ease === 'string') {
    return Penner[ease as keyof typeof Penner];
  }
}

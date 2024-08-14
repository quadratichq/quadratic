import { describe, expect, it } from 'vitest';
import { intersects } from './intersects';
import { numbersToRect } from '@/app/web-workers/quadraticCore/worker/rustConversions';

describe('intersects', () => {
  it('rectRect', () => {
    const r1 = numbersToRect(0, 0, 2, 2);
    const r2 = numbersToRect(1, 1, 2, 2);
    expect(intersects.rectRect(r1, r2)).toBe(true);
  });
});

// Unmock so we can test the real implementation (global jest.setup.js mocks this module)
jest.unmock('./stripe');

import type Stripe from 'stripe';
import { selectBestSubscription } from './stripe';

// Helper to create a mock subscription with the minimum fields needed
const mockSubscription = (
  overrides: Partial<Stripe.Subscription> & { id: string; status: Stripe.Subscription.Status }
): Stripe.Subscription =>
  ({
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  }) as Stripe.Subscription;

describe('selectBestSubscription', () => {
  it('throws when given an empty array', () => {
    expect(() => selectBestSubscription([])).toThrow('selectBestSubscription called with empty array');
  });

  it('returns the only subscription when there is exactly one', () => {
    const sub = mockSubscription({ id: 'sub_1', status: 'active' });
    expect(selectBestSubscription([sub])).toBe(sub);
  });

  it('prefers active over incomplete', () => {
    const incomplete = mockSubscription({ id: 'sub_incomplete', status: 'incomplete', created: 100 });
    const active = mockSubscription({ id: 'sub_active', status: 'active', created: 50 });
    expect(selectBestSubscription([incomplete, active]).id).toBe('sub_active');
  });

  it('prefers active over incomplete_expired', () => {
    const expired = mockSubscription({ id: 'sub_expired', status: 'incomplete_expired', created: 200 });
    const active = mockSubscription({ id: 'sub_active', status: 'active', created: 100 });
    expect(selectBestSubscription([expired, active]).id).toBe('sub_active');
  });

  it('prefers active over canceled', () => {
    const canceled = mockSubscription({ id: 'sub_canceled', status: 'canceled', created: 200 });
    const active = mockSubscription({ id: 'sub_active', status: 'active', created: 100 });
    expect(selectBestSubscription([canceled, active]).id).toBe('sub_active');
  });

  it('prefers trialing over incomplete', () => {
    const incomplete = mockSubscription({ id: 'sub_incomplete', status: 'incomplete', created: 200 });
    const trialing = mockSubscription({ id: 'sub_trialing', status: 'trialing', created: 100 });
    expect(selectBestSubscription([incomplete, trialing]).id).toBe('sub_trialing');
  });

  it('prefers the more recently created subscription when statuses are the same', () => {
    const older = mockSubscription({ id: 'sub_older', status: 'active', created: 100 });
    const newer = mockSubscription({ id: 'sub_newer', status: 'active', created: 200 });
    expect(selectBestSubscription([older, newer]).id).toBe('sub_newer');
  });

  it('handles three subscriptions and picks the active one', () => {
    const incomplete = mockSubscription({ id: 'sub_incomplete', status: 'incomplete', created: 300 });
    const active = mockSubscription({ id: 'sub_active', status: 'active', created: 200 });
    const pastDue = mockSubscription({ id: 'sub_past_due', status: 'past_due', created: 100 });
    expect(selectBestSubscription([incomplete, active, pastDue]).id).toBe('sub_active');
  });

  it('does not mutate the input array', () => {
    const first = mockSubscription({ id: 'sub_1', status: 'active', created: 100 });
    const second = mockSubscription({ id: 'sub_2', status: 'trialing', created: 200 });
    const input = [first, second];
    selectBestSubscription(input);
    expect(input[0]).toBe(first);
    expect(input[1]).toBe(second);
  });
});

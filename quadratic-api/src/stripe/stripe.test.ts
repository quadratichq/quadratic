// Unmock so we can test the real implementation (global jest.setup.js mocks this module)
jest.unmock('./stripe');

import type Stripe from 'stripe';
import {
  addOverageSubscriptionItem,
  cancelIncompleteSubscriptions,
  findSeatItem,
  removeOverageSubscriptionItem,
  reportUsageToStripe,
  selectBestSubscription,
  stripe as stripeClient,
} from './stripe';

// Helper to create a mock subscription with the minimum fields needed
const mockSubscription = (
  overrides: Partial<Stripe.Subscription> & { id: string; status: Stripe.Subscription.Status }
): Stripe.Subscription =>
  ({
    current_period_start: Math.floor(Date.now() / 1000),
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

  it('prefers active over paused', () => {
    const paused = mockSubscription({ id: 'sub_paused', status: 'paused', created: 200 });
    const active = mockSubscription({ id: 'sub_active', status: 'active', created: 100 });
    expect(selectBestSubscription([paused, active]).id).toBe('sub_active');
  });

  it('ranks paused as lowest priority', () => {
    const paused = mockSubscription({ id: 'sub_paused', status: 'paused', created: 200 });
    const incompleteExpired = mockSubscription({ id: 'sub_expired', status: 'incomplete_expired', created: 100 });
    expect(selectBestSubscription([paused, incompleteExpired]).id).toBe('sub_expired');
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

describe('cancelIncompleteSubscriptions', () => {
  let mockRetrieve: jest.SpyInstance;
  let mockCancel: jest.SpyInstance;

  beforeEach(() => {
    mockRetrieve = jest.spyOn(stripeClient.customers, 'retrieve');
    mockCancel = jest.spyOn(stripeClient.subscriptions, 'cancel').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 0 for a deleted customer', async () => {
    mockRetrieve.mockResolvedValue({ id: 'cus_1', deleted: true });
    const count = await cancelIncompleteSubscriptions('cus_1');
    expect(count).toBe(0);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('returns 0 when there are no subscriptions', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'cus_1',
      deleted: false,
      subscriptions: { data: [] },
    });
    const count = await cancelIncompleteSubscriptions('cus_1');
    expect(count).toBe(0);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('returns 0 and does not cancel active subscriptions', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'cus_1',
      deleted: false,
      subscriptions: {
        data: [mockSubscription({ id: 'sub_active', status: 'active' })],
      },
    });
    const count = await cancelIncompleteSubscriptions('cus_1');
    expect(count).toBe(0);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels incomplete subscriptions', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'cus_1',
      deleted: false,
      subscriptions: {
        data: [mockSubscription({ id: 'sub_incomplete', status: 'incomplete' })],
      },
    });
    const count = await cancelIncompleteSubscriptions('cus_1');
    expect(count).toBe(1);
    expect(mockCancel).toHaveBeenCalledWith('sub_incomplete');
  });

  it('does not cancel incomplete_expired subscriptions (already terminal)', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'cus_1',
      deleted: false,
      subscriptions: {
        data: [mockSubscription({ id: 'sub_expired', status: 'incomplete_expired' })],
      },
    });
    const count = await cancelIncompleteSubscriptions('cus_1');
    expect(count).toBe(0);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels only incomplete subs when mixed with active and incomplete_expired', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'cus_1',
      deleted: false,
      subscriptions: {
        data: [
          mockSubscription({ id: 'sub_active', status: 'active' }),
          mockSubscription({ id: 'sub_incomplete_1', status: 'incomplete' }),
          mockSubscription({ id: 'sub_incomplete_2', status: 'incomplete' }),
          mockSubscription({ id: 'sub_expired', status: 'incomplete_expired' }),
        ],
      },
    });
    const count = await cancelIncompleteSubscriptions('cus_1');
    expect(count).toBe(2);
    expect(mockCancel).toHaveBeenCalledTimes(2);
    expect(mockCancel).toHaveBeenCalledWith('sub_incomplete_1');
    expect(mockCancel).toHaveBeenCalledWith('sub_incomplete_2');
  });
});

const mockSubscriptionItem = (overrides: Partial<Stripe.SubscriptionItem> & { id: string }): Stripe.SubscriptionItem =>
  ({
    price: {
      recurring: { usage_type: 'licensed' },
    },
    quantity: 3,
    ...overrides,
  }) as Stripe.SubscriptionItem;

describe('findSeatItem', () => {
  it('returns the licensed item when it is the only item', () => {
    const seat = mockSubscriptionItem({ id: 'si_seat' });
    expect(findSeatItem([seat])).toBe(seat);
  });

  it('returns the licensed item when mixed with a metered overage item', () => {
    const seat = mockSubscriptionItem({ id: 'si_seat' });
    const overage = mockSubscriptionItem({
      id: 'si_overage',
      price: { recurring: { usage_type: 'metered' } } as Stripe.Price,
    });
    expect(findSeatItem([overage, seat]).id).toBe('si_seat');
  });

  it('returns the first licensed item when there are multiple non-metered items', () => {
    const seat1 = mockSubscriptionItem({ id: 'si_seat_1' });
    const seat2 = mockSubscriptionItem({ id: 'si_seat_2' });
    expect(findSeatItem([seat1, seat2]).id).toBe('si_seat_1');
  });

  it('throws when all items are metered', () => {
    const metered = mockSubscriptionItem({
      id: 'si_metered',
      price: { recurring: { usage_type: 'metered' } } as Stripe.Price,
    });
    expect(() => findSeatItem([metered])).toThrow('Subscription does not have a seat item');
  });

  it('throws when given an empty array', () => {
    expect(() => findSeatItem([])).toThrow('Subscription does not have a seat item');
  });

  it('treats items without recurring info as seat items', () => {
    const noRecurring = mockSubscriptionItem({
      id: 'si_no_recurring',
      price: { recurring: null } as unknown as Stripe.Price,
    });
    expect(findSeatItem([noRecurring]).id).toBe('si_no_recurring');
  });
});

describe('addOverageSubscriptionItem', () => {
  let mockPricesList: jest.SpyInstance;
  let mockItemCreate: jest.SpyInstance;

  beforeEach(() => {
    mockPricesList = jest.spyOn(stripeClient.prices, 'list');
    mockItemCreate = jest.spyOn(stripeClient.subscriptionItems, 'create');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a subscription item with the overage price', async () => {
    mockPricesList.mockResolvedValue({ data: [{ id: 'price_overage_123' }] });
    mockItemCreate.mockResolvedValue({ id: 'si_overage_456' });

    const itemId = await addOverageSubscriptionItem('sub_abc');

    expect(itemId).toBe('si_overage_456');
    expect(mockPricesList).toHaveBeenCalledWith({
      lookup_keys: ['ai_overage_per_cent'],
      active: true,
    });
    expect(mockItemCreate).toHaveBeenCalledWith({
      subscription: 'sub_abc',
      price: 'price_overage_123',
    });
  });

  it('throws when no overage price exists', async () => {
    mockPricesList.mockResolvedValue({ data: [] });

    await expect(addOverageSubscriptionItem('sub_abc')).rejects.toThrow(
      'No AI overage price found (lookup_key: ai_overage_per_cent)'
    );
    expect(mockItemCreate).not.toHaveBeenCalled();
  });
});

describe('removeOverageSubscriptionItem', () => {
  let mockItemDel: jest.SpyInstance;

  beforeEach(() => {
    mockItemDel = jest.spyOn(stripeClient.subscriptionItems, 'del').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes the subscription item', async () => {
    await removeOverageSubscriptionItem('si_overage_456');
    expect(mockItemDel).toHaveBeenCalledWith('si_overage_456');
  });
});

describe('reportUsageToStripe', () => {
  let mockMeterEventsCreate: jest.SpyInstance;

  beforeEach(() => {
    mockMeterEventsCreate = jest.spyOn(stripeClient.billing.meterEvents, 'create').mockResolvedValue({} as any);
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a meter event with correct parameters', async () => {
    await reportUsageToStripe('cus_abc', 347);

    expect(mockMeterEventsCreate).toHaveBeenCalledWith({
      event_name: 'ai_overage_cents',
      timestamp: 1700000000,
      payload: {
        value: '347',
        stripe_customer_id: 'cus_abc',
      },
    });
  });

  it('converts cents to string in payload', async () => {
    await reportUsageToStripe('cus_abc', 1);

    expect(mockMeterEventsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ value: '1' }),
      })
    );
  });
});

import type { ClientCoreMessage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import { expect, test, vi } from 'vitest';
import { quadraticCore } from './quadraticCore';

// Mock the worker and its postMessage method
const mockWorker = {
  postMessage: vi.fn(),
};

// Mock the quadraticCore instance
vi.spyOn(quadraticCore, 'send').mockImplementation((message: ClientCoreMessage) => {
  mockWorker.postMessage(message);
});

test('resizeAllColumns should send correct message to worker', () => {
  const sheetId = 'test-sheet';
  const size = 100;

  quadraticCore.resizeAllColumns(sheetId, size);

  expect(mockWorker.postMessage).toHaveBeenCalledWith({
    type: 'clientCoreResizeAllColumns',
    sheetId,
    size,
  });
});

test('resizeAllRows should send correct message to worker', () => {
  const sheetId = 'test-sheet';
  const size = 50;

  quadraticCore.resizeAllRows(sheetId, size);

  expect(mockWorker.postMessage).toHaveBeenCalledWith({
    type: 'clientCoreResizeAllRows',
    sheetId,
    size,
  });
});

import { Chat, defaultAIAnalystContext } from '@/app/atoms/aiAnalystAtom';
import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { aiAnalystOfflineChats } from './aiAnalyst';

describe('aiAnalystOfflineChats', () => {
  beforeAll(async () => {
    await aiAnalystOfflineChats.init('test@example.com', 'test-uuid');
  });

  beforeEach(async () => {
    await aiAnalystOfflineChats.testClear();
  });

  it('properly defines user email and uuid', () => {
    expect(aiAnalystOfflineChats).toBeDefined();
    expect(aiAnalystOfflineChats.userEmail).toBe('test@example.com');
    expect(aiAnalystOfflineChats.uuid).toBe('test-uuid');
  });

  it('loads empty chats', async () => {
    expect(await aiAnalystOfflineChats.loadChats()).toStrictEqual([]);
  });

  it('saves and loads chats', async () => {
    const testChats: Chat[] = [
      {
        id: '1',
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [
          { role: 'user', content: 'test1', contextType: 'quadraticDocs' },
          {
            role: 'assistant',
            model: 'gpt-4o-2024-08-06',
            content: 'response1',
            contextType: 'quadraticDocs',
          },
        ],
      },
      {
        id: '2',
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [
          { role: 'user', content: 'test2', contextType: 'userPrompt', context: defaultAIAnalystContext },
          {
            role: 'assistant',
            model: 'gpt-4o-2024-08-06',
            content: 'response2',
            contextType: 'userPrompt',
            toolCalls: [],
          },
        ],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    const loadedChats = await aiAnalystOfflineChats.loadChats();

    expect(loadedChats.length).toBe(2);
    expect(loadedChats[0].id).toBe('1');
    expect(loadedChats[0].name).toBe('Chat 1');
    expect(loadedChats[0].messages.length).toBe(0); // Only userPrompt messages are stored
    expect(loadedChats[1].id).toBe('2');
    expect(loadedChats[1].name).toBe('Chat 2');
    expect(loadedChats[1].messages[0].content).toBe('test2');
    expect(loadedChats[1].messages[1].content).toBe('response2');
  });

  it('deletes chats', async () => {
    const testChats: Chat[] = [
      {
        id: '1',
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
      {
        id: '2',
        name: 'Chat 2',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test2', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
      {
        id: '3',
        name: 'Chat 3',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test3', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(3);

    await aiAnalystOfflineChats.deleteChats(['2']);

    const loadedChats = await aiAnalystOfflineChats.loadChats();
    expect(loadedChats.length).toBe(2);
    expect(loadedChats[0].id).toBe('1');
    expect(loadedChats[1].id).toBe('3');
  });

  it('filters chats by userEmail', async () => {
    // Save chats with current userEmail
    const testChats: Chat[] = [
      {
        id: '1',
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
    ];

    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(1);

    await aiAnalystOfflineChats.init('different@example.com', 'test-uuid');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });

  it('filters chats by uuid', async () => {
    // Save chats with current uuid
    const testChats: Chat[] = [
      {
        id: '1',
        name: 'Chat 1',
        lastUpdated: Date.now(),
        messages: [{ role: 'user', content: 'test1', contextType: 'userPrompt', context: defaultAIAnalystContext }],
      },
    ];
    await aiAnalystOfflineChats.saveChats(testChats);
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(1);

    // Init with different uuid
    await aiAnalystOfflineChats.init('test@example.com', 'different-uuid');
    expect((await aiAnalystOfflineChats.loadChats()).length).toBe(0);
  });
});

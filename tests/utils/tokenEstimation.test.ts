import { describe, it, expect } from 'vitest';
import { estimateTokens, computeMessageBudget, pruneMessages } from '../../utils/tokenEstimation';
import type { ChatMessage } from '../../types';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('divides by 4 and rounds up', () => {
    expect(estimateTokens('Hello')).toBe(2); // 5 chars / 4 = 1.25 → ceil = 2
    expect(estimateTokens('Hi')).toBe(1); // 2 chars / 4 = 0.5 → ceil = 1
    expect(estimateTokens('12345678')).toBe(2); // 8 chars / 4 = 2
  });

  it('handles long text', () => {
    const text = 'a'.repeat(1000);
    expect(estimateTokens(text)).toBe(250);
  });
});

describe('computeMessageBudget', () => {
  it('subtracts system tokens, output tokens, and safety margin from context window', () => {
    const systemBlocks = [{ text: 'a'.repeat(400) }]; // 400/4 = 100 tokens
    const maxOutput = 4096;
    const budget = computeMessageBudget(systemBlocks, maxOutput);
    // 200_000 - 2_000 (safety) - 100 (system) - 4096 (output) = 193_804
    expect(budget).toBe(193804);
  });

  it('handles multiple system blocks', () => {
    const systemBlocks = [{ text: 'a'.repeat(400) }, { text: 'b'.repeat(800) }]; // 100 + 200 = 300 tokens
    const budget = computeMessageBudget(systemBlocks, 4096);
    // 200_000 - 2_000 - 300 - 4096 = 193_604
    expect(budget).toBe(193604);
  });

  it('returns negative when system blocks exceed context window', () => {
    const systemBlocks = [{ text: 'a'.repeat(800_000) }]; // 200_000 tokens — fills entire context
    const budget = computeMessageBudget(systemBlocks, 4096);
    expect(budget).toBeLessThan(0);
  });
});

describe('pruneMessages', () => {
  function makeChatMessage(overrides: Partial<ChatMessage>): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('returns just the user message when history is empty', () => {
    const { claudeMessages, dropped } = pruneMessages([], 'What is AI?', 10000);
    expect(dropped).toBe(0);
    expect(claudeMessages).toHaveLength(1);
    expect(claudeMessages[0].content).toBe('What is AI?');
  });

  it('includes history messages that fit in the budget', () => {
    const history: ChatMessage[] = [
      makeChatMessage({ role: 'user', content: 'Question 1' }),
      makeChatMessage({ role: 'assistant', content: 'Answer 1' }),
    ];
    const { claudeMessages, dropped } = pruneMessages(history, 'Question 2', 100000);
    expect(dropped).toBe(0);
    // 2 history messages + 1 new user message
    expect(claudeMessages).toHaveLength(3);
    expect(claudeMessages[2].content).toBe('Question 2');
  });

  it('filters out isCardContent assistant messages', () => {
    const history: ChatMessage[] = [
      makeChatMessage({ role: 'user', content: 'Generate a card' }),
      makeChatMessage({ role: 'assistant', content: 'Here is a long card...', isCardContent: true }),
      makeChatMessage({ role: 'user', content: 'Thanks' }),
      makeChatMessage({ role: 'assistant', content: "You're welcome" }),
    ];
    const { claudeMessages } = pruneMessages(history, 'Next question', 100000);
    // Card content (the 2nd message) should be filtered out
    // So: Q1, Thanks, You're welcome + Next question = 4 messages
    const allContent = claudeMessages.map((m) => m.content);
    expect(allContent).not.toContain('Here is a long card...');
    expect(allContent).toContain('Next question');
  });

  it('drops oldest messages when budget is tight', () => {
    // Each message is ~7 tokens (content is 25 chars → 7 tokens)
    const history: ChatMessage[] = [];
    for (let i = 0; i < 10; i++) {
      history.push(makeChatMessage({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message number ${i} here!` }));
    }
    // Budget: only 50 tokens — enough for ~7 messages at 7 tokens each, minus the user message
    const { claudeMessages, dropped } = pruneMessages(history, 'New message', 50);
    expect(dropped).toBeGreaterThan(0);
    // The new message should always be the last one
    expect(claudeMessages[claudeMessages.length - 1].content).toBe('New message');
  });

  it('converts system messages to user/assistant pairs', () => {
    const history: ChatMessage[] = [
      makeChatMessage({ role: 'system', content: 'You have new documents.' }),
    ];
    const { claudeMessages } = pruneMessages(history, 'Tell me about them', 100000);
    // System message becomes user + assistant('Understood.') pair, then new user message
    expect(claudeMessages[0].role).toBe('user');
    expect(claudeMessages[0].content).toBe('You have new documents.');
    expect(claudeMessages[1].role).toBe('assistant');
    expect(claudeMessages[1].content).toBe('Understood.');
    expect(claudeMessages[2].content).toBe('Tell me about them');
  });

  it('sends only the user message when even it barely fits', () => {
    // Budget = 3 tokens, user message is "Hi" = 1 token
    const history: ChatMessage[] = [
      makeChatMessage({ role: 'user', content: 'A'.repeat(100) }),
      makeChatMessage({ role: 'assistant', content: 'B'.repeat(100) }),
    ];
    const { claudeMessages, dropped } = pruneMessages(history, 'Hi', 1);
    expect(dropped).toBe(2);
    expect(claudeMessages).toHaveLength(1);
    expect(claudeMessages[0].content).toBe('Hi');
  });
});

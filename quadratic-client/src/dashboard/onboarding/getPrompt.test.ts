import { DEFAULT_PROMPT, getPrompt } from '@/dashboard/onboarding/getPrompt';
import type { OnboardingResponseV1 } from '@/dashboard/onboarding/Questions';
import { describe, expect, it } from 'vitest';

describe('getPrompt', () => {
  // Default prompt
  it('should return a generic prompt when a work response is "other"', () => {
    const data: OnboardingResponseV1 = {
      __version: 1,
      __createdAt: new Date().toISOString(),
      use: 'work',
      'work-role': 'other',
      'languages[]': ['javascript'],
      'goals[]': ['other'],
    };
    const result = getPrompt(data);
    expect(result).toEqual(DEFAULT_PROMPT);
  });

  // Custom prompts
  it('should return a custom prompt when a work use response is pre-canned', () => {
    const data: OnboardingResponseV1 = {
      __version: 1,
      __createdAt: new Date().toISOString(),
      use: 'work',
      'work-role': 'product',
      'languages[]': ['javascript'],
      'goals[]': ['ai'],
    };
    const result = getPrompt(data);
    expect(result).not.toEqual(DEFAULT_PROMPT);
  });
  it('should return a custom prompt when a personal use response is pre-canned', () => {
    const data: OnboardingResponseV1 = {
      __version: 1,
      __createdAt: new Date().toISOString(),
      use: 'personal',
      'personal-uses[]': ['ai', 'other'],
      'goals[]': ['ai'],
    };
    const result = getPrompt(data);
    expect(result).not.toEqual(DEFAULT_PROMPT);
  });
  it('should return a custom prompt when a education use response is pre-canned', () => {
    const data: OnboardingResponseV1 = {
      __version: 1,
      __createdAt: new Date().toISOString(),
      use: 'education',
      'education-identity': 'university-student',
      'education-subjects[]': ['math', 'other'],
      'goals[]': ['ai'],
    };
    const result = getPrompt(data);
    expect(result).not.toEqual(DEFAULT_PROMPT);
  });
});

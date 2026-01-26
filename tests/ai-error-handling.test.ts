import { describe, it, expect } from 'vitest';
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from '../src/lib/errors';

describe('AI Error Handling', () => {
  it('should create APIKeyError with correct properties', () => {
    const error = new APIKeyError('Groq', 401);
    expect(error).toBeInstanceOf(APIKeyError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('APIKeyError');
    expect(error.code).toBe('API_KEY_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Invalid or missing API key for Groq');
  });

  it('should create APIKeyError with default status code', () => {
    const error = new APIKeyError('OpenAI');
    expect(error).toBeInstanceOf(APIKeyError);
    expect(error.name).toBe('APIKeyError');
    expect(error.code).toBe('API_KEY_ERROR');
    expect(error.statusCode).toBeUndefined();
    expect(error.message).toBe('Invalid or missing API key for OpenAI');
  });

  it('should create RateLimitError with correct properties', () => {
    const error = new RateLimitError('Groq', 60);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RateLimitError');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.retryAfter).toBe(60);
    expect(error.message).toBe('Rate limit exceeded for Groq');
  });

  it('should create RateLimitError with default retry time', () => {
    const error = new RateLimitError('OpenAI');
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.name).toBe('RateLimitError');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.retryAfter).toBeUndefined();
    expect(error.message).toBe('Rate limit exceeded for OpenAI');
  });

  it('should create TimeoutError with correct properties', () => {
    const error = new TimeoutError('AI request for groq/llama', 10000);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TimeoutError');
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.timeoutMs).toBe(10000);
    expect(error.message).toBe('AI request for groq/llama timed out after 10000ms');
  });

  it('should create ParseError with correct properties', () => {
    const error = new ParseError('invalid response');
    expect(error).toBeInstanceOf(ParseError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ParseError');
    expect(error.code).toBe('PARSE_ERROR');
    expect(error.response).toBe('invalid response');
    expect(error.message).toBe('Failed to parse AI response');
  });

  it('should have proper inheritance chain', () => {
    const apiKeyError = new APIKeyError('Groq');
    const rateLimitError = new RateLimitError('OpenAI');
    const timeoutError = new TimeoutError('test', 5000);
    const parseError = new ParseError('test');

    expect(apiKeyError).toBeInstanceOf(Error);
    expect(rateLimitError).toBeInstanceOf(Error);
    expect(timeoutError).toBeInstanceOf(Error);
    expect(parseError).toBeInstanceOf(Error);
  });
});
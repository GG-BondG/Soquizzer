import { describe, expect, it } from 'vitest';
import { cannedReply } from './cannedReply.js';

describe('cannedReply', () => {
  it('greets back when the message is a greeting', () => {
    expect(cannedReply('hello')).toMatch(/hey there/i);
    expect(cannedReply('Hey!')).toMatch(/hey there/i);
    expect(cannedReply('你好')).toMatch(/hey there/i);
  });

  it('matches whole English words only: "this" is not "hi", "know" is not "no"', () => {
    expect(cannedReply('this is hard')).not.toMatch(/hey there/i);
    expect(cannedReply('I know it')).not.toMatch(/no worries/i);
  });

  it('answers agreement, disagreement and study talk', () => {
    expect(cannedReply('yes')).toMatch(/exactly/i);
    expect(cannedReply('that is wrong')).toMatch(/no worries/i);
    expect(cannedReply('I want to study')).toMatch(/perfect/i);
  });

  it('asks what is wrong for an empty message and still answers anything else', () => {
    expect(cannedReply('   ')).toMatch(/listening/i);
    expect(cannedReply('blah blah').length).toBeGreaterThan(0);
  });
});

import { CORRECT_LINES, pickLine } from './encouragements.js';

describe('CORRECT_LINES', () => {
  it('has unique ids and some text for each line', () => {
    expect(new Set(CORRECT_LINES.map((l) => l.id)).size).toBe(CORRECT_LINES.length);
    expect(CORRECT_LINES.every((l) => l.text.trim().length > 0)).toBe(true);
  });
});

describe('pickLine', () => {
  const lines = [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ];

  afterEach(() => vi.restoreAllMocks());

  it('never repeats the previous line', () => {
    for (const roll of [0, 0.34, 0.67, 0.999]) {
      vi.spyOn(Math, 'random').mockReturnValue(roll);
      expect(pickLine(lines, 'b').id).not.toBe('b');
    }
  });

  it('can pick any line when there is no previous one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickLine(lines, undefined).id).toBe('c');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickLine(lines, undefined).id).toBe('a');
  });

  it('repeats the only line there is', () => {
    expect(pickLine([lines[0]], 'a')).toBe(lines[0]);
  });
});

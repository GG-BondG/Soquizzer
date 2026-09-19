import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MathText from './MathText.jsx';

describe('MathText', () => {
  it('renders LaTeX-delimited math as KaTeX', () => {
    const { container } = render(<MathText text="The area is $a^2$ square units." />);
    expect(container.querySelector('.katex')).toBeTruthy();
    expect(container.textContent).toContain('The area is');
  });

  it('renders bare exponent notation (older Gemini output) as math too', () => {
    const { container } = render(<MathText text="T(n) <= 7n^3 for all n." />);
    expect(container.querySelector('.katex')).toBeTruthy();
  });

  it('renders bare subscript notation as math', () => {
    const { container } = render(<MathText text="The sequence x_1, x_2, x_3." />);
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
  });

  it('does not touch text that already has LaTeX delimiters (avoids double-processing)', () => {
    const { container } = render(<MathText text="$n^2$ is fine; bare_notation^here is not real math" />);
    expect(container.querySelectorAll('.katex').length).toBe(1);
    expect(container.textContent).toContain('bare_notation^here');
  });

  it('renders plain text with no math markers unchanged', () => {
    const { container } = render(<MathText text="Plain sentence, nothing special." />);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.textContent).toContain('Plain sentence, nothing special.');
  });

  it('renders nothing for empty text', () => {
    const { container } = render(<MathText text="" />);
    expect(container.textContent).toBe('');
  });

  it('does not wrap its output in a <p>, so it stays inline-safe inside a <span>', () => {
    const { container } = render(
      <span>
        <MathText text="inline $x^2$ text" />
      </span>
    );
    expect(container.querySelector('p')).toBeNull();
  });
});

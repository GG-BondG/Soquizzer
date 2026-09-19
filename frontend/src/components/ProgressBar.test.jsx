import { render, screen } from '@testing-library/react';
import ProgressBar from './ProgressBar.jsx';

describe('ProgressBar', () => {
  it('exposes its value as a progressbar', () => {
    render(<ProgressBar value={0.4} label="Generating" />);

    const bar = screen.getByRole('progressbar', { name: 'Generating' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.firstChild.style.width).toBe('40%');
  });

  it('keeps out-of-range values inside 0-100', () => {
    const { rerender } = render(<ProgressBar value={1.7} label="x" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');

    rerender(<ProgressBar value={-1} label="x" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });
});

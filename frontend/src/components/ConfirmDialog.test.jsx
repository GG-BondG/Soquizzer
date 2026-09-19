import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog.jsx';

function setup(props = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog open title="Delete “Bio”?" onConfirm={onConfirm} onCancel={onCancel} {...props}>
      This cannot be undone.
    </ConfirmDialog>
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the title, body and an optional error', () => {
    setup({ error: 'Could not delete' });

    expect(screen.getByRole('alertdialog', { name: 'Delete “Bio”?' })).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(screen.getByText('Could not delete')).toBeTruthy();
  });

  it('confirms and cancels through its buttons', async () => {
    const { onConfirm, onCancel } = setup({ confirmLabel: 'Remove' });

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', () => {
    const { onCancel } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cannot be dismissed or repeated while busy', async () => {
    const { onConfirm, onCancel } = setup({ busy: true });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    const working = screen.getByRole('button', { name: 'Deleting…' });
    expect(working.disabled).toBe(true);
    await userEvent.click(working);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
// Title: Modal Accessibility Test
// Path: src/components/ui/modal.test.tsx
// Functionality: Accessibility regression coverage for the shared Modal primitive —
//   dialog semantics, body scroll lock, focus containment + restoration, and Escape /
//   backdrop dismissal. jsdom has no layout engine, so focus lands on the dialog
//   container (the hook's visible-focusable filter sees nothing) rather than the first
//   child; the assertions check focus is *within* the dialog, which holds either way.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Modal } from './modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const backdrop = () =>
  [...document.querySelectorAll('button')].find(b => !b.closest('[role="dialog"]')) as HTMLButtonElement | undefined;

describe('Modal accessibility', () => {
  it('exposes dialog semantics with an accessible name', () => {
    render(
      <Modal onClose={() => {}} label="Confirm action">
        <button type="button">First</button>
      </Modal>,
    );
    const el = dialog();
    expect(el).toBeTruthy();
    expect(el!.getAttribute('aria-modal')).toBe('true');
    expect(el!.getAttribute('aria-label')).toBe('Confirm action');
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(
      <Modal onClose={() => {}} label="Dialog">
        <button type="button">First</button>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus into the dialog on open', () => {
    render(
      <Modal onClose={() => {}} label="Dialog">
        <button type="button">First action</button>
      </Modal>,
    );
    expect(dialog()!.contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the previously focused element on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <Modal onClose={() => {}} label="Dialog">
        <button type="button">First</button>
      </Modal>,
    );
    // Focus moved off the trigger into the dialog while open.
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} label="Dialog">
        <button type="button">First</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked by default', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} label="Dialog">
        <button type="button">First</button>
      </Modal>,
    );
    const bd = backdrop();
    expect(bd).toBeTruthy();
    fireEvent.click(bd!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on backdrop click when dismissOnBackdrop is false', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} label="Dialog" dismissOnBackdrop={false}>
        <button type="button">First</button>
      </Modal>,
    );
    const bd = backdrop();
    expect(bd).toBeTruthy();
    fireEvent.click(bd!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SearchBox from '../SearchBox';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function surface(isOpen: boolean) {
  return <>
    <textarea aria-label="Draft editor" defaultValue="First target" />
    <SearchBox isOpen={isOpen} onClose={() => root.render(surface(false))}
      onSearch={() => {}} onNext={() => {}} onPrevious={() => {}}
      currentMatch={0} totalMatches={0} />
  </>;
}
for (const closeWith of ['Escape', 'button']) {
  it(`restores editor focus after search closes with ${closeWith}`, () => {
    act(() => root.render(surface(false)));
    const editor = host.querySelector('textarea')!;
    editor.focus();
    act(() => root.render(surface(true)));
    const query = host.querySelector<HTMLInputElement>('[aria-label="Search in draft"]')!;
    expect(document.activeElement).toBe(query);
    act(() => {
      if (closeWith === 'Escape') {
        query.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else {
        host.querySelector<HTMLButtonElement>('[aria-label="Close search"]')!.click();
      }
    });
    expect(host.querySelector('[aria-label="Search in draft"]')).toBeNull();
    expect(document.activeElement).toBe(editor);
  });
}

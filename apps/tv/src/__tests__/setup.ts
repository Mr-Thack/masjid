import '@testing-library/jest-dom/vitest';

// jsdom does not implement the Web Animations API, which Svelte 5 transitions
// (fly, fade, …) rely on. Stub it so animated components can be tested. The
// animation "finishes" on a microtask so Svelte's outro cleanup (which may
// await `finished`, assign `onfinish`, or listen for 'finish') always runs.
if (typeof Element !== 'undefined' && !('animate' in Element.prototype)) {
  (Element.prototype as Record<string, unknown>).animate = function () {
    const finishListeners = new Set<(event: Event) => void>();
    const animation = {
      onfinish: null as null | ((event: Event) => void),
      oncancel: null,
      playState: 'finished',
      currentTime: 0,
      playbackRate: 1,
      startTime: 0,
      id: '',
      effect: null,
      timeline: null,
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      reverse: () => {},
      commitStyles: () => {},
      persist: () => {},
      updatePlaybackRate: () => {},
      addEventListener: (_type: string, cb: (event: Event) => void) => finishListeners.add(cb),
      removeEventListener: (_type: string, cb: (event: Event) => void) => finishListeners.delete(cb),
      dispatchEvent: () => false,
    };
    const finished = new Promise<typeof animation>((resolve) => {
      queueMicrotask(() => {
        const event = { type: 'finish' } as Event;
        animation.onfinish?.(event);
        for (const cb of finishListeners) cb(event);
        resolve(animation);
      });
    });
    return Object.assign(animation, { finished, ready: Promise.resolve(animation) }) as unknown as Animation;
  };
}

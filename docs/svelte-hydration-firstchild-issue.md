# Svelte hydration crash — `Node.prototype.firstChild` corruption

## Symptom

Consumer page fails to hydrate with console errors like:

```
Failed to hydrate: TypeError: Cannot read properties of undefined (reading 'call')
    at get_first_child (operations.js:91:64)
```

and/or an unhandled rejection:

```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'call')
    at get_first_child
```

## Root cause

Svelte 5 caches the native accessor getter for `Node.prototype.firstChild` and `Node.prototype.nextSibling` during `init_operations()` in:

```
node_modules/svelte/src/internal/client/dom/operations.js
```

Code at lines ~52-54:

```js
first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;
```

If something redefines `firstChild`/`nextSibling` as a **data property** instead of an accessor property, `.get` is `undefined` and Svelte later crashes when calling `first_child_getter.call(node)`.

## What can trigger it

- Browser extensions that patch DOM prototypes. In our incident the prime suspect was **Honorlock**, a proctoring extension.
- Other aggressive extensions: ad blockers, accessibility tools, password managers, security software.
- Manual prototype changes in user scripts or test harnesses.

## Reproducibility script

The crash can be reproduced by monkey-patching `firstChild` before Svelte hydrates. In a headless browser test:

```js
await page.addInitScript(() => {
  const d = Object.getOwnPropertyDescriptor(Node.prototype, 'firstChild');
  Object.defineProperty(Node.prototype, 'firstChild', {
    configurable: true,
    enumerable: true,
    value: d ? d.get.call(document) : undefined,
    writable: true,
  });
});
await page.goto('http://localhost:5175/masjid-al-noor');
```

If Svelte is unpatched, hydration crashes with the exact `get_first_child` error.

## Local patch

We are carrying a `patch-package` patch for Svelte 5.56.6 until upstream fixes it:

- File: `patches/svelte+5.56.6.patch`
- Applies fallback implementations when the native getter is missing:
  - `firstChild` → `this.childNodes[0] ?? null`
  - `nextSibling` → manual `parent.childNodes` scan

The patch is applied automatically via the `postinstall` script in `package.json`.

## Upstream status

As of the date of this writing, the upstream `main` branch of `sveltejs/svelte` still contains the original unguarded lines:

```js
first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;
```

No open issue specifically covers this failure mode. A bug report should include:

1. The exact stack trace.
2. The reproduction snippet above.
3. The proposed fallback for `init_operations()`.
4. Context: aggressive browser extensions / proctoring tools can rewrite DOM accessors.

## Decision points

- Keep the local patch until Svelte merges a fix, then delete `patches/svelte+5.56.6.patch` and the `postinstall` script, and bump Svelte.
- If the patch is removed, the app becomes vulnerable to any extension that redefines `firstChild`.
- To verify an environment is affected, open DevTools Console and run:

```js
Object.getOwnPropertyDescriptor(Node.prototype, 'firstChild')
```

If the result has `value` and no `get`, Svelte will crash without the patch.

## References

- `node_modules/svelte/src/internal/client/dom/operations.js`
- `patches/svelte+5.56.6.patch`
- `package.json` (`postinstall` script)
- `docs/consumer-service-worker.md` (related incident notes)

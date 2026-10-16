# Playground guide

Two small applications teach one idea at a time. Each has three scenes with a live preview on the left and the relevant source excerpt on the right. Start with the counter, then shared state, then persistence. State inspection and manual persistence controls are collapsed by default.

Run from the repository root with Node.js 22 and pnpm 10:

```sh
pnpm playground-react
pnpm playground-nextjs
```

## React

| Scene | Try | Learn |
| --- | --- | --- |
| State basics | Increment and reset | An action updates state and the doubled getter together |
| Shared state | Increment either component, then switch scenes | Both components use one store; switching views keeps its state |
| Local storage | Change name, theme, and note, then reload | Only name and theme survive; notes remain in memory |

`src/index.tsx` registers persistence and DevTools once on one Provider inside StrictMode. `src/preferences.ts` contains the only persisted store, using `pick: ['name', 'theme']` and the key `pinia-playground:preferences`. The active scene is stored in the URL hash, so reloading the persistence example keeps that example open. Manual save, restore, and reset remain available in the collapsed controls. Reset writes defaults; it does not delete saved data. Nothing clears browser storage on mount, and the old demo keys are left untouched.

## Next.js App Router

| Route | Try | Learn |
| --- | --- | --- |
| `/` | Increment from 10, then reset | Server initial state comes from the root layout; reset uses the store factory's 0 |
| `/sharing` → `/details` | Change the count, navigate, and refresh server data | The root Provider keeps the same store instance |
| `/preferences` | Change name, theme, and note, then reload | Cookie preferences are already present in server HTML and match the first browser render |

`app/layout.tsx` reads only `pinia:preferences` from the request. `app/providers.tsx` creates the cookie plugin once with that snapshot and shares its Provider across all routes. `app/preferences.tsx` contains the store and its small example. Cookies use Path=/, SameSite=Lax, and a 30-day lifetime; Secure follows HTTPS. Server rendering never writes response cookies. These are browser-readable display preferences, not authentication data. The legacy theme field remains readable; older locale/count fields are no longer part of the example.

Local source aliases in the Next.js tsconfig keep shared components and the Provider on one core module. Restart an existing development server after changing aliases. Avoid letting `next build` and `next dev` write to the same output directory.

## Code layout

- `shared/counter.tsx`: the counter store and two focused core examples.
- `shared/playground.tsx` and `shared/playground.css`: common layout, source panel, and responsive styles.
- `shared/preferences.tsx`: plain preference inputs and the preview; each application owns its store.
- `shared/styles.d.ts`: CSS side-effect import declarations.

The previous all-in-one API labs, event journals, editable raw payloads, injected failures, and artificial hydration gates have been removed from the applications. Advanced behavior remains covered by the package suites: ordered strategies/custom serializers in `persistedstate/tests/lifecycle.spec.ts` and `config.spec.ts`; storage failures in `errors.spec.ts`; lazy cookie creation and delayed hydration in `cookies.react.spec.tsx`; DevTools restoration in `devtools/tests` and `persistedstate/tests/devtools.spec.ts`. The playground suites now test the actual learning flows, selected-field persistence, recovery, real DevTools restores, and SSR hydration.

## Verification

```sh
pnpm --filter playground-react --filter playground-nextjs test
pnpm --filter playground-react --filter playground-nextjs test-dts
pnpm --filter playground-react exec vite build
pnpm --filter playground-nextjs exec next build
# With the production Next.js app running on port 4174:
pnpm --filter @pinia-react/persistedstate test-next-ssr
```

Both applications participate in root recursive tests/type checks. Each strict `tsconfig.check.json` enables `noUncheckedSideEffectImports`, independently of the editor's TypeScript version. The production SSR check sends synthetic preference cookies to `/preferences` and verifies isolated requests, Unicode/URI data, invalid payload recovery, an explicit cookie allowlist, and no response cookie writes.

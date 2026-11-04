# Web frontend test specification

## Unit and component tests

Place `*.test.ts` or `*.test.tsx` next to the source. Use Vitest for pure logic and React Testing Library for observable UI behaviour. Do not test implementation details.

For each changed page, component, route, or API client, cover applicable cases:

- normal render/action and expected API payload or navigation;
- required-field and server-error feedback;
- loading/disabled state where it exists;
- anonymous redirect and permitted route access for protected screens;
- user-visible handling of the API response/error contract.

Run `npm run test:coverage`; its reports are in `coverage/`.

## Browser E2E tests

Place workflow smoke tests in `e2e/*.spec.ts`. Run `npx playwright install chromium` once, then `npm run test:e2e`. These tests start Vite automatically unless `E2E_WEB_URL` points to an existing deployment.

Do not put development credentials in tests. A browser workflow that requires backend data must provision isolated data through a supported test fixture or dedicated test environment.

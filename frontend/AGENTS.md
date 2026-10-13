# Frontend

Next.js 16 (App Router) Kanban app. Sign in goes through the backend; the board itself is not persisted yet.

Built as a static export (`output: "export"` in `next.config.ts`, output in `out/`). The Docker build copies `out/` into the backend, which serves it at `/`.

## Stack

- Next.js 16.1.6, React 19.2, TypeScript, Tailwind CSS 4
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag and drop
- Vitest + Testing Library (jsdom) for unit tests, Playwright for e2e

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) fonts
- `src/app/page.tsx` - auth gate: calls `/api/me` on load, renders `LoginForm` when signed out and `KanbanBoard` when signed in
- `src/lib/api.ts` - fetch helpers `getMe`, `login`, `logout`
- `src/app/globals.css` - color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow)
- `src/lib/kanban.ts`
  - Types `Card`, `Column`, `BoardData`. Board is normalized: `columns[]` each hold ordered `cardIds`, and `cards` is a map by id
  - `initialData` - 5 columns, 8 sample cards
  - `moveCard(columns, activeId, overId)` - pure function handling reorder within a column and moves across columns (dropping on a card or an empty column)
  - `createId(prefix)` - random id generator
- `src/components/`
  - `KanbanBoard` - holds all board state in `useState`, owns `DndContext` and the handlers for rename, add, delete and drag end. Has a Log out button (`onLogout` prop)
  - `LoginForm` - username / password form, shows an error on bad credentials
  - `KanbanColumn` - droppable column with an editable title input and card count
  - `KanbanCard` - sortable card with a Remove button
  - `KanbanCardPreview` - card shown in the `DragOverlay`
  - `NewCardForm` - toggleable form to add a card (title required, details optional)

## Current limitations

- Board state resets on reload (no persistence)
- Cards can be added and removed but not edited

## Tests

- `src/lib/kanban.test.ts` - `moveCard` unit tests
- `src/components/KanbanBoard.test.tsx` - renders columns, renames a column, adds and removes a card, log out
- `src/components/LoginForm.test.tsx`, `src/app/page.test.tsx` - login form and auth gate with mocked `fetch`
- `tests/kanban.spec.ts` - Playwright: loads board, adds a card, drags a card between columns (signs in first via `tests/helpers.ts`)
- `tests/auth.spec.ts` - Playwright: login required, bad credentials, session survives reload, log out
- Next.js renders an empty `role="alert"` route announcer on every page; scope alert queries in Playwright to `main`
- `playwright.config.ts` targets the Docker container at `127.0.0.1:8000`; start it first with `scripts/start`

Commands: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`.

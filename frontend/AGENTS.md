# Frontend

Next.js 16 (App Router) Kanban app. Sign in and the board are both backed by the FastAPI backend, so all changes persist.

Built as a static export (`output: "export"` in `next.config.ts`, output in `out/`). The Docker build copies `out/` into the backend, which serves it at `/`.

## Stack

- Next.js 16.1.6, React 19.2, TypeScript, Tailwind CSS 4
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag and drop
- Vitest + Testing Library (jsdom) for unit tests, Playwright for e2e

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) fonts
- `src/app/page.tsx` - auth gate: calls `/api/me` on load, renders `LoginForm` when signed out and `KanbanBoard` when signed in
- `src/app/globals.css` - color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow)
- `src/lib/api.ts` - fetch helpers: `getMe`, `login`, `logout`, and board calls (`getBoard`, `renameColumn`, `createCard`, `updateCard`, `deleteCard`, `moveCardTo`) that each return the full `BoardData` from the server
- `src/lib/kanban.ts`
  - Types `Card`, `Column`, `BoardData`. Board is normalized: `columns[]` each hold ordered `cardIds`, and `cards` is a map by id
  - `moveCard(columns, activeId, overId)` - pure function handling reorder within a column and moves across columns (dropping on a card or an empty column)
- `src/components/`
  - `KanbanBoard` - loads the board from the API, owns `DndContext`. Every change calls the API and replaces state with the returned board; drag end applies `moveCard` locally first, then saves the card's new column and index. Has a Log out button (`onLogout` prop)
  - `LoginForm` - username / password form, shows an error on bad credentials
  - `KanbanColumn` - droppable column with a title input (uncontrolled, keyed on the title) that saves on blur or Enter when changed
  - `KanbanCard` - sortable card with Edit and Remove buttons. Edit mode shows a title / details form and disables dragging
  - `KanbanCardPreview` - card shown in the `DragOverlay`
  - `NewCardForm` - toggleable form to add a card (title required, details optional)

## Tests

- `src/lib/kanban.test.ts` - `moveCard` unit tests
- `src/components/KanbanBoard.test.tsx` - mocks `@/lib/api` with `vi.mock`; load, rename (blur / Enter), add, edit, cancel edit, delete, log out
- `src/components/LoginForm.test.tsx`, `src/app/page.test.tsx` - login form and auth gate with mocked `fetch`
- `src/test/board.ts` - shared `testBoard` fixture
- `tests/kanban.spec.ts` - Playwright: each board change survives a reload. Tests write to the real DB, so they name cards with the `e2e` prefix and `removeTestCards` (in `tests/helpers.ts`) deletes them before and after each test; the rename test restores the title
- `tests/auth.spec.ts` - Playwright: login required, bad credentials, session survives reload, log out
- Next.js renders an empty `role="alert"` route announcer on every page; scope alert queries in Playwright to `main`
- Cards carry `role="button"` from dnd-kit, and their accessible name includes the inner button labels; use `exact: true` for button name queries
- `playwright.config.ts` targets the Docker container at `127.0.0.1:8000`; start it first with `scripts/start`

Commands: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`.

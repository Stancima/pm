# Frontend

Next.js 16 (App Router) client-only Kanban demo. No backend, auth or persistence yet.

Built as a static export (`output: "export"` in `next.config.ts`, output in `out/`). The Docker build copies `out/` into the backend, which serves it at `/`.

## Stack

- Next.js 16.1.6, React 19.2, TypeScript, Tailwind CSS 4
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag and drop
- Vitest + Testing Library (jsdom) for unit tests, Playwright for e2e

## Structure

- `src/app/layout.tsx` - root layout, loads Space Grotesk (display) and Manrope (body) fonts
- `src/app/page.tsx` - renders `KanbanBoard`
- `src/app/globals.css` - color scheme as CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow)
- `src/lib/kanban.ts`
  - Types `Card`, `Column`, `BoardData`. Board is normalized: `columns[]` each hold ordered `cardIds`, and `cards` is a map by id
  - `initialData` - 5 columns, 8 sample cards
  - `moveCard(columns, activeId, overId)` - pure function handling reorder within a column and moves across columns (dropping on a card or an empty column)
  - `createId(prefix)` - random id generator
- `src/components/`
  - `KanbanBoard` - holds all board state in `useState`, owns `DndContext` and the handlers for rename, add, delete and drag end
  - `KanbanColumn` - droppable column with an editable title input and card count
  - `KanbanCard` - sortable card with a Remove button
  - `KanbanCardPreview` - card shown in the `DragOverlay`
  - `NewCardForm` - toggleable form to add a card (title required, details optional)

## Current limitations

- State resets on reload (no persistence)
- No sign in
- Cards can be added and removed but not edited

## Tests

- `src/lib/kanban.test.ts` - `moveCard` unit tests
- `src/components/KanbanBoard.test.tsx` - renders columns, renames a column, adds and removes a card
- `tests/kanban.spec.ts` - Playwright: loads board, adds a card, drags a card between columns
- `playwright.config.ts` targets the Docker container at `127.0.0.1:8000`; start it first with `scripts/start`

Commands: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`.

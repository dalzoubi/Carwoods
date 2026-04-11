# Portal Layout Chrome (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document portal shell: sidebar, top bar, main content region, mobile drawer, and page transition styling.
- **Why now:** All authenticated portal pages render inside this frame.
- **Related docs/issues/links:** `AGENTS.md` portal UX standards.

## 2) Scope

- **In scope:** `PortalLayout`, `PortalSidebar`, `PortalTopBar`, `main#main-content`, responsive sidebar collapse, animation wrapper for route content.
- **Out of scope:** Marketing `AppShell` / `Footer`.

## 3) Users and stories

- As a **mobile user**, I want a hamburger menu, so that I can open navigation.
- As a **desktop user**, I want a persistent sidebar, so that I can jump between portal sections.

## 4) Constraints and assumptions

- **Technical:** Sidebar width constant `SIDEBAR_WIDTH` in sidebar module; role-gated nav items.
- **Assumptions:** Top bar title derives from route via `usePageTitle` pattern in `PortalTopBar`.

## 5) Acceptance criteria

1. Given viewport below `md`, when I open the drawer, then sidebar overlays and closes on navigation selection.
2. Given viewport `md+`, when I toggle collapse, then sidebar width changes without losing nav access.
3. Given any portal child route, when it renders, then content sits in `main` with flex column layout and accessible main id.

## 6) Validation plan

- **Automated:** Sidebar/layout tests if present; `npx eslint src/components/PortalLayout.jsx`
- **Manual:** Resize across breakpoint; keyboard focus order into drawer.

## 7) Implementation plan

- Baseline only. New portal page: register route, sidebar link, top bar title map.

## 8) Risks and mitigations

- **Risk:** Duplicate `h1` with page titles. **Mitigation:** Follow pattern: top bar `h1`, page `h5`/`h6`.

## 9) Rollback plan

- Revert layout/sidebar/topbar commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalLayout.jsx`, `src/components/PortalSidebar.jsx`, `src/components/PortalTopBar.jsx`
- **Tests:** Search `PortalSidebar` / `PortalTopBar` test files when added
- **Acceptance criteria status:** Baseline.

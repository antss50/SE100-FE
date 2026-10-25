# SE100 Frontend

Frontend starter for the SE100 sales management application.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```bash
npm install
npm run dev
```

## Available scripts

- `npm run dev` starts the Vite development server.
- `npm run build` runs the TypeScript project checks and creates a production build.
- `npm run preview` serves the production build locally.
- `npm run lint` runs Oxlint.

## Stack

- React 19, TypeScript, and Vite
- Tailwind CSS 4
- TanStack Query for server state
- Zustand for client/UI state
- React Hook Form and Zod for form handling and validation
- React Router and lucide-react

## Source layout

```text
src/
├── app/                  # App-level providers and stores
├── assets/               # Imported static assets
├── components/           # Shared UI and layouts
├── features/             # Feature-oriented screens (POS, inventory, CRM, dashboard)
├── hooks/                # Shared React hooks
├── lib/                  # Configured libraries and clients
├── routes/               # Route definitions
├── services/             # API integrations
├── types/                # Shared TypeScript types
└── utils/                # Shared utility functions
```

The dashboard includes a small React Hook Form + Zod validation example. The
feature pages are starter screens ready for application-specific workflows.

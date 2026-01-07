# FZ99 Lounge Web

Frontend application for FZ99 Lounge, built with Next.js.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS, shadcn/ui
- **State**: React Query (TanStack Query)
- **Real-time**: Socket.io Client
- **i18n**: next-intl (English/Japanese)

## Development

### With Docker (recommended)

```bash
# From project root
docker compose up -d

# View logs
docker logs -f fz99-lounge-web
```

### Without Docker

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:3001

## Project Structure

```
├── app/                 # Next.js App Router
│   ├── [locale]/        # Localized routes
│   │   ├── (auth)/      # Auth pages
│   │   ├── games/       # Match pages
│   │   ├── leaderboard/ # Rankings
│   │   └── profile/     # User profile
│   └── api/             # API routes
├── components/
│   ├── features/        # Feature components
│   ├── layout/          # Layout components
│   └── ui/              # shadcn/ui components
├── lib/                 # Utilities
├── messages/            # i18n translations
│   ├── en.json
│   └── ja.json
└── public/              # Static assets
```

## Internationalization

Translations are in `messages/en.json` and `messages/ja.json`.

To add a new translation:

1. Add the key to both JSON files
2. Use `useTranslations` hook in components

```tsx
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('Common');
  return <p>{t('hello')}</p>;
}
```

## Building

```bash
npm run build
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BASE_URL` | API base URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL |

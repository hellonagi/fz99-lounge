# FZ99 Lounge API

Backend API service for FZ99 Lounge, built with NestJS.

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL 16 with Prisma 6
- **Cache/Queue**: Redis with BullMQ
- **Real-time**: Socket.io
- **Storage**: S3-compatible (MinIO for dev, AWS S3 for prod)
- **Auth**: Discord OAuth + JWT

## Development

### With Docker (recommended)

```bash
# From project root
docker compose up -d

# Run migrations
docker exec fz99-lounge-api npx prisma migrate dev

# View logs
docker logs -f fz99-lounge-api
```

### Without Docker

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

## API Documentation

Swagger UI is available at http://localhost:3000/api when the server is running.

## Project Structure

```
src/
├── auth/           # Discord OAuth, JWT strategies
├── discord-bot/    # Discord bot integration
├── games/          # Match management
├── push-notifications/  # Web Push
├── rankings/       # Leaderboard & ratings
├── screenshots/    # Image upload handling
├── storage/        # S3/MinIO service
├── users/          # User profiles
└── main.ts         # Application entry point
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Environment Variables

See `.env.example` in the project root for all available options.

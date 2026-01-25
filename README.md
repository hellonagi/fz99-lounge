# FZ99 Lounge

**The competitive matchmaking platform for F-Zero 99 racers.**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red)](https://nestjs.com/)

---

<div align="center">

### **Try it now!**

# **[fz99lounge.com](https://fz99lounge.com)**

*Join the race. Climb the leaderboard. Become the champion.*

</div>

---

## What is FZ99 Lounge?

FZ99 Lounge is a community-driven platform where F-Zero 99 players can:

- **Find matches** - Queue up and race against players at your skill level
- **Track your rank** - ELO-based rating system with seasonal leaderboards
- **Compete in events** - GP and CLASSIC modes with separate rankings
- **Share your victories** - Upload screenshots of your best races
- **Join the community** - Connect with racers from around the world

Whether you're a casual racer or aiming for the top of the leaderboard, FZ99 Lounge is your home for competitive F-Zero 99.

---

## Want to Help? We Need You!

This is a **community project** and we're looking for contributors of all kinds - not just developers!

### Ways to Contribute

| Role | What You'll Do | Skills Needed |
|------|----------------|---------------|
| **Translator** | Help us reach more players worldwide | Fluent in English + another language |
| **Moderator** | Keep the community fair and fun | Experience in online communities |
| **Rating Designer** | Improve our matchmaking algorithm | Math/statistics knowledge (ELO, Glicko, etc.) |
| **Developer** | Build new features and fix bugs | TypeScript, React, NestJS |
| **Tester** | Find bugs and suggest improvements | Just play and give feedback! |

**Interested?** Join our Discord or open an issue - we'd love to have you on the team!

[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?logo=discord&logoColor=white)](https://discord.gg/Q54N659SVR)

---

## Features

- **Discord Login** - One-click authentication with your Discord account
- **Real-time Matchmaking** - Get notified instantly when a match is ready
- **Dual Game Modes** - GP (Grand Prix) and CLASSIC with separate rankings
- **Seasonal Leaderboards** - Fresh competition every season
- **Push Notifications** - Never miss a match
- **Multi-language** - English and Japanese

---

<details>
<summary><strong>For Developers: Tech Stack</strong></summary>

| Layer | Technologies |
|-------|-------------|
| **Backend** | NestJS 11, Prisma 6, PostgreSQL 16 |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| **Real-time** | Socket.io, BullMQ |
| **Infrastructure** | Docker, Redis |
| **Cloud (AWS)** | EC2, RDS, S3, CloudFront, CodeBuild |
| **Auth** | Discord OAuth, JWT |

</details>

<details>
<summary><strong>For Developers: Getting Started</strong></summary>

### Prerequisites

- Docker & Docker Compose
- Discord Application (for OAuth)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/hellonagi/fz99-lounge.git
cd fz99-lounge

# Set up environment
cp .env.example .env
# Edit .env with your Discord OAuth credentials

# Start everything
docker compose up -d

# Initialize database
docker exec fz99-lounge-api npx prisma migrate dev
docker exec fz99-lounge-api npx prisma db seed
```

**That's it!** Open http://localhost:3001

### Project Structure

```
fz99-lounge/
├── apps/
│   ├── api/     # NestJS backend
│   └── web/     # Next.js frontend
└── compose.yaml # Docker config
```

See [apps/api/README.md](apps/api/README.md) and [apps/web/README.md](apps/web/README.md) for more details.

</details>

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Disclaimer

F-Zero 99 is a trademark of Nintendo. This project is not affiliated with or endorsed by Nintendo.

---

<div align="center">

**See you on the track!**

</div>

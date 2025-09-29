# 🚀 NestJS + Next.js Fullstack Starter

Production-ready fullstack template with modern tech stack - WSL2 optimized!

## ⚡ Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/yourusername/nestjs-nextjs-starter.git my-app
cd my-app
./init.sh  # Initialize your project

# 2. Configure environment
cp .env.example .env

# 3. Start development
docker-compose up -d

# 4. Setup database
docker-compose exec api npx prisma migrate dev
```

**That's it!** Visit:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

## 🎯 Features

- ✅ **NestJS v11** - Latest backend framework
- ✅ **Next.js 15** - With Turbopack for fast builds
- ✅ **PostgreSQL + Prisma 6** - Modern database stack
- ✅ **Redis** - For caching and sessions
- ✅ **Docker** - WSL2 optimized, no permission issues!
- ✅ **TypeScript** - Full type safety
- ✅ **Authentication Ready** - JWT/Session support
- ✅ **Hot Reload** - In both frontend and backend
- ✅ **Swagger** - Auto-generated API docs

## 📁 Project Structure

```
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── docker/           # Docker configurations
├── docker-compose.yml
├── Makefile         # Helpful commands
└── init.sh          # Project initializer
```

## 🛠️ Available Commands

```bash
make up          # Start development
make down        # Stop everything
make logs        # View logs
make migrate     # Run database migrations
make test        # Run tests
make clean       # Clean up
```

## 🎨 Customization

### Add a NestJS Module
```bash
docker-compose exec api nest g module users
docker-compose exec api nest g controller users
docker-compose exec api nest g service users
```

### Add a Database Model
1. Edit `apps/api/prisma/schema.prisma`
2. Run `make migrate`

### Change Ports
Edit `.env` file:
```env
API_PORT=3100
WEB_PORT=3101
```

## 🚀 Production

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📝 License

MIT - Use freely for any project!

---
⭐ **If this helped you, please star the repo!**
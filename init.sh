#!/bin/bash

# Project Initializer Script
# This script helps customize the starter template for your project

echo "🚀 Welcome to NestJS + Next.js Starter Initializer!"
echo "====================================================="
echo ""

# Get project name
read -p "Enter your project name (lowercase, no spaces): " PROJECT_NAME

# Validate project name
if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9-]+$ ]]; then
    echo "❌ Invalid project name. Use only lowercase letters, numbers, and hyphens."
    exit 1
fi

echo ""
echo "📝 Setting up project: $PROJECT_NAME"
echo ""

# Replace project name in files
echo "✅ Updating configuration files..."

# Update package.json files
if [ -f "apps/api/package.json" ]; then
    sed -i "s/\"name\": \"api\"/\"name\": \"$PROJECT_NAME-api\"/" apps/api/package.json
fi

if [ -f "apps/web/package.json" ]; then
    sed -i "s/\"name\": \"web\"/\"name\": \"$PROJECT_NAME-web\"/" apps/web/package.json
fi

# Update docker-compose.yml container names
sed -i "s/discord-cafe/$PROJECT_NAME/g" docker-compose.yml 2>/dev/null || true
sed -i "s/discord-cafe/$PROJECT_NAME/g" docker-compose.prod.yml 2>/dev/null || true

# Clean up Discord-specific files if they exist
echo "✅ Cleaning up example schemas..."

# Create a basic Prisma schema
cat > apps/api/prisma/schema.prisma << 'EOF'
// Prisma Schema - Starter Template

generator client {
  provider = "prisma-client-js"
  engineType = "library"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Example User model - customize as needed
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  username  String?
  password  String?

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production builds
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Docker
postgres_data/
redis_data/
EOF

echo ""
echo "🎉 Project initialization complete!"
echo ""
echo "Next steps:"
echo "1. Copy and configure environment variables:"
echo "   cp .env.example .env"
echo ""
echo "2. Start development environment:"
echo "   docker-compose up -d"
echo ""
echo "3. Run database migration:"
echo "   docker-compose exec api npx prisma migrate dev --name init"
echo ""
echo "Happy coding! 🚀"
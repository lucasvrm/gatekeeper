#!/bin/bash

# Gatekeeper API - Setup and Test Script
# This script sets up the database and runs all tests

set -e  # Exit on error

echo "🚀 Gatekeeper API - Setup and Test"
echo "===================================="
echo ""

# Navigate to the gatekeeper-api directory
cd "$(dirname "$0")"

echo "📁 Current directory: $(pwd)"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1/5: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 2: Generate Prisma client
echo "🔧 Step 2/5: Generating Prisma client..."
npm run db:generate
echo "✅ Prisma client generated"
echo ""

# Step 3: Run migrations
echo "🗄️  Step 3/5: Running database migrations..."
npm run db:migrate
echo "✅ Migrations completed"
echo ""

# Step 4: Seed database
echo "🌱 Step 4/5: Seeding database..."
npm run db:seed
echo "✅ Database seeded"
echo ""

# Step 5: Run tests
echo "🧪 Step 5/5: Running test suite..."
npm test
echo "✅ All tests completed"
echo ""

echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "✅ Dependencies installed"
echo "✅ Database initialized"
echo "✅ Tests passing"
echo ""
echo "🚀 Next steps:"
echo "  - Start server: npm run dev"
echo "  - API will be available at: http://localhost:3000"
echo "  - View database: npm run db:studio"
echo ""
echo "📚 Documentation:"
echo "  - QUICK_REFERENCE.md - Validator reference"
echo "  - COMPLETION_SUMMARY.md - Implementation details"
echo "  - BUILD_STATUS.md - Project status"
echo ""

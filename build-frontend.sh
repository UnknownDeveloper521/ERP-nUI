#!/bin/bash
set -e
echo "🏗️  Building ERP Frontend..."
cd /home/runner/workspace
npx vite build
echo "✅ Frontend build complete!"

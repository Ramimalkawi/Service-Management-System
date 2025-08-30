#!/bin/bash

echo "🚀 Starting build process..."

# Install and build client
echo "📦 Installing client dependencies..."
cd client && npm install

echo "🏗️ Building React app..."
npm run build

# Go back to root and copy build files
cd ..

# Copy build files to server's public directory
echo "📁 Copying build files to server..."
mkdir -p server/public
cp -r client/dist/* server/public/

# Install server dependencies
echo "📦 Installing server dependencies..."  
cd server && npm install

echo "✅ Build complete!"

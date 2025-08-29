#!/bin/bash
# build-for-production.sh

echo "🚀 Building 365Solutions System for Production..."

# Build client
echo "📦 Building React client..."
cd client
npm install
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Client build successful!"
    echo "📁 Built files are in client/dist/"
else
    echo "❌ Client build failed!"
    exit 1
fi

# Prepare server
echo "🔧 Preparing server..."
cd ../server
npm install --production

if [ $? -eq 0 ]; then
    echo "✅ Server dependencies installed!"
else
    echo "❌ Server preparation failed!"
    exit 1
fi

echo ""
echo "🎉 Build Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Upload client/dist/ to your web hosting"
echo "2. Upload server/ folder to your server"
echo "3. Set environment variables"
echo "4. Start the server with 'npm start'"
echo "5. Integrate with WordPress using the guide in DEPLOYMENT.md"
echo ""

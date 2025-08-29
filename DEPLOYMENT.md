# 🚀 Deployment Guide: React App to WordPress Integration

## 📋 Prerequisites

- Node.js installed on your server
- Firebase project configured
- Domain/hosting for your server
- WordPress website access

## 🎯 Deployment Steps

### Step 1: Deploy Server (Backend)

```bash
# 1. Upload server folder to your hosting
# 2. Install dependencies
npm install

# 3. Set environment variables
# Create .env file in server folder:
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://yourwordpresssite.com,https://yourreactapp.com
```

### Step 2: Deploy React App (Frontend)

#### Option A: Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Set environment variables:
   - `VITE_API_URL=https://your-server-domain.com`
5. Deploy!

#### Option B: Netlify

1. Build the app: `npm run build`
2. Upload `dist` folder to Netlify
3. Set environment variables in Netlify dashboard

#### Option C: Your Own Server

```bash
# Build the app
npm run build

# Upload dist folder to your web server
# Configure nginx/apache to serve the files
```

### Step 3: WordPress Integration

#### Method 1: Direct Link

Add this to your WordPress homepage:

```html
<a href="https://your-react-app.com" target="_blank" class="solutions-app-btn">
  Open 365Solutions System
</a>
```

#### Method 2: iframe Embed

Add this to a WordPress page:

```html
<iframe
  src="https://your-react-app.com"
  width="100%"
  height="800px"
  frameborder="0"
>
</iframe>
```

#### Method 3: WordPress Plugin (Advanced)

Create a custom shortcode in functions.php:

```php
function solutions_app_shortcode() {
    return '<iframe src="https://your-react-app.com" width="100%" height="800px"></iframe>';
}
add_shortcode('solutions_app', 'solutions_app_shortcode');
```

Then use `[solutions_app]` in any page/post.

## 🔧 Configuration

### Update Server CORS

Make sure your server allows requests from WordPress:

```javascript
app.use(
  cors({
    origin: ["https://yourwordpresssite.com", "https://your-react-app.com"],
  })
);
```

### Firebase Security Rules

Update Firestore rules for production:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🎨 WordPress Styling

Add custom CSS to make the integration seamless:

```css
.solutions-app-btn {
  background: #007cba;
  color: white;
  padding: 15px 30px;
  border-radius: 5px;
  text-decoration: none;
  display: inline-block;
  margin: 20px 0;
}

.solutions-app-frame {
  border: 2px solid #ddd;
  border-radius: 10px;
  overflow: hidden;
}
```

## 📱 Mobile Optimization

For mobile-friendly integration:

```html
<iframe
  src="https://your-react-app.com"
  width="100%"
  height="600px"
  style="max-width: 100%; height: 80vh; min-height: 600px;"
>
</iframe>
```

## 🔐 Security Considerations

1. Enable HTTPS on both sites
2. Configure proper CORS headers
3. Set up Firebase security rules
4. Use environment variables for sensitive data
5. Consider WordPress user authentication integration

## 🚀 Quick Deploy Commands

```bash
# Build for production
cd client
npm run build

# Deploy server
cd ../server
npm install --production
npm start
```

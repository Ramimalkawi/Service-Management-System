# 365Solutions System

A comprehensive ticket management system for repair services with integrated email automation and user management.

## 🚀 Features

- **Ticket Management**: Create, track, and manage repair tickets
- **Email Automation**: 3-stage customer communication system
- **User Management**: Role-based access control (User/Admin/System Admin)
- **PDF Generation**: Automated receipts and documentation
- **Real-time Updates**: Live status tracking
- **Mobile Responsive**: Works on all devices

## 🔧 Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Email**: Custom SMTP service

## 📦 Deployment

### Client (Frontend)

- Deployed on Vercel
- Environment variables configured in Vercel dashboard

### Server (Backend)

- Requires Node.js hosting
- Set environment variables for production

## 🔗 WordPress Integration

This system can be integrated into WordPress websites using:

- iframe embedding
- Direct linking
- Modal popups
- Custom shortcodes

See `DEPLOYMENT.md` for detailed instructions.

## 🛠️ Local Development

1. Clone the repository
2. Install dependencies: `cd client && npm install`
3. Start development server: `npm run dev`
4. Start backend server: `cd ../server && npm install && npm start`

## 📧 Email Configuration

Configure SMTP settings in server environment variables:

- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS

## 🔐 Firebase Setup

1. Create Firebase project
2. Enable Firestore and Authentication
3. Update Firebase config in `src/firebase.js`
4. Set security rules for production

## 📱 Mobile Support

Fully responsive design optimized for:

- Desktop computers
- Tablets
- Mobile phones

## 🤝 Support

For support and customization, contact the development team.

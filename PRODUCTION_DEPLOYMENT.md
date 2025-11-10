# Production Deployment Guide

This guide explains how to deploy the Quotation Review System to production using environment variables.

## Environment Variables Analysis

### Backend Environment Variables

All backend environment variables are configured in `backend/.env`:

| Variable | Description | Required | Default | Production Example |
|----------|-------------|----------|---------|-------------------|
| `PORT` | Server port | No | 5000 | `5000` or `80` |
| `MONGODB_URI` | MongoDB connection string | Yes | `mongodb://localhost:27017/quotation-review` | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | `your-secret-key-change-this-in-production` | Generate secure random string |
| `FRONTEND_URL` | Frontend URL for email links | Yes | `http://localhost:5173` | `https://yourdomain.com` |
| `EMAIL_HOST` | SMTP server host | No | - | `smtp.gmail.com` or `smtp.sendgrid.net` |
| `EMAIL_PORT` | SMTP server port | No | 587 | `587` or `465` |
| `EMAIL_SECURE` | Use secure connection | No | false | `true` for port 465 |
| `EMAIL_USER` | SMTP username | No | - | Your email or API key |
| `EMAIL_PASSWORD` | SMTP password | No | - | Your password or API secret |
| `EMAIL_FROM` | Email sender address | No | `noreply@quotationreview.com` | `noreply@yourdomain.com` |

### Frontend Environment Variables

All frontend environment variables are configured in `frontend/.env`:

| Variable | Description | Required | Default | Production Example |
|----------|-------------|----------|---------|-------------------|
| `VITE_PORT` | Dev server port (dev only) | No | 3000 | N/A (not used in production) |
| `VITE_API_URL` | Backend URL for dev proxy | No | `http://localhost:5000` | N/A (not used in production) |
| `VITE_API_BASE_URL` | Backend API base URL | Yes (prod) | Empty (uses proxy in dev) | `https://api.yourdomain.com` |
| `VITE_APP_NAME` | Application name | No | `Quotation Review System` | Your app name |
| `VITE_APP_VERSION` | Application version | No | `1.0.0` | Your version |

## Production Deployment Steps

### 1. Backend Deployment

#### Step 1: Set Environment Variables

Create `backend/.env` with production values:

```env
# Server Configuration
PORT=5000

# MongoDB Configuration (use MongoDB Atlas or your production DB)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/quotation-review?retryWrites=true&w=majority

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secure-random-string-here

# Frontend URL (your production frontend URL)
FRONTEND_URL=https://yourdomain.com

# Email Configuration (configure your email service)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

#### Step 2: Generate Secure JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and use it as `JWT_SECRET`.

#### Step 3: Install Dependencies and Start

```bash
cd backend
npm install --production
npm start
```

Or use a process manager like PM2:

```bash
npm install -g pm2
pm2 start server.js --name quotation-backend
pm2 save
pm2 startup
```

### 2. Frontend Deployment

#### Step 1: Set Environment Variables

Create `frontend/.env.production` with production values:

```env
# API Base URL (your production backend URL)
VITE_API_BASE_URL=https://api.yourdomain.com

# App Configuration
VITE_APP_NAME=Quotation Review System
VITE_APP_VERSION=1.0.0
```

**Important**: 
- In production, `VITE_API_BASE_URL` must be set to your backend URL
- The frontend uses this to make API calls
- Do NOT include trailing slash

#### Step 2: Build for Production

```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder with optimized production files.

#### Step 3: Serve the Build

You can serve the `dist/` folder using:

**Option A: Nginx**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass https://api.yourdomain.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy uploads to backend
    location /uploads {
        proxy_pass https://api.yourdomain.com;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

**Option B: Apache**
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /path/to/frontend/dist

    <Directory /path/to/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Proxy API requests
    ProxyPass /api https://api.yourdomain.com/api
    ProxyPassReverse /api https://api.yourdomain.com/api

    # Proxy uploads
    ProxyPass /uploads https://api.yourdomain.com/uploads
    ProxyPassReverse /uploads https://api.yourdomain.com/uploads
</VirtualHost>
```

**Option C: Node.js (Express)**
```javascript
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000);
```

## Environment-Specific Configuration

### Development

**Backend** (`backend/.env`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quotation-review
JWT_SECRET=dev-secret-key
FRONTEND_URL=http://localhost:5173
# Email not configured (uses console logging)
```

**Frontend** (`frontend/.env`):
```env
VITE_PORT=3000
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=
```

### Production

**Backend** (`backend/.env`):
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=<secure-random-string>
FRONTEND_URL=https://yourdomain.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

**Frontend** (`frontend/.env.production`):
```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_APP_NAME=Quotation Review System
VITE_APP_VERSION=1.0.0
```

## Key Points for Production

### ✅ What Works Out of the Box

1. **Backend**: All environment variables are properly configured with fallbacks
2. **Frontend**: Uses centralized axios client with configurable base URL
3. **Email**: Optional - system works without it (uses console logging)
4. **Database**: Just update `MONGODB_URI` to your production database

### ⚠️ Important Production Considerations

1. **JWT_SECRET**: Must be changed to a secure random string
2. **MONGODB_URI**: Use MongoDB Atlas or secure production database
3. **FRONTEND_URL**: Must match your actual frontend domain
4. **VITE_API_BASE_URL**: Must be set in production build
5. **CORS**: Backend CORS is currently set to allow all origins - consider restricting in production
6. **File Storage**: Uploads are stored locally - consider cloud storage (S3, etc.) for production
7. **HTTPS**: Use HTTPS in production for security

### 🔒 Security Checklist

- [ ] Change `JWT_SECRET` to secure random string
- [ ] Use MongoDB Atlas or secure database connection
- [ ] Enable HTTPS for both frontend and backend
- [ ] Configure CORS to only allow your frontend domain
- [ ] Set up proper email service (Gmail, SendGrid, etc.)
- [ ] Use environment variables for all sensitive data
- [ ] Never commit `.env` files to version control
- [ ] Set up proper file storage (cloud storage recommended)
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging

## Testing Production Build Locally

1. **Backend**:
   ```bash
   cd backend
   # Update .env with production-like values
   npm start
   ```

2. **Frontend**:
   ```bash
   cd frontend
   # Create .env.production with VITE_API_BASE_URL=http://localhost:5000
   npm run build
   npm run preview  # Preview production build
   ```

## Troubleshooting

### Frontend can't connect to backend in production

- Check `VITE_API_BASE_URL` is set correctly in `.env.production`
- Rebuild frontend after changing environment variables: `npm run build`
- Verify backend CORS allows your frontend domain
- Check browser console for CORS errors

### Email not working

- Verify all email environment variables are set
- For Gmail, use App Password (not regular password)
- Check email service logs
- System will log emails to console if email is not configured

### Database connection issues

- Verify `MONGODB_URI` is correct
- Check network access to MongoDB
- Verify database user has proper permissions
- Check MongoDB connection string format

## Summary

✅ **Yes, you can change environment variables and run the application in production!**

The application is production-ready with:
- All configuration via environment variables
- No hardcoded URLs or secrets
- Proper separation of dev/prod configs
- Centralized API client for frontend
- Graceful fallbacks for optional features

Just update the `.env` files with your production values and deploy!


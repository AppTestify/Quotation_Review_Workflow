# Quick Setup Guide

## Prerequisites
- Node.js (v14+) installed
- MongoDB running locally or MongoDB Atlas account

## Step-by-Step Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example or create manually)
# Add the following:
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quotation-review
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=development

# Start the server
npm run dev
```

Backend should now be running on `http://localhost:5000`

### 2. Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Frontend should now be running on `http://localhost:3000`

### 3. First Time Usage

1. Open `http://localhost:3000` in your browser
2. Register a new account:
   - Create a **Seller** account (e.g., seller@example.com)
   - Create a **Buyer** account (e.g., buyer@example.com)
3. Login as Seller and upload your first quotation PDF
4. Login as Buyer to review and annotate

## Troubleshooting

### MongoDB Connection Issues
- Make sure MongoDB is running: `mongod` or check MongoDB service
- For MongoDB Atlas: Update `MONGODB_URI` in `.env` with your connection string

### Port Already in Use
- Backend: Change `PORT` in `.env` file
- Frontend: Vite will automatically use the next available port

### PDF Not Loading
- Check that the backend is running and accessible
- Verify the PDF file path in the browser console
- Ensure CORS is properly configured (already set in server.js)

### File Upload Fails
- Check that `backend/uploads/quotations/` directory exists
- Verify file size is under 10MB
- Ensure file is a valid PDF

## Testing the Workflow

1. **As Seller:**
   - Upload a quotation PDF
   - Fill in project number, document number, and title
   - Submit

2. **As Buyer:**
   - View the quotation in the dashboard
   - Open the quotation detail page
   - Use annotation tools (highlight, rectangle, comment)
   - Add comments and save
   - Request changes or approve

3. **As Seller (after changes requested):**
   - View the quotation detail page
   - See buyer's comments and annotations
   - Upload a revised version (automatically becomes REV.B)

4. **As Buyer:**
   - Review the new version
   - Approve if satisfied

## Production Deployment

### Backend
- Set `NODE_ENV=production`
- Use a secure `JWT_SECRET`
- Configure proper MongoDB connection
- Set up file storage (consider cloud storage for uploads)

### Frontend
```bash
cd frontend
npm run build
```
Serve the `dist/` folder with a web server (nginx, Apache, etc.)

## Notes
- Uploaded files are stored in `backend/uploads/quotations/`
- Make sure to add this directory to your backup strategy
- For production, consider using cloud storage (AWS S3, etc.)



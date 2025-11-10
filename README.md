# Quotation Review and Approval System

A full-stack MERN application for managing quotation review and approval workflows between Sellers and Buyers/Admins.

## Features

- **User Authentication**: JWT-based authentication with role-based access (Seller/Buyer)
- **PDF Upload**: Sellers can upload quotation PDFs with metadata
- **Version Control**: Automatic version tracking (REV.A, REV.B, REV.C, etc.)
- **PDF Annotation**: Buyers can annotate PDFs with highlights, rectangles, and comments
- **Review Workflow**: Status tracking (Submitted → Under Review → Changes Requested → Approved)
- **Version History**: Complete timeline of all revisions with comments
- **Role-Based Dashboards**: Separate interfaces for Sellers and Buyers

## Tech Stack

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Multer (File Upload)
- pdf-lib (PDF Processing)

### Frontend
- React.js
- React Router
- Tailwind CSS
- react-pdf (PDF Viewer)
- Axios (API Client)

## Project Structure

```
.
├── backend/
│   ├── controllers/
│   ├── models/
│   │   ├── User.js
│   │   └── Quotation.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── quotations.js
│   ├── middleware/
│   │   └── auth.js
│   ├── uploads/
│   │   └── quotations/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApprovalStatusBadge.jsx
│   │   │   ├── CommentSidebar.jsx
│   │   │   ├── PDFViewer.jsx
│   │   │   ├── UploadModal.jsx
│   │   │   └── VersionTimeline.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── SellerDashboard.jsx
│   │   │   ├── BuyerDashboard.jsx
│   │   │   └── QuotationDetail.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── api/
│   │   │   └── quotations.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quotation-review
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

4. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage

### For Sellers

1. **Register/Login**: Create an account with the "Seller" role
2. **Upload Quotation**: Click "Upload New Quotation" and fill in:
   - Project Number
   - Document Number
   - Title
   - PDF File
3. **View Feedback**: Check the quotation detail page for buyer comments and annotations
4. **Re-upload**: When changes are requested, upload a revised version (automatically increments to next version)

### For Buyers/Admins

1. **Register/Login**: Create an account with the "Buyer" role
2. **View Quotations**: See all submitted quotations on the dashboard
3. **Review & Annotate**: 
   - Open a quotation to view the PDF
   - Use annotation tools (highlight, rectangle, comment)
   - Add comments in the sidebar
   - Save annotations
4. **Request Changes**: Send feedback to the seller
5. **Approve**: Once satisfied, approve the quotation (locks it from further edits)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Quotations
- `GET /api/quotations` - Get all quotations (filtered by role and status)
- `GET /api/quotations/:id` - Get single quotation
- `POST /api/quotations/upload` - Upload new quotation (Seller only)
- `POST /api/quotations/:id/annotate` - Add annotations (Buyer only)
- `POST /api/quotations/:id/request-changes` - Request changes (Buyer only)
- `POST /api/quotations/:id/approve` - Approve quotation (Buyer only)
- `GET /api/quotations/:id/history` - Get version history

## Workflow States

1. **Submitted**: Initial state when seller uploads
2. **Under Review**: Buyer has opened and is reviewing
3. **Changes Requested**: Buyer has requested modifications
4. **Approved**: Final state - quotation is locked

## Notes

- PDF files are stored in `backend/uploads/quotations/`
- Maximum file size: 10MB
- Only PDF files are accepted
- Approved quotations cannot be modified
- Version history is preserved for all revisions

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Vite dev server with hot reload
```

## Production Build

### Frontend
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## License

MIT



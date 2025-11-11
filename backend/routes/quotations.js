const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const { generatePDFFromHTML } = require('../utils/pdfGenerator');
const { extractDateFromPDF, calculateDueDate } = require('../utils/pdfDateExtractor');

const router = express.Router();

// Helper function to add history entry
const addHistoryEntry = (quotation, action, description, performedBy, oldValue = null, newValue = null, version = null, metadata = null) => {
  if (!quotation.history) {
    quotation.history = [];
  }
  quotation.history.push({
    action,
    description,
    performedBy,
    oldValue,
    newValue,
    version,
    metadata,
    timestamp: new Date()
  });
  // Mark history array as modified so Mongoose saves it
  quotation.markModified('history');
};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/quotations');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Get all quotations (with filters and search)
router.get('/', auth, async (req, res) => {
  try {
    const { status, supplierId, search } = req.query;
    const query = {};

    // Filter by role
    if (req.user.role === 'seller') {
      query.createdBy = req.user._id;
    } else if (req.user.role === 'buyer') {
      // Buyers can only see quotations from their onboarded suppliers
      const User = require('../models/User');
      const suppliers = await User.find({ 
        onboardedBy: req.user._id,
        role: 'seller'
      }).select('_id');
      
      const supplierIds = suppliers.map(s => s._id);
      if (supplierIds.length > 0) {
        query.createdBy = { $in: supplierIds };
      } else {
        // No suppliers onboarded, return empty array
        return res.json([]);
      }

      // Filter by specific supplier if provided
      if (supplierId) {
        // Verify supplier is onboarded by this buyer
        const supplier = await User.findOne({
          _id: supplierId,
          onboardedBy: req.user._id,
          role: 'seller'
        });
        if (supplier) {
          query.createdBy = supplierId;
        } else {
          return res.status(403).json({ message: 'Access denied to this supplier' });
        }
      }
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { projectNumber: { $regex: search, $options: 'i' } },
        { documentNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const quotations = await Quotation.find(query)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email')
      .populate('versions.comments.addedBy', 'name email')
      .sort({ updatedAt: -1 });

    res.json(quotations);
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single quotation
router.get('/:id', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email')
      .populate('versions.comments.addedBy', 'name email');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Check access
    if (req.user.role === 'seller') {
      // Sellers can only see their own quotations
      if (quotation.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'buyer') {
      // Buyers can only see quotations from their onboarded suppliers
      const User = require('../models/User');
      const supplier = await User.findOne({
        _id: quotation.createdBy._id,
        onboardedBy: req.user._id,
        role: 'seller'
      });
      if (!supplier) {
        return res.status(403).json({ message: 'Access denied. This quotation is not from your onboarded supplier.' });
      }
    }

    res.json(quotation);
  } catch (error) {
    console.error('Get quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload new quotation (Seller only)
router.post('/upload', auth, requireRole('seller'), upload.single('pdf'), async (req, res) => {
  let generatedPdfPath = null;
  try {
    const { projectNumber, documentNumber, title, htmlContent, uploadMode } = req.body;

    if (!projectNumber || !documentNumber || !title) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Please provide projectNumber, documentNumber, and title' });
    }

    // Validate that either file or htmlContent is provided
    if (!req.file && !htmlContent) {
      return res.status(400).json({ message: 'Please either upload a PDF file or create content using the editor' });
    }

    let pdfUrl;
    let filename;

    // If HTML content is provided, generate PDF from it
    if (htmlContent && uploadMode === 'create') {
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        filename = `quotation-${uniqueSuffix}.pdf`;
        generatedPdfPath = path.join(uploadsDir, filename);
        
        await generatePDFFromHTML(htmlContent, generatedPdfPath);
        pdfUrl = `/uploads/quotations/${filename}`;
      } catch (error) {
        console.error('Error generating PDF from HTML:', error);
        return res.status(500).json({ message: 'Failed to generate PDF from content', error: error.message });
      }
    } else if (req.file) {
      // Use uploaded file
      pdfUrl = `/uploads/quotations/${req.file.filename}`;
      filename = req.file.filename;
    } else {
      return res.status(400).json({ message: 'Please provide either a PDF file or HTML content' });
    }

    // Extract issued date from PDF using OCR (only for uploaded PDFs, not generated ones)
    let issuedDate = null;
    let dueDate = null;
    
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        console.log('Extracting date from PDF:', req.file.path);
        issuedDate = await extractDateFromPDF(req.file.path);
        
        if (issuedDate) {
          console.log('Extracted issued date:', issuedDate);
          dueDate = calculateDueDate(issuedDate);
          console.log('Calculated due date (45 days later):', dueDate);
        } else {
          console.log('No date found in PDF');
        }
      } catch (error) {
        console.error('Error extracting date from PDF:', error);
        // Don't fail the upload if date extraction fails
      }
    }

    // Check if quotation already exists
    let quotation = await Quotation.findOne({ documentNumber });

    const version = quotation ? quotation.getNextVersion() : 'REV.A';

    const versionData = {
      version,
      pdfUrl,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
      htmlContent: (htmlContent && uploadMode === 'create') ? htmlContent : null
    };

    if (quotation) {
      // Add new version to existing quotation
      const oldStatus = quotation.status;
      quotation.versions.push(versionData);
      quotation.currentVersion = version;
      quotation.status = 'Submitted';
      
      // Update issued date and due date if extracted
      if (issuedDate) {
        quotation.issuedDate = issuedDate;
        quotation.dueDate = dueDate;
      }
      
      // Add history entries
      addHistoryEntry(
        quotation,
        'version_uploaded',
        `New version ${version} uploaded`,
        req.user._id,
        null,
        version,
        version,
        { pdfUrl, filename, createdFromEditor: uploadMode === 'create' }
      );
      
      if (oldStatus !== 'Submitted') {
        addHistoryEntry(
          quotation,
          'status_changed',
          `Status changed from ${oldStatus} to Submitted`,
          req.user._id,
          oldStatus,
          'Submitted',
          version
        );
      }
      
      await quotation.save();
    } else {
      // Create new quotation
      quotation = new Quotation({
        projectNumber,
        documentNumber,
        title,
        currentVersion: version,
        status: 'Submitted',
        versions: [versionData],
        createdBy: req.user._id,
        history: [],
        issuedDate: issuedDate || null,
        dueDate: dueDate || null
      });
      
      // Add history entry for creation
      addHistoryEntry(
        quotation,
        'created',
        `Quotation created with version ${version}`,
        req.user._id,
        null,
        { projectNumber, documentNumber, title, version },
        version,
        { pdfUrl, filename, createdFromEditor: uploadMode === 'create' }
      );
      
      await quotation.save();
    }

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('createdBy', 'name email')
      .populate('versions.uploadedBy', 'name email');

    // Send notification to buyer if new version uploaded
    if (quotation && populatedQuotation.createdBy && populatedQuotation.createdBy.onboardedBy) {
      const buyer = await User.findById(populatedQuotation.createdBy.onboardedBy);
      if (buyer && buyer.email) {
        const notificationEmail = emailTemplates.newQuotationVersion(
          quotation.title,
          version,
          quotation._id.toString()
        );
        await sendEmail(buyer.email, notificationEmail.subject, notificationEmail.html);
      }
    }

    res.status(201).json(populatedQuotation);
  } catch (error) {
    console.error('Upload quotation error:', error);
    // Clean up files on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    if (generatedPdfPath && fs.existsSync(generatedPdfPath)) {
      try {
        fs.unlinkSync(generatedPdfPath);
      } catch (unlinkError) {
        console.error('Error deleting generated PDF:', unlinkError);
      }
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get quotation HTML content for editing (Seller only)
router.get('/:id/html-content', auth, requireRole('seller'), async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Check if seller owns this quotation
    if (quotation.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You can only edit your own quotations.' });
    }

    // Get the latest version's HTML content
    const latestVersion = quotation.versions[quotation.versions.length - 1];
    if (!latestVersion) {
      return res.status(404).json({ message: 'No versions found' });
    }

    res.json({
      htmlContent: latestVersion.htmlContent || '',
      quotation: {
        projectNumber: quotation.projectNumber,
        documentNumber: quotation.documentNumber,
        title: quotation.title
      }
    });
  } catch (error) {
    console.error('Get HTML content error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Annotate quotation (Buyer only)
router.post('/:id/annotate', auth, requireRole('buyer'), async (req, res) => {
  try {
    const { comment, comments, annotations } = req.body;
    const quotationDoc = await Quotation.findById(req.params.id);

    if (!quotationDoc) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (quotationDoc.status === 'Approved') {
      return res.status(400).json({ message: 'Cannot annotate approved quotation' });
    }

    // Convert ALL versions' comments from string to array format (for backward compatibility)
    // This is necessary because existing quotations may have string comments or arrays with empty strings
    // CRITICAL: We need to clean the data BEFORE Mongoose tries to validate it
    quotationDoc.versions.forEach((version, index) => {
      let needsUpdate = false;
      let cleanComments = [];
      
      // Handle non-array values (string, null, undefined)
      if (!Array.isArray(version.comments)) {
        needsUpdate = true;
        if (version.comments && typeof version.comments === 'string' && version.comments.trim()) {
          // Convert old string comment to array format
          const addedByUserId = version.reviewedBy || req.user._id;
          cleanComments = [{ 
            text: version.comments, 
            addedBy: addedByUserId, 
            addedAt: version.uploadedAt || new Date() 
          }];
        } else {
          // Handle empty string, null, undefined, or any other non-array value
          cleanComments = [];
        }
      } else {
        // It's already an array, but check if it contains invalid elements (empty strings, etc.)
        const hasInvalidElements = version.comments.some(item => 
          item === '' || item === null || item === undefined || 
          (typeof item === 'string') ||
          (typeof item === 'object' && item !== null && !item.text)
        );
        
        if (hasInvalidElements) {
          needsUpdate = true;
          // Build a clean array
          for (const item of version.comments) {
            // Skip empty strings, null, undefined
            if (item === '' || item === null || item === undefined) {
              continue;
            }
            
            // Convert string to comment object
            if (typeof item === 'string' && item.trim()) {
              const addedByUserId = version.reviewedBy || req.user._id;
              cleanComments.push({
                text: item.trim(),
                addedBy: addedByUserId,
                addedAt: version.uploadedAt || new Date()
              });
            } 
            // Keep valid comment objects
            else if (typeof item === 'object' && item !== null && item.text) {
              cleanComments.push(item);
            }
          }
        } else {
          // Array is already clean, no changes needed
          cleanComments = version.comments;
        }
      }
      
      // Only update if we found issues
      if (needsUpdate) {
        // Use set() to completely replace the array
        version.set('comments', cleanComments);
        version.markModified('comments');
      }
    });

    const latestVersion = quotationDoc.versions[quotationDoc.versions.length - 1];
    if (!latestVersion) {
      return res.status(400).json({ message: 'No versions found' });
    }

    // Add new comment if provided
    if (comment && comment.trim()) {
      // Ensure req.user._id is a valid ObjectId
      if (!req.user._id) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Ensure comments is an array before pushing
      if (!Array.isArray(latestVersion.comments)) {
        latestVersion.comments = [];
      }
      
      latestVersion.comments.push({
        text: comment.trim(),
        addedBy: req.user._id,
        addedAt: new Date()
      });
      
      // Mark comments array as modified (important for nested arrays in Mongoose)
      latestVersion.markModified('comments');

      // Add history entry for new comment
      addHistoryEntry(
        quotationDoc,
        'commented',
        `Comment added: ${comment.trim().substring(0, 100)}${comment.trim().length > 100 ? '...' : ''}`,
        req.user._id,
        null,
        comment.trim(),
        latestVersion.version
      );
    }

    // Update annotations only if explicitly provided (preserve existing if not provided)
    const oldAnnotations = latestVersion.annotations;
    if (annotations !== undefined && annotations !== null) {
      // Ensure annotations is an array
      const normalizedAnnotations = Array.isArray(annotations) ? annotations : [];
      latestVersion.annotations = normalizedAnnotations;
      
      // Mark the annotations field as modified (critical for Mongoose to save nested objects)
      latestVersion.markModified('annotations');
      
      // Add history entry only if annotations actually changed
      if (JSON.stringify(normalizedAnnotations) !== JSON.stringify(oldAnnotations)) {
        const annotationCount = normalizedAnnotations.length;
        addHistoryEntry(
          quotationDoc,
          'annotations_saved',
          `${annotationCount} annotation(s) saved`,
          req.user._id,
          oldAnnotations ? (Array.isArray(oldAnnotations) ? oldAnnotations.length : 0) : 0,
          annotationCount,
          latestVersion.version,
          { annotationCount }
        );
      }
    }
    
    // Set reviewedBy if not already set or if adding a comment
    if (!latestVersion.reviewedBy || (comment && comment.trim())) {
      latestVersion.reviewedBy = req.user._id;
    }

    // Update quotation status
    const oldStatus = quotationDoc.status;
    if (quotationDoc.status === 'Submitted') {
      quotationDoc.status = 'Under Review';
      
      addHistoryEntry(
        quotationDoc,
        'status_changed',
        `Status changed from ${oldStatus} to Under Review`,
        req.user._id,
        oldStatus,
        'Under Review',
        latestVersion.version
      );
    }

    try {
      // Mark versions array as modified to ensure nested changes are saved
      // This is critical for Mongoose to detect changes in nested arrays
      quotationDoc.markModified('versions');
      
      // Mark history as modified if we added history entries
      if ((comment && comment.trim()) || (annotations !== undefined && annotations !== null)) {
        quotationDoc.markModified('history');
      }
      
      await quotationDoc.save();
    } catch (saveError) {
      console.error('Error saving quotation:', saveError);
      console.error('Save error details:', JSON.stringify(saveError, null, 2));
      return res.status(500).json({ 
        message: 'Failed to save quotation', 
        error: saveError.message,
        details: saveError.errors || saveError
      });
    }

    const populatedQuotation = await Quotation.findById(quotationDoc._id)
      .populate('createdBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email')
      .populate('versions.comments.addedBy', 'name email');

    if (!populatedQuotation) {
      return res.status(500).json({ message: 'Failed to retrieve saved quotation' });
    }

    // Send notification to seller if status changed
    if (quotationDoc.status !== oldStatus && populatedQuotation.createdBy && populatedQuotation.createdBy.email) {
      const latestComment = Array.isArray(latestVersion.comments) && latestVersion.comments.length > 0
        ? latestVersion.comments[latestVersion.comments.length - 1].text
        : '';
      const notificationEmail = emailTemplates.quotationStatusChange(
        quotationDoc.title,
        quotationDoc.status,
        latestComment,
        quotationDoc._id.toString()
      );
      try {
        await sendEmail(
          populatedQuotation.createdBy.email,
          notificationEmail.subject,
          notificationEmail.html
        );
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json(populatedQuotation);
  } catch (error) {
    console.error('Annotate quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request changes (Buyer only)
router.post('/:id/request-changes', auth, requireRole('buyer'), async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (quotation.status === 'Approved') {
      return res.status(400).json({ message: 'Cannot modify approved quotation' });
    }

    const oldStatus = quotation.status;
    quotation.status = 'Changes Requested';
    
    // Add history entry
    addHistoryEntry(
      quotation,
      'changes_requested',
      'Changes requested for quotation',
      req.user._id,
      oldStatus,
      'Changes Requested',
      quotation.currentVersion
    );
    
    await quotation.save();

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('createdBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email');

    // Send notification to seller
    if (populatedQuotation.createdBy && populatedQuotation.createdBy.email) {
      const latestVersion = populatedQuotation.versions[populatedQuotation.versions.length - 1];
      const notificationEmail = emailTemplates.quotationStatusChange(
        quotation.title,
        quotation.status,
        latestVersion?.comments || '',
        quotation._id.toString()
      );
      await sendEmail(
        populatedQuotation.createdBy.email,
        notificationEmail.subject,
        notificationEmail.html
      );
    }

    res.json(populatedQuotation);
  } catch (error) {
    console.error('Request changes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve quotation (Buyer only)
router.post('/:id/approve', auth, requireRole('buyer'), async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    const oldStatus = quotation.status;
    quotation.status = 'Approved';
    quotation.approvedBy = req.user._id;
    quotation.approvedAt = new Date();
    
    // Add history entry
    addHistoryEntry(
      quotation,
      'approved',
      'Quotation approved',
      req.user._id,
      oldStatus,
      'Approved',
      quotation.currentVersion,
      { approvedAt: quotation.approvedAt }
    );
    
    await quotation.save();

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email');

    // Send notification to seller
    if (populatedQuotation.createdBy && populatedQuotation.createdBy.email) {
      const notificationEmail = emailTemplates.quotationStatusChange(
        quotation.title,
        quotation.status,
        'Your quotation has been approved!',
        quotation._id.toString()
      );
      await sendEmail(
        populatedQuotation.createdBy.email,
        notificationEmail.subject,
        notificationEmail.html
      );
    }

    res.json(populatedQuotation);
  } catch (error) {
    console.error('Approve quotation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get statistics/analytics (Buyer only)
router.get('/statistics', auth, requireRole('buyer'), async (req, res) => {
  try {
    // Get all suppliers for this buyer
    const suppliers = await User.find({ 
      onboardedBy: req.user._id,
      role: 'seller'
    }).select('_id');

    const supplierIds = suppliers.map(s => s._id);
    
    if (supplierIds.length === 0) {
      return res.json({
        totalQuotations: 0,
        byStatus: {},
        bySupplier: [],
        recentActivity: []
      });
    }

    // Get all quotations from onboarded suppliers
    const quotations = await Quotation.find({ 
      createdBy: { $in: supplierIds }
    })
    .populate('createdBy', 'name email')
    .sort({ updatedAt: -1 });

    // Calculate statistics
    const stats = {
      totalQuotations: quotations.length,
      byStatus: {
        Submitted: quotations.filter(q => q.status === 'Submitted').length,
        'Under Review': quotations.filter(q => q.status === 'Under Review').length,
        'Changes Requested': quotations.filter(q => q.status === 'Changes Requested').length,
        Approved: quotations.filter(q => q.status === 'Approved').length
      },
      bySupplier: suppliers.map(supplier => {
        const supplierQuotations = quotations.filter(q => 
          q.createdBy._id.toString() === supplier._id.toString()
        );
        return {
          supplierId: supplier._id,
          supplierName: supplierQuotations[0]?.createdBy?.name || 'Unknown',
          total: supplierQuotations.length,
          approved: supplierQuotations.filter(q => q.status === 'Approved').length,
          pending: supplierQuotations.filter(q => 
            ['Submitted', 'Under Review', 'Changes Requested'].includes(q.status)
          ).length
        };
      }),
      recentActivity: quotations.slice(0, 10).map(q => ({
        id: q._id,
        title: q.title,
        status: q.status,
        supplier: q.createdBy?.name || 'Unknown',
        updatedAt: q.updatedAt
      }))
    };

    res.json(stats);
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get version history
router.get('/:id/history', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email')
      .select('versions');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    res.json(quotation.versions);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get activity history
router.get('/:id/activity-history', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('history.performedBy', 'name email')
      .select('history createdBy');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Check access
    if (req.user.role === 'seller') {
      // Sellers can only see their own quotations
      const fullQuotation = await Quotation.findById(req.params.id).select('createdBy');
      if (fullQuotation && fullQuotation.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'buyer') {
      // Buyers can only see quotations from their onboarded suppliers
      const fullQuotation = await Quotation.findById(req.params.id)
        .populate('createdBy', 'onboardedBy');
      if (fullQuotation && fullQuotation.createdBy && 
          fullQuotation.createdBy.onboardedBy && 
          fullQuotation.createdBy.onboardedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied. This quotation is not from your onboarded supplier.' });
      }
    }

    // Sort history by timestamp (newest first)
    const sortedHistory = (quotation.history || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json(sortedHistory);
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;



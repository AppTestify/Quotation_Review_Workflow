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
      .populate('versions.reviewedBy', 'name email');

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
        history: []
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
    const { comments, annotations } = req.body;
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (quotation.status === 'Approved') {
      return res.status(400).json({ message: 'Cannot annotate approved quotation' });
    }

    const latestVersion = quotation.versions[quotation.versions.length - 1];
    if (!latestVersion) {
      return res.status(400).json({ message: 'No versions found' });
    }

    // Update latest version with annotations
    const oldComments = latestVersion.comments;
    const oldAnnotations = latestVersion.annotations;
    latestVersion.comments = comments || latestVersion.comments;
    latestVersion.annotations = annotations || latestVersion.annotations;
    latestVersion.reviewedBy = req.user._id;

    // Add history entries
    if (comments && comments !== oldComments) {
      addHistoryEntry(
        quotation,
        'commented',
        `Comment added: ${comments.substring(0, 100)}${comments.length > 100 ? '...' : ''}`,
        req.user._id,
        oldComments,
        comments,
        latestVersion.version
      );
    }
    
    if (annotations && JSON.stringify(annotations) !== JSON.stringify(oldAnnotations)) {
      const annotationCount = Array.isArray(annotations) ? annotations.length : 0;
      addHistoryEntry(
        quotation,
        'annotations_saved',
        `${annotationCount} annotation(s) saved`,
        req.user._id,
        oldAnnotations ? (Array.isArray(oldAnnotations) ? oldAnnotations.length : 0) : 0,
        annotationCount,
        latestVersion.version,
        { annotationCount }
      );
    }

    // Update quotation status
    const oldStatus = quotation.status;
    if (quotation.status === 'Submitted') {
      quotation.status = 'Under Review';
      
      addHistoryEntry(
        quotation,
        'status_changed',
        `Status changed from ${oldStatus} to Under Review`,
        req.user._id,
        oldStatus,
        'Under Review',
        latestVersion.version
      );
    }

    await quotation.save();

    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('createdBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .populate('versions.reviewedBy', 'name email');

    // Send notification to seller if status changed
    if (quotation.status !== oldStatus && populatedQuotation.createdBy && populatedQuotation.createdBy.email) {
      const notificationEmail = emailTemplates.quotationStatusChange(
        quotation.title,
        quotation.status,
        comments,
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

module.exports = router;



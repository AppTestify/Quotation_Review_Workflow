const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'created',
      'pdf_uploaded',
      'version_uploaded',
      'status_changed',
      'annotated',
      'approved',
      'changes_requested',
      'commented',
      'annotations_saved'
    ]
  },
  description: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  version: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const versionSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true // e.g., 'REV.A', 'REV.B'
  },
  pdfUrl: {
    type: String,
    required: true
  },
  annotatedPdfUrl: {
    type: String,
    default: null
  },
  comments: [{
    text: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  annotations: {
    type: mongoose.Schema.Types.Mixed,
    default: null // Store annotation metadata as JSON
  },
  htmlContent: {
    type: String,
    default: null // Store HTML source if PDF was created from editor
  }
});

const quotationSchema = new mongoose.Schema({
  projectNumber: {
    type: String,
    required: true,
    trim: true
  },
  documentNumber: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  currentVersion: {
    type: String,
    default: 'REV.A'
  },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Changes Requested', 'Approved'],
    default: 'Submitted'
  },
  versions: [versionSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  history: [historySchema]
}, {
  timestamps: true
});

// Method to get next version
quotationSchema.methods.getNextVersion = function() {
  if (this.versions.length === 0) return 'REV.A';
  
  const lastVersion = this.versions[this.versions.length - 1].version;
  const match = lastVersion.match(/REV\.([A-Z])/);
  if (match) {
    const letter = match[1];
    if (letter === 'Z') {
      // Handle Z -> AA if needed, or just increment number
      return `REV.${letter}1`;
    }
    const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
    return `REV.${nextLetter}`;
  }
  return 'REV.A';
};

module.exports = mongoose.model('Quotation', quotationSchema);



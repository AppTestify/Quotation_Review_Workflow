import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const UploadModal = ({ isOpen, onClose, onUpload, editMode = false, initialData = null }) => {
  const [uploadMode, setUploadMode] = useState(editMode && initialData?.htmlContent ? 'create' : 'file'); // 'file' or 'create'
  const [formData, setFormData] = useState({
    projectNumber: initialData?.projectNumber || '',
    documentNumber: initialData?.documentNumber || '',
    title: initialData?.title || '',
    file: null,
    htmlContent: initialData?.htmlContent || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (editMode && initialData) {
        // Handle nested quotation structure from API
        const quotation = initialData.quotation || initialData;
        setFormData({
          projectNumber: quotation.projectNumber || '',
          documentNumber: quotation.documentNumber || '',
          title: quotation.title || '',
          file: null,
          htmlContent: initialData.htmlContent || ''
        });
        setUploadMode(initialData.htmlContent ? 'create' : 'file');
      } else {
        setFormData({
          projectNumber: '',
          documentNumber: '',
          title: '',
          file: null,
          htmlContent: ''
        });
        setUploadMode('file');
      }
      setError('');
    }
  }, [isOpen, editMode, initialData]);

  // Don't render if modal is closed, or if in edit mode but data isn't loaded yet
  if (!isOpen) return null;
  if (editMode && !initialData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="text-xl mb-4">Loading quotation data...</div>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    if (e.target.name === 'file') {
      setFormData({ ...formData, file: e.target.files[0] });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleContentChange = (content) => {
    setFormData({ ...formData, htmlContent: content });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // In edit mode, fields are disabled and should already be populated
    // But we still validate they exist
    if (!editMode && (!formData.projectNumber || !formData.documentNumber || !formData.title)) {
      setError('Please fill in all fields');
      return;
    }
    
    // In edit mode, validate that fields are populated (they should be from initialData)
    if (editMode && (!formData.projectNumber || !formData.documentNumber || !formData.title)) {
      setError('Missing quotation information. Please try again.');
      return;
    }

    if (uploadMode === 'file' && !formData.file) {
      setError('Please select a PDF file');
      return;
    }

    if (uploadMode === 'create' && !formData.htmlContent.trim()) {
      setError('Please create quotation content using the editor');
      return;
    }

    setLoading(true);
    
    const uploadFormData = new FormData();
    
    if (uploadMode === 'file') {
      uploadFormData.append('pdf', formData.file);
    } else {
      uploadFormData.append('htmlContent', formData.htmlContent);
    }
    
    uploadFormData.append('projectNumber', formData.projectNumber);
    uploadFormData.append('documentNumber', formData.documentNumber);
    uploadFormData.append('title', formData.title);
    uploadFormData.append('uploadMode', uploadMode);

    try {
      await onUpload(uploadFormData);
      setFormData({ projectNumber: '', documentNumber: '', title: '', file: null, htmlContent: '' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ]
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{editMode ? 'Edit Quotation' : 'Upload Quotation'}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex space-x-2 mb-4 border-b">
          <button
            type="button"
            onClick={() => setUploadMode('file')}
            className={`px-4 py-2 font-medium text-sm ${
              uploadMode === 'file'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload PDF File
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('create')}
            className={`px-4 py-2 font-medium text-sm ${
              uploadMode === 'create'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {editMode ? 'Edit with Editor' : 'Create PDF with Editor'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Number
              </label>
              <input
                type="text"
                name="projectNumber"
                value={formData.projectNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Number
              </label>
              <input
                type="text"
                name="documentNumber"
                value={formData.documentNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={editMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={editMode}
              />
            </div>
          </div>

          {uploadMode === 'file' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF File
              </label>
              <input
                type="file"
                name="file"
                accept="application/pdf"
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required={uploadMode === 'file'}
              />
              {formData.file && (
                <p className="mt-1 text-sm text-gray-600">{formData.file.name}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quotation Content
              </label>
              <div className="border border-gray-300 rounded-md">
                <ReactQuill
                  theme="snow"
                  value={formData.htmlContent}
                  onChange={handleContentChange}
                  modules={quillModules}
                  placeholder="Design your quotation content here..."
                  style={{ minHeight: '400px' }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Use the editor to create your quotation. The content will be converted to PDF automatically.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (uploadMode === 'create' ? (editMode ? 'Updating PDF...' : 'Creating PDF...') : 'Uploading...') : (editMode ? (uploadMode === 'create' ? 'Update PDF' : 'Upload New Version') : (uploadMode === 'create' ? 'Create PDF' : 'Upload'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;

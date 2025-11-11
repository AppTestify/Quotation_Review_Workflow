import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getQuotation,
  annotateQuotation,
  requestChanges,
  approveQuotation,
  uploadQuotation,
  getActivityHistory,
  getQuotationHtmlContent
} from '../api/quotations';
import PDFViewer from '../components/PDFViewer';
import CommentSidebar from '../components/CommentSidebar';
import VersionTimeline from '../components/VersionTimeline';
import ActivityHistory from '../components/ActivityHistory';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import UploadModal from '../components/UploadModal';

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState([]);
  const [comments, setComments] = useState([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [activeVersion, setActiveVersion] = useState(null);
  const [activityHistory, setActivityHistory] = useState([]);
  const [showActivityHistory, setShowActivityHistory] = useState(true);

  useEffect(() => {
    fetchQuotation();
    fetchActivityHistory();
  }, [id]);

  const fetchActivityHistory = async () => {
    try {
      const data = await getActivityHistory(id);
      setActivityHistory(data);
    } catch (error) {
      console.error('Error fetching activity history:', error);
    }
  };

  useEffect(() => {
    if (quotation && quotation.versions && quotation.versions.length > 0) {
      const latest = quotation.versions[quotation.versions.length - 1];
      // Update activeVersion to the latest version from the fetched quotation
      // This ensures we always use the most up-to-date version data
      setActiveVersion(latest);
      // Load annotations from the latest version
      const versionAnnotations = latest.annotations || [];
      // Ensure annotations is an array and normalize the data
      const normalizedAnnotations = Array.isArray(versionAnnotations) 
        ? versionAnnotations.map((ann, index) => ({
            ...ann,
            // Ensure all numeric fields are properly typed
            page: typeof ann.page === 'number' ? ann.page : parseInt(ann.page) || 1,
            x: typeof ann.x === 'number' ? ann.x : (ann.x ? parseFloat(ann.x) : undefined),
            y: typeof ann.y === 'number' ? ann.y : (ann.y ? parseFloat(ann.y) : undefined),
            startX: typeof ann.startX === 'number' ? ann.startX : (ann.startX ? parseFloat(ann.startX) : undefined),
            startY: typeof ann.startY === 'number' ? ann.startY : (ann.startY ? parseFloat(ann.startY) : undefined),
            endX: typeof ann.endX === 'number' ? ann.endX : (ann.endX ? parseFloat(ann.endX) : undefined),
            endY: typeof ann.endY === 'number' ? ann.endY : (ann.endY ? parseFloat(ann.endY) : undefined),
            strokeWidth: typeof ann.strokeWidth === 'number' ? ann.strokeWidth : (ann.strokeWidth ? parseFloat(ann.strokeWidth) : undefined),
            fontSize: typeof ann.fontSize === 'number' ? ann.fontSize : (ann.fontSize ? parseFloat(ann.fontSize) : undefined),
            textFontSize: typeof ann.textFontSize === 'number' ? ann.textFontSize : (ann.textFontSize ? parseFloat(ann.textFontSize) : undefined),
            width: typeof ann.width === 'number' ? ann.width : (ann.width ? parseFloat(ann.width) : undefined),
            height: typeof ann.height === 'number' ? ann.height : (ann.height ? parseFloat(ann.height) : undefined),
            // Preserve all other properties
            id: ann.id || `ann_${index}`,
            type: ann.type,
            color: ann.color,
            text: ann.text,
            fontFamily: ann.fontFamily,
            fillColor: ann.fillColor,
            textColor: ann.textColor,
            textFontFamily: ann.textFontFamily,
            imageData: ann.imageData,
            path: ann.path,
            createdAt: ann.createdAt
          }))
        : [];
      setAnnotations(normalizedAnnotations);
      // Handle both array and string (for backward compatibility)
      if (Array.isArray(latest.comments)) {
        setComments(latest.comments);
      } else if (latest.comments) {
        setComments([{ text: latest.comments, addedBy: { name: 'Unknown' }, addedAt: new Date() }]);
      } else {
        setComments([]);
      }
    }
  }, [quotation]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const data = await getQuotation(id);
      setQuotation(data);
    } catch (error) {
      console.error('Error fetching quotation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotationAdd = (annotation) => {
    // Add unique ID and timestamp to annotation if not present
    const annotationWithId = {
      ...annotation,
      id: annotation.id || `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: annotation.createdAt || new Date().toISOString()
    };
    setAnnotations([...annotations, annotationWithId]);
  };

  const handleUndo = () => {
    if (annotations.length > 0) {
      setAnnotations(annotations.slice(0, -1));
    }
  };

  const handleSaveAnnotations = async () => {
    try {
      // Ensure all annotations have required fields and are properly structured
      const normalizedAnnotations = annotations.map((ann, index) => ({
        ...ann,
        id: ann.id || `ann_${Date.now()}_${index}`,
        // Ensure all coordinate fields are numbers
        page: typeof ann.page === 'number' ? ann.page : parseInt(ann.page) || 1,
        x: typeof ann.x === 'number' ? ann.x : parseFloat(ann.x) || 0,
        y: typeof ann.y === 'number' ? ann.y : parseFloat(ann.y) || 0,
        startX: typeof ann.startX === 'number' ? ann.startX : (ann.startX ? parseFloat(ann.startX) : undefined),
        startY: typeof ann.startY === 'number' ? ann.startY : (ann.startY ? parseFloat(ann.startY) : undefined),
        endX: typeof ann.endX === 'number' ? ann.endX : (ann.endX ? parseFloat(ann.endX) : undefined),
        endY: typeof ann.endY === 'number' ? ann.endY : (ann.endY ? parseFloat(ann.endY) : undefined),
        // Preserve all other properties
        type: ann.type,
        color: ann.color,
        strokeWidth: ann.strokeWidth,
        text: ann.text,
        fontFamily: ann.fontFamily,
        fontSize: ann.fontSize,
        fillColor: ann.fillColor,
        textColor: ann.textColor,
        textFontFamily: ann.textFontFamily,
        textFontSize: ann.textFontSize,
        imageData: ann.imageData,
        width: ann.width,
        height: ann.height,
        path: ann.path,
        createdAt: ann.createdAt || new Date().toISOString()
      }));
      
      await annotateQuotation(id, null, normalizedAnnotations);
      // Refetch quotation to get updated annotations from backend
      const updatedQuotation = await getQuotation(id);
      setQuotation(updatedQuotation);
      await fetchActivityHistory();
      alert('Annotations saved successfully!');
    } catch (error) {
      console.error('Error saving annotations:', error);
      alert('Failed to save annotations: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddComment = async (commentText) => {
    try {
      // Only send comment, don't send annotations (backend will preserve existing)
      await annotateQuotation(id, commentText, undefined);
      await fetchQuotation();
      await fetchActivityHistory();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRequestChanges = async () => {
    if (window.confirm('Request changes for this quotation?')) {
      try {
        await requestChanges(id);
        await fetchQuotation();
        await fetchActivityHistory();
        alert('Changes requested successfully!');
      } catch (error) {
        console.error('Error requesting changes:', error);
        alert('Failed to request changes');
      }
    }
  };

  const handleApprove = async () => {
    if (window.confirm('Approve this quotation? This action cannot be undone.')) {
      try {
        await approveQuotation(id);
        await fetchQuotation();
        await fetchActivityHistory();
        alert('Quotation approved successfully!');
      } catch (error) {
        console.error('Error approving quotation:', error);
        alert('Failed to approve quotation');
      }
    }
  };

  const handleReupload = async (formData) => {
    try {
      // Use the same document number for re-upload
      formData.append('documentNumber', quotation.documentNumber);
      formData.append('projectNumber', quotation.projectNumber);
      formData.append('title', quotation.title);
      
      await uploadQuotation(formData);
      await fetchQuotation();
      await fetchActivityHistory();
      setIsUploadModalOpen(false);
      alert('New version uploaded successfully!');
    } catch (error) {
      throw error;
    }
  };

  const handleEditClick = async () => {
    try {
      setLoadingEditData(true);
      const data = await getQuotationHtmlContent(id);
      setEditData(data);
      setIsEditModalOpen(true);
    } catch (error) {
      console.error('Error loading quotation for editing:', error);
      alert('Failed to load quotation for editing. ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEditData(false);
    }
  };

  const handleEditSubmit = async (formData) => {
    try {
      // Use the same document number for re-upload
      formData.append('documentNumber', quotation.documentNumber);
      formData.append('projectNumber', quotation.projectNumber);
      formData.append('title', quotation.title);
      
      await uploadQuotation(formData);
      await fetchQuotation();
      await fetchActivityHistory();
      setIsEditModalOpen(false);
      setEditData(null);
      alert('Quotation updated successfully!');
    } catch (error) {
      throw error;
    }
  };

  const handleVersionSelect = (version) => {
    setActiveVersion(version);
    // Ensure annotations is an array and normalize the data
    const versionAnnotations = version.annotations || [];
    const normalizedAnnotations = Array.isArray(versionAnnotations)
      ? versionAnnotations.map((ann, index) => ({
          ...ann,
          // Ensure all numeric fields are properly typed
          page: typeof ann.page === 'number' ? ann.page : parseInt(ann.page) || 1,
          x: typeof ann.x === 'number' ? ann.x : (ann.x ? parseFloat(ann.x) : undefined),
          y: typeof ann.y === 'number' ? ann.y : (ann.y ? parseFloat(ann.y) : undefined),
          startX: typeof ann.startX === 'number' ? ann.startX : (ann.startX ? parseFloat(ann.startX) : undefined),
          startY: typeof ann.startY === 'number' ? ann.startY : (ann.startY ? parseFloat(ann.startY) : undefined),
          endX: typeof ann.endX === 'number' ? ann.endX : (ann.endX ? parseFloat(ann.endX) : undefined),
          endY: typeof ann.endY === 'number' ? ann.endY : (ann.endY ? parseFloat(ann.endY) : undefined),
          strokeWidth: typeof ann.strokeWidth === 'number' ? ann.strokeWidth : (ann.strokeWidth ? parseFloat(ann.strokeWidth) : undefined),
          fontSize: typeof ann.fontSize === 'number' ? ann.fontSize : (ann.fontSize ? parseFloat(ann.fontSize) : undefined),
          textFontSize: typeof ann.textFontSize === 'number' ? ann.textFontSize : (ann.textFontSize ? parseFloat(ann.textFontSize) : undefined),
          width: typeof ann.width === 'number' ? ann.width : (ann.width ? parseFloat(ann.width) : undefined),
          height: typeof ann.height === 'number' ? ann.height : (ann.height ? parseFloat(ann.height) : undefined),
          // Preserve all other properties
          id: ann.id || `ann_${index}`,
          type: ann.type,
          color: ann.color,
          text: ann.text,
          fontFamily: ann.fontFamily,
          fillColor: ann.fillColor,
          textColor: ann.textColor,
          textFontFamily: ann.textFontFamily,
          imageData: ann.imageData,
          path: ann.path,
          createdAt: ann.createdAt
        }))
      : [];
    setAnnotations(normalizedAnnotations);
    // Handle both array and string (for backward compatibility)
    if (Array.isArray(version.comments)) {
      setComments(version.comments);
    } else if (version.comments) {
      setComments([{ text: version.comments, addedBy: { name: 'Unknown' }, addedAt: new Date() }]);
    } else {
      setComments([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">Quotation not found</div>
      </div>
    );
  }

  const isSeller = user.role === 'seller';
  const isBuyer = user.role === 'buyer';
  const isApproved = quotation.status === 'Approved';
  const latestVersion = quotation.versions && quotation.versions[quotation.versions.length - 1];
  const getPdfUrl = (version) => {
    if (!version) return null;
    // If it's already a full URL, use it; otherwise use relative path (proxy will handle it)
    if (version.pdfUrl.startsWith('http')) {
      return version.pdfUrl;
    }
    // Use relative URL - Vite proxy will forward to backend
    return version.pdfUrl;
  };
  const pdfUrl = getPdfUrl(activeVersion) || getPdfUrl(latestVersion);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => navigate(isSeller ? '/seller' : '/buyer')}
                className="text-blue-600 hover:text-blue-800 mb-2"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{quotation.title}</h1>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                <span>Project: {quotation.projectNumber}</span>
                <span>Document: {quotation.documentNumber}</span>
                <span>Version: {quotation.currentVersion}</span>
                <ApprovalStatusBadge status={quotation.status} />
              </div>
            </div>
            <div className="flex space-x-2">
              {isSeller && !isApproved && (
                <>
                  {(quotation.status === 'Under Review' || quotation.status === 'Changes Requested') && (
                    <button
                      onClick={handleEditClick}
                      disabled={loadingEditData}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      {loadingEditData ? 'Loading...' : 'Edit Quotation'}
                    </button>
                  )}
                  {quotation.status === 'Changes Requested' && (
                    <button
                      onClick={() => setIsUploadModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Upload Revised Version
                    </button>
                  )}
                </>
              )}
              {isBuyer && !isApproved && (
                <>
                  <button
                    onClick={handleSaveAnnotations}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Save Annotations
                  </button>
                  <button
                    onClick={handleRequestChanges}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Version Timeline Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Version History</h3>
              {quotation.versions && quotation.versions.length > 0 ? (
                <div className="space-y-2">
                  {quotation.versions.map((version, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleVersionSelect(version)}
                      className={`w-full text-left p-2 rounded ${
                        activeVersion === version
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{version.version}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(version.uploadedAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No versions available</p>
              )}
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow" style={{ height: '800px' }}>
              {pdfUrl ? (
                <PDFViewer
                  pdfUrl={pdfUrl}
                  annotations={annotations}
                  onAnnotationAdd={isBuyer && !isApproved ? handleAnnotationAdd : undefined}
                  onUndo={isBuyer && !isApproved ? handleUndo : undefined}
                  readOnly={isSeller || isApproved}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No PDF available</p>
                </div>
              )}
            </div>
          </div>

          {/* Comments Sidebar */}
          <div className="lg:col-span-1">
            <CommentSidebar
              comments={comments}
              annotations={annotations}
              onAddComment={isBuyer && !isApproved ? handleAddComment : undefined}
            />
          </div>
        </div>

        {/* Activity History */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Activity History</h3>
            <button
              onClick={() => setShowActivityHistory(!showActivityHistory)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showActivityHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
          {showActivityHistory ? (
            <ActivityHistory activities={activityHistory} />
          ) : (
            <p className="text-sm text-gray-500">Click "Show History" to view all activities</p>
          )}
        </div>

        {/* Version Timeline */}
        {quotation.versions && quotation.versions.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Version Timeline</h3>
            <VersionTimeline versions={quotation.versions} />
          </div>
        )}
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleReupload}
        editMode={false}
      />
      <UploadModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditData(null);
        }}
        onUpload={handleEditSubmit}
        editMode={true}
        initialData={editData}
      />
    </div>
  );
};

export default QuotationDetail;


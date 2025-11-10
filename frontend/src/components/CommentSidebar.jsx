import React from 'react';
import { format } from 'date-fns';

const CommentSidebar = ({ comments, annotations, onAddComment }) => {
  const [newComment, setNewComment] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newComment.trim() && onAddComment) {
      await onAddComment(newComment);
      setNewComment('');
    }
  };

  // Handle backward compatibility - comments might be string or array
  const commentsArray = Array.isArray(comments) ? comments : (comments ? [{ text: comments, addedBy: { name: 'Unknown' }, addedAt: new Date() }] : []);

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4">Comments & Annotations</h3>
      
      {commentsArray.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Comments ({commentsArray.length})</h4>
          <div className="space-y-3">
            {commentsArray.map((comment, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>{comment.addedBy?.name || 'Unknown'}</span>
                  <span>{comment.addedAt ? format(new Date(comment.addedAt), 'MMM d, yyyy HH:mm') : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {annotations && annotations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Annotations</h4>
          <div className="space-y-2">
            {annotations.map((annotation, idx) => (
              <div key={idx} className="bg-blue-50 p-2 rounded text-sm">
                <p className="text-gray-700">{annotation.comment || 'Annotation'}</p>
                {annotation.type && (
                  <span className="text-xs text-gray-500">Type: {annotation.type}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {onAddComment && (
        <form onSubmit={handleSubmit} className="mt-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            rows={4}
          />
          <button
            type="submit"
            className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Add Comment
          </button>
        </form>
      )}
    </div>
  );
};

export default CommentSidebar;



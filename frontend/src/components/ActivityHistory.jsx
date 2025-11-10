import React from 'react';
import { format } from 'date-fns';

const ActivityHistory = ({ activities }) => {
  const getActionIcon = (action) => {
    const icons = {
      created: '📄',
      pdf_uploaded: '📤',
      version_uploaded: '🔄',
      status_changed: '🔄',
      annotated: '✏️',
      approved: '✅',
      changes_requested: '⚠️',
      commented: '💬',
      annotations_saved: '💾'
    };
    return icons[action] || '📝';
  };

  const getActionColor = (action) => {
    const colors = {
      created: 'bg-blue-100 text-blue-800',
      pdf_uploaded: 'bg-green-100 text-green-800',
      version_uploaded: 'bg-purple-100 text-purple-800',
      status_changed: 'bg-yellow-100 text-yellow-800',
      annotated: 'bg-indigo-100 text-indigo-800',
      approved: 'bg-green-100 text-green-800',
      changes_requested: 'bg-orange-100 text-orange-800',
      commented: 'bg-gray-100 text-gray-800',
      annotations_saved: 'bg-teal-100 text-teal-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatAction = (action) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No activity history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div
          key={activity._id || index}
          className="flex items-start space-x-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${getActionColor(activity.action)}`}>
              {getActionIcon(activity.action)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  by {activity.performedBy?.name || 'Unknown'} ({activity.performedBy?.role === 'buyer' ? 'Buyer' : 'Supplier'})
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {format(new Date(activity.timestamp), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(activity.timestamp), 'h:mm a')}
                </p>
              </div>
            </div>
            
            {activity.version && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  Version: {activity.version}
                </span>
              </div>
            )}
            
            {activity.oldValue && activity.newValue && (
              <div className="mt-2 text-xs text-gray-600">
                <span className="line-through text-gray-400">{activity.oldValue}</span>
                {' → '}
                <span className="font-medium">{activity.newValue}</span>
              </div>
            )}
            
            {activity.metadata && activity.metadata.annotationCount !== undefined && (
              <div className="mt-2 text-xs text-gray-600">
                {activity.metadata.annotationCount} annotation(s)
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityHistory;



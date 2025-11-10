import React from 'react';
import { format } from 'date-fns';

const VersionTimeline = ({ versions }) => {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {versions.map((version, idx) => (
          <li key={idx}>
            <div className="relative pb-8">
              {idx !== versions.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                    <span className="text-white text-xs font-bold">
                      {version.version.replace('REV.', '')}
                    </span>
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-gray-900">
                        {version.uploadedBy?.name || 'Unknown'}
                      </span>{' '}
                      uploaded {version.version}
                    </p>
                    {version.reviewedBy && (
                      <p className="text-sm text-gray-500 mt-1">
                        Reviewed by{' '}
                        <span className="font-medium text-gray-900">
                          {version.reviewedBy.name}
                        </span>
                      </p>
                    )}
                    {version.comments && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                        {version.comments}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm whitespace-nowrap text-gray-500">
                    {format(new Date(version.uploadedAt), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VersionTimeline;



import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getQuotations } from '../api/quotations';
import { getSuppliers } from '../api/suppliers';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import { format } from 'date-fns';

const BuyerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allQuotations, setAllQuotations] = useState([]); // For analytics - all quotations without filters

  useEffect(() => {
    fetchSuppliers();
    fetchAllQuotations(); // Fetch all quotations for analytics
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter, supplierFilter, searchQuery]);

  const fetchSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const data = await getQuotations(
        statusFilter || undefined,
        supplierFilter || undefined,
        searchQuery || undefined
      );
      setQuotations(data);
    } catch (error) {
      console.error('Error fetching quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllQuotations = async () => {
    try {
      // Fetch all quotations without any filters for analytics
      const data = await getQuotations();
      setAllQuotations(data);
    } catch (error) {
      console.error('Error fetching all quotations for analytics:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Submitted: 'bg-blue-500',
      'Under Review': 'bg-yellow-500',
      'Changes Requested': 'bg-orange-500',
      Approved: 'bg-green-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const handleViewQuotation = (id) => {
    navigate(`/quotation/${id}`);
  };

  // Calculate statistics from all quotations (unfiltered) for accurate analytics
  const calculateStats = () => {
    const quotationsForStats = allQuotations.length > 0 ? allQuotations : quotations;
    
    // Group by supplier
    const supplierMap = new Map();
    quotationsForStats.forEach(q => {
      const supplierId = q.createdBy?._id || q.createdBy;
      const supplierName = q.createdBy?.name || 'Unknown';
      
      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplierId,
          supplierName,
          total: 0,
          approved: 0,
          pending: 0
        });
      }
      
      const supplier = supplierMap.get(supplierId);
      supplier.total++;
      
      if (q.status === 'Approved') {
        supplier.approved++;
      } else if (['Submitted', 'Under Review', 'Changes Requested'].includes(q.status)) {
        supplier.pending++;
      }
    });

    // Get recent activity (top 10 most recently updated)
    const recentActivity = quotationsForStats
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(q => ({
        id: q._id,
        title: q.title,
        status: q.status,
        supplier: q.createdBy?.name || 'Unknown',
        updatedAt: q.updatedAt
      }));

    return {
      totalQuotations: quotationsForStats.length,
      byStatus: {
        Submitted: quotationsForStats.filter(q => q.status === 'Submitted').length,
        'Under Review': quotationsForStats.filter(q => q.status === 'Under Review').length,
        'Changes Requested': quotationsForStats.filter(q => q.status === 'Changes Requested').length,
        Approved: quotationsForStats.filter(q => q.status === 'Approved').length
      },
      bySupplier: Array.from(supplierMap.values()),
      recentActivity
    };
  };

  const stats = calculateStats();

  const statusCounts = {
    All: quotations.length,
    Submitted: quotations.filter((q) => q.status === 'Submitted').length,
    'Under Review': quotations.filter((q) => q.status === 'Under Review').length,
    'Changes Requested': quotations.filter((q) => q.status === 'Changes Requested').length,
    Approved: quotations.filter((q) => q.status === 'Approved').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Buyer/Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/buyer/suppliers')}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Manage Suppliers
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Profile
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Analytics Overview</h2>
          
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Quotations</h3>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : (stats?.totalQuotations || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Approved</h3>
              <p className="text-3xl font-bold text-green-600">
                {loading ? '...' : (stats?.byStatus?.Approved || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Pending Review</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {loading ? '...' : ((stats?.byStatus?.['Under Review'] || 0) + (stats?.byStatus?.Submitted || 0))}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Changes Requested</h3>
              <p className="text-3xl font-bold text-orange-600">
                {loading ? '...' : (stats?.byStatus?.['Changes Requested'] || 0)}
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          {/* {!loading && stats && stats.totalQuotations > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
              <div className="space-y-4">
                {stats.byStatus && Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{status}</span>
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getStatusColor(status)}`}
                          style={{
                            width: `${stats.totalQuotations > 0 ? (count / stats.totalQuotations) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* Supplier Performance */}
          {!loading && stats?.bySupplier && stats.bySupplier.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Performance</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approved
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approval Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.bySupplier.map((supplier) => (
                      <tr key={supplier.supplierId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {supplier.supplierName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supplier.total}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          {supplier.approved}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                          {supplier.pending}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supplier.total > 0
                            ? `${Math.round((supplier.approved / supplier.total) * 100)}%`
                            : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {/* {!loading && stats?.recentActivity && stats.recentActivity.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleViewQuotation(activity.id)}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">
                        {activity.supplier} • {format(new Date(activity.updatedAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <ApprovalStatusBadge status={activity.status} />
                  </div>
                ))}
              </div>
            </div>
          )} */}
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-6">All Quotations</h2>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search by title, project number, or document number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Supplier Filter */}
          {suppliers.length > 0 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Filter by Supplier:</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {supplierFilter && (
                <button
                  onClick={() => setSupplierFilter('')}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex space-x-2 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status === 'All' ? '' : status)}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                (statusFilter === '' && status === 'All') || statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading quotations...</div>
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No quotations found.</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {quotations.map((quotation) => (
                <li key={quotation._id}>
                  <div
                    className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewQuotation(quotation._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {quotation.title}
                          </p>
                          <ApprovalStatusBadge status={quotation.status} className="ml-3" />
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              Project: {quotation.projectNumber}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              Document: {quotation.documentNumber}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              Version: {quotation.currentVersion}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              Seller: {quotation.createdBy?.name || 'Unknown'}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>
                              Updated: {format(new Date(quotation.updatedAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
};

export default BuyerDashboard;



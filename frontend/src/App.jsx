import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Profile from './pages/Profile';
import SellerDashboard from './pages/SellerDashboard';
import BuyerDashboard from './pages/BuyerDashboard';
import QuotationDetail from './pages/QuotationDetail';
import SupplierManagement from './pages/SupplierManagement';

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'seller' ? '/seller' : '/buyer'} />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={user.role === 'seller' ? '/seller' : '/buyer'} />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to={user.role === 'seller' ? '/seller' : '/buyer'} />} />
      <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to={user.role === 'seller' ? '/seller' : '/buyer'} />} />
      <Route path="/reset-password" element={!user ? <ResetPassword /> : <Navigate to={user.role === 'seller' ? '/seller' : '/buyer'} />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      
      <Route
        path="/seller"
        element={
          <PrivateRoute requiredRole="seller">
            <SellerDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/buyer"
        element={
          <PrivateRoute requiredRole="buyer">
            <BuyerDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/buyer/suppliers"
        element={
          <PrivateRoute requiredRole="buyer">
            <SupplierManagement />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/quotation/:id"
        element={
          <PrivateRoute>
            <QuotationDetail />
          </PrivateRoute>
        }
      />
      
      <Route path="/" element={<Navigate to={user ? (user.role === 'seller' ? '/seller' : '/buyer') : '/login'} />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;



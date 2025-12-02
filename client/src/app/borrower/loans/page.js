'use client'

import React, { useState, useEffect } from 'react';
import { Eye, DollarSign, User, Menu, X, AlertCircle, CheckCircle, LogOut, XCircle, Clock, TrendingUp } from 'lucide-react';
import supabase from "../../../config/supabaseClient"

export default function BorrowerLoanStatus() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loanRequests, setLoanRequests] = useState([]);
  const [allLoanRequests, setAllLoanRequests] = useState([]); // Store ALL loans unfiltered
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch on mount
  useEffect(() => {
    fetchMyLoanRequests();
  }, []); // Only fetch once on mount
  
  // Filter locally when filterStatus changes
  useEffect(() => {
    if (allLoanRequests.length > 0) {
      if (filterStatus === 'all') {
        setLoanRequests(allLoanRequests);
      } else {
        setLoanRequests(allLoanRequests.filter(req => req.status === filterStatus));
      }
    } else {
      setLoanRequests([]);
    }
  }, [filterStatus, allLoanRequests]);
  
  const fetchMyLoanRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user from Supabase Auth
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error getting user:", userError);
        setError("You must be logged in to view your loan requests.");
        setIsLoading(false);
        if (typeof window !== 'undefined') {
          window.location.href = "/";
        }
        return;
      }

      if (!user) {
        setError("You must be logged in to view your loan requests.");
        setIsLoading(false);
        if (typeof window !== 'undefined') {
          window.location.href = "/";
        }
        return;
      }

      const userEmail = user.email;
      console.log('🔍 Searching for loan requests with email:', userEmail);

      let query = supabase
        .from('loan_requests')
        .select('*')
        .eq('borrower_email', userEmail) // Only get loans for this borrower
        .order('created_at', { ascending: false });

      // Don't filter by status here - get ALL loans
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching loan requests:', error);
        setError('Failed to load your loan requests');
        setLoanRequests([]);
        return;
      }

      console.log('📊 Found loan requests:', data?.length || 0);
      console.log('📋 Raw data:', data);

      const mapped = (data || []).map((req) => ({
        id: req.request_id,
        borrowerName: req.borrower_name,
        email: req.borrower_email,
        loanType: req.loan_type,
        loanAmount: Number(req.loan_amount),
        loanTerm: req.loan_term,
        loanPurpose: req.loan_purpose,
        creditScore: req.credit_score,
        creditBand: req.credit_band,
        reasons: Array.isArray(req.reasons) ? req.reasons : [],
        requestDate: req.request_date,
        status: req.status,
        createdAt: req.created_at,
      }));

      // Store ALL loans
      setAllLoanRequests(mapped);
      
      // Set filtered loans based on current filter
      if (filterStatus === 'all') {
        setLoanRequests(mapped);
      } else {
        setLoanRequests(mapped.filter(req => req.status === filterStatus));
      }
    } catch (err) {
      console.error('Error fetching loan requests:', err);
      setError('Failed to connect to server');
      setLoanRequests([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getScoreColor = (score) => {
    if (score >= 800) return 'text-green-600 bg-green-50';
    if (score >= 740) return 'text-blue-600 bg-blue-50';
    if (score >= 670) return 'text-yellow-600 bg-yellow-50';
    if (score >= 580) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'denied':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Denied
          </span>
        );
      default:
        return null;
    }
  };
  
  const getStatusMessage = (status) => {
    switch(status) {
      case 'pending':
        return {
          title: 'Application Under Review',
          message: 'Your loan application is being reviewed by our lending team. You will receive an update within 24-48 hours.',
          color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
        };
      case 'approved':
        return {
          title: 'Congratulations! Your Loan is Approved',
          message: 'Your loan application has been approved!',
          color: 'bg-green-50 border-green-200 text-green-800'
        };
      case 'denied':
        return {
          title: 'Application Not Approved',
          message: 'Unfortunately, your loan application was not approved at this time. You may reapply',
          color: 'bg-red-50 border-red-200 text-red-800'
        };
      default:
        return null;
    }
  };
  
  const navItems = [
    { icon: TrendingUp, label: 'Credit Score', href: '/borrower/credit-score' },
    { icon: DollarSign, label: 'Loan Dashboard', href: '/borrower/loans' },
    { icon: User, label: 'Profile', href: '/borrower/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout'}
  ];
  
  const stats = {
    total: allLoanRequests.length,
    pending: allLoanRequests.filter(r => r.status === 'pending').length,
    approved: allLoanRequests.filter(r => r.status === 'approved').length,
    denied: allLoanRequests.filter(r => r.status === 'denied').length,
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">CreditView</h1>
              </div>
            </div>
            
            <div className="hidden lg:flex space-x-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </a>
              ))}
            </div>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center px-3 py-2 text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center mb-4 justify-between"> 
            <h2 className="text-3xl font-bold text-slate-800 mb-2">My Loan Applications</h2>
            <a
              href="/borrower/loans/loan-request"
              className="inline-block px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              Apply for a Loan
            </a>
          </div>
          <p className="text-slate-600">Track the status of your loan requests</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600 mb-1">Total Applications</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
            <p className="text-sm text-yellow-700 mb-1">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
            <p className="text-sm text-green-700 mb-1">Approved</p>
            <p className="text-2xl font-bold text-green-800">{stats.approved}</p>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
            <p className="text-sm text-red-700 mb-1">Denied</p>
            <p className="text-2xl font-bold text-red-800">{stats.denied}</p>
          </div>
        </div>
        
        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Applications ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Approved ({stats.approved})
          </button>
          <button
            onClick={() => setFilterStatus('denied')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'denied'
                ? 'bg-red-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Denied ({stats.denied})
          </button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            <p className="mt-2 text-slate-600">Loading your loan applications...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Requests List */}
            <div className="space-y-4">
              {loanRequests.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">No Applications Found</h3>
                  <p className="text-slate-600 mb-4"></p>
                  <a
                    href="/borrower/loans/loan-request"
                    className="inline-block px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Apply for a Loan
                  </a>
                </div>
              ) : (
                loanRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
                      selectedRequest?.id === request.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{request.loanType} </h3>
                        <p className="text-xs text-slate-500">Applied on {request.requestDate}</p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Amount Requested</p>
                        <p className="text-sm font-semibold text-slate-700">${request.loanAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Loan Term</p>
                        <p className="text-sm font-semibold text-slate-700">{request.loanTerm} months</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Credit Score</p>
                        <p className={`text-sm font-bold px-2 py-1 rounded inline-block ${getScoreColor(request.creditScore)}`}>
                          {request.creditScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Application ID</p>
                        <p className="text-xs font-mono text-slate-700">{request.id.substring(0, 8)}...</p>
                      </div>
                    </div>
                    
                    <button className="w-full mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition-colors flex items-center justify-center">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {/* Request Details Panel */}
            <div className="lg:sticky lg:top-8 h-fit">
              {!selectedRequest ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Select an Application</h3>
                  <p className="text-slate-600">Click on a loan application to view details</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6">
                  {/* Status Alert */}
                  {selectedRequest.status && (
                    <div className={`rounded-lg p-4 mb-4 border ${getStatusMessage(selectedRequest.status).color}`}>
                      <h4 className="font-semibold mb-1">{getStatusMessage(selectedRequest.status).title}</h4>
                      <p className="text-sm">{getStatusMessage(selectedRequest.status).message}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">{selectedRequest.loanType} </h3>
                      <p className="text-sm text-slate-500">Application ID: {selectedRequest.id}</p>
                    </div>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  
                  <div className="border-t border-slate-200 pt-4 mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Loan Details</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Amount Requested:</span>
                        <span className="text-sm font-semibold text-slate-800">${selectedRequest.loanAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Loan Term:</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedRequest.loanTerm} months</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Application Date:</span>
                        <span className="text-sm font-semibold text-slate-800">{selectedRequest.requestDate}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-200 pt-4 mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Loan Purpose</h4>
                    <p className="text-sm text-slate-600">{selectedRequest.loanPurpose}</p>
                  </div>
                  
                  <div className="border-t border-slate-200 pt-4 mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Your Credit Score</h4>
                    <div className={`text-center py-4 rounded-lg ${getScoreColor(selectedRequest.creditScore)}`}>
                      <div className="text-4xl font-bold">{selectedRequest.creditScore}</div>
                      <div className="text-sm font-semibold mt-1">{selectedRequest.creditBand}</div>
                    </div>
                  </div>
                  
                  {Array.isArray(selectedRequest.reasons) && selectedRequest.reasons.length > 0 && (
                    <div className="border-t border-slate-200 pt-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Credit Factors Considered</h4>
                      <div className="space-y-2">
                        {selectedRequest.reasons.map((reason, index) => (
                          <div
                            key={index}
                            className="flex items-start bg-slate-50 rounded-lg p-3"
                          >
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">
                              {index + 1}
                            </div>
                            <p className="text-sm text-slate-700">{reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
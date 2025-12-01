'use client'

import React, { useState, useEffect } from 'react';
import { Eye, DollarSign, User, Menu, X, AlertCircle, CheckCircle, XCircle, Clock, TrendingUp, LogOut } from 'lucide-react';
import supabase from "../../../config/supabaseClient";

export default function BorrowerDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loanRequests, setLoanRequests] = useState([]);
  const [allLoanRequests, setAllLoanRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creditScore, setCreditScore] = useState(null);
  const [creditBand, setCreditBand] = useState(null);

  const userEmail = localStorage.getItem('userEmail'); // From auth/session

  // Fetch loans and credit score on mount
  useEffect(() => {
    fetchUserCreditScore();
    fetchLoanRequests();
  }, []);

  // Update filtered loans when filterStatus changes
  useEffect(() => {
    if (allLoanRequests.length > 0) {
      if (filterStatus === 'all') {
        setLoanRequests(allLoanRequests);
      } else {
        setLoanRequests(allLoanRequests.filter(req => req.status === filterStatus));
      }
    }
  }, [filterStatus, allLoanRequests]);

  const fetchUserCreditScore = async () => {
    try {
      const { data, error } = await supabase
        .from('Account')
        .select('credit_score')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) throw error;
      if (data?.credit_score) {
        setCreditScore(data.credit_score);
        setCreditBand(getCreditBand(data.credit_score));
      }
    } catch (err) {
      console.error('Error fetching credit score:', err);
    }
  };

  const fetchLoanRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('loan_requests')
        .select('*')
        .eq('borrower_email', userEmail)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Failed to fetch loan requests');
        console.error(error);
        return;
      }

      const mapped = (data || []).map(req => ({
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

      setAllLoanRequests(mapped);
      setLoanRequests(mapped);
    } catch (err) {
      console.error('Error fetching loan requests:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const getCreditBand = (score) => {
    if (score >= 800) return 'Excellent';
    if (score >= 740) return 'Very Good';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  };

  const getScoreColor = (score) => {
    if (score >= 800) return 'text-green-600 bg-green-50';
    if (score >= 740) return 'text-blue-600 bg-blue-50';
    if (score >= 670) return 'text-yellow-600 bg-yellow-50';
    if (score >= 580) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending
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

  const navItems = [
    { icon: TrendingUp, label: 'Credit Score', href: '/borrower/credit-score' },
    { icon: DollarSign, label: 'Loan Dashboard', href: '/borrower/loans' },
    { icon: User, label: 'Profile', href: '/borrower/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout' },
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
            <h1 className="text-2xl font-bold text-slate-800">CreditView</h1>

            <div className="hidden lg:flex space-x-1">
              {navItems.map(item => (
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
              {navItems.map(item => (
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
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-3xl font-bold text-slate-800">Loan Dashboard</h2>
            <a
              href="/borrower/loans/loan-request"
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
            >
              Apply for a Loan
            </a>
          </div>
          <p className="text-slate-600">Track your loan applications and credit score</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-slate-600 mb-1">Total Applications</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
            <p className="text-sm text-yellow-700 mb-1">Pending</p>
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

        {/* Credit Score Panel */}
        <div className="mb-6 max-w-md">
          <div className={`bg-white shadow-md rounded-lg p-6 ${creditScore ? '' : 'opacity-50'}`}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Your Credit Score</h3>
            {creditScore ? (
              <div className={`text-center py-4 rounded-lg ${getScoreColor(creditScore)}`}>
                <div className="text-4xl font-bold">{creditScore}</div>
                <div className="text-sm font-semibold mt-1">{creditBand}</div>
              </div>
            ) : (
              <p className="text-slate-600">No credit score found. Please complete a credit check.</p>
            )}
          </div>
        </div>

        {/* Loan Requests List */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            <p className="mt-2 text-slate-600">Loading your loan applications...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {loanRequests.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">No Applications Found</h3>
                  <a
                    href="/borrower/loans/loan-request"
                    className="inline-block px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Apply for a Loan
                  </a>
                </div>
              ) : (
                loanRequests.map(request => (
                  <div
                    key={request.id}
                    className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
                      selectedRequest?.id === request.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{request.loanType}</h3>
                        <p className="text-xs text-slate-500">Applied on {request.requestDate}</p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Amount</p>
                        <p className="text-sm font-semibold text-slate-700">${request.loanAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Term</p>
                        <p className="text-sm font-semibold text-slate-700">{request.loanTerm} months</p>
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

            {/* Details Panel */}
            {selectedRequest && (
              <div className="lg:sticky lg:top-8 h-fit bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-2">{selectedRequest.loanType}</h3>
                <p className="text-sm text-slate-500 mb-3">Application ID: {selectedRequest.id}</p>
                <p className="text-sm text-slate-700 mb-1">Amount: ${selectedRequest.loanAmount.toLocaleString()}</p>
                <p className="text-sm text-slate-700 mb-1">Term: {selectedRequest.loanTerm} months</p>
                <p className="text-sm text-slate-700 mb-1">Purpose: {selectedRequest.loanPurpose}</p>
                {getStatusBadge(selectedRequest.status)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

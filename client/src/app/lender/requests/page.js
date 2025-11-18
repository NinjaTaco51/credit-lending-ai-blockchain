'use client'

import React, { useState, useEffect } from 'react';
import { CreditCard, History, DollarSign, User, FileText, BookOpen, HelpCircle, Menu, X, AlertCircle, CheckCircle, Home, Car, GraduationCap, Briefcase, LogOut } from 'lucide-react';

export default function LenderDashboard() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending'); // 'all', 'pending', 'approved', 'denied'
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Mock loan requests data - in real app, this would come from your backend
  const [loanRequests, setLoanRequests] = useState([
    {
      id: 'LR-001',
      borrowerName: 'John Doe',
      email: 'john.doe@example.com',
      loanType: 'Personal Loan',
      loanAmount: 25000,
      loanTerm: 36,
      loanPurpose: 'Debt consolidation and home improvements',
      creditScore: 720,
      creditBand: 'Good',
      reasons: [
        'Strong payment history with consistent on-time payments',
        'Moderate credit utilization at 35%',
        'Diverse credit mix including mortgage and credit cards'
      ],
      requestDate: '2024-01-15',
      status: 'pending'
    },
    {
      id: 'LR-002',
      borrowerName: 'Jane Smith',
      email: 'jane.smith@example.com',
      loanType: 'Auto Loan',
      loanAmount: 35000,
      loanTerm: 60,
      loanPurpose: 'Purchase a new vehicle for work commute',
      creditScore: 780,
      creditBand: 'Very Good',
      reasons: [
        'Excellent payment history with no missed payments',
        'Low credit utilization at 18%',
        'Long credit history of 12+ years'
      ],
      requestDate: '2024-01-16',
      status: 'pending'
    },
    {
      id: 'LR-003',
      borrowerName: 'Michael Johnson',
      email: 'michael.j@example.com',
      loanType: 'Home Loan',
      loanAmount: 250000,
      loanTerm: 360,
      loanPurpose: 'First-time home purchase in suburban area',
      creditScore: 650,
      creditBand: 'Fair',
      reasons: [
        'Limited credit history of only 3 years',
        'High credit utilization at 65%',
        'Recent late payment in the last 6 months'
      ],
      requestDate: '2024-01-14',
      status: 'pending'
    },
    {
      id: 'LR-004',
      borrowerName: 'Sarah Williams',
      email: 'sarah.w@example.com',
      loanType: 'Business Loan',
      loanAmount: 100000,
      loanTerm: 120,
      loanPurpose: 'Expanding existing small business operations',
      creditScore: 815,
      creditBand: 'Excellent',
      reasons: [
        'Perfect payment history with no delinquencies',
        'Very low credit utilization at 12%',
        'Strong financial profile with multiple accounts'
      ],
      requestDate: '2024-01-13',
      status: 'approved'
    },
    {
      id: 'LR-005',
      borrowerName: 'Robert Brown',
      email: 'robert.b@example.com',
      loanType: 'Personal Loan',
      loanAmount: 15000,
      loanTerm: 24,
      loanPurpose: 'Medical expenses and emergency costs',
      creditScore: 560,
      creditBand: 'Poor',
      reasons: [
        'Multiple missed payments in the past year',
        'Very high credit utilization at 85%',
        'Recent bankruptcy filing'
      ],
      requestDate: '2024-01-12',
      status: 'denied'
    }
  ]);
  
  const handleApprove = (requestId) => {
    setLoanRequests(prev => 
      prev.map(req => 
        req.id === requestId ? { ...req, status: 'approved' } : req
      )
    );
    alert(`Loan request ${requestId} has been approved!`);
    setSelectedRequest(null);
  };
  
  const handleDeny = (requestId) => {
    setLoanRequests(prev => 
      prev.map(req => 
        req.id === requestId ? { ...req, status: 'denied' } : req
      )
    );
    alert(`Loan request ${requestId} has been denied.`);
    setSelectedRequest(null);
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
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending Review</span>;
      case 'approved':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
      case 'denied':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Denied</span>;
      default:
        return null;
    }
  };
  
  const filteredRequests = loanRequests.filter(req => 
    filterStatus === 'all' ? true : req.status === filterStatus
  );
  
  const navItems = [
    { icon: User, label: 'Profile', href: '/lender/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout'}
  ];
  
  if (!mounted) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">CreditView Lender</h1>
              </div>
            </div>
            
            {/* Desktop Navigation */}
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
            
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
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
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Loan Requests</h2>
          <p className="text-slate-600">Review and manage borrower loan applications</p>
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
            All Requests ({loanRequests.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending ({loanRequests.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'approved'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Approved ({loanRequests.filter(r => r.status === 'approved').length})
          </button>
          <button
            onClick={() => setFilterStatus('denied')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'denied'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Denied ({loanRequests.filter(r => r.status === 'denied').length})
          </button>
        </div>
        
        {/* Requests Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">No loan requests found for this filter.</p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedRequest?.id === request.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{request.borrowerName}</h3>
                      <p className="text-sm text-slate-500">{request.id}</p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-slate-500">Loan Type</p>
                      <p className="text-sm font-semibold text-slate-700">{request.loanType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Amount</p>
                      <p className="text-sm font-semibold text-slate-700">${request.loanAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Credit Score</p>
                      <p className={`text-sm font-bold px-2 py-1 rounded inline-block ${getScoreColor(request.creditScore)}`}>
                        {request.creditScore} - {request.creditBand}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Request Date</p>
                      <p className="text-sm font-semibold text-slate-700">{request.requestDate}</p>
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
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Request Selected</h3>
                <p className="text-slate-600">Click on a loan request to view details and take action</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">{selectedRequest.borrowerName}</h3>
                    <p className="text-sm text-slate-500">{selectedRequest.email}</p>
                  </div>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                
                <div className="border-t border-slate-200 pt-4 mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Loan Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Request ID:</span>
                      <span className="text-sm font-semibold text-slate-800">{selectedRequest.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Loan Type:</span>
                      <span className="text-sm font-semibold text-slate-800">{selectedRequest.loanType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Amount:</span>
                      <span className="text-sm font-semibold text-slate-800">${selectedRequest.loanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Term:</span>
                      <span className="text-sm font-semibold text-slate-800">{selectedRequest.loanTerm} months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Request Date:</span>
                      <span className="text-sm font-semibold text-slate-800">{selectedRequest.requestDate}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-200 pt-4 mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Loan Purpose</h4>
                  <p className="text-sm text-slate-600">{selectedRequest.loanPurpose}</p>
                </div>
                
                <div className="border-t border-slate-200 pt-4 mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Credit Score</h4>
                  <div className={`text-center py-4 rounded-lg ${getScoreColor(selectedRequest.creditScore)}`}>
                    <div className="text-4xl font-bold">{selectedRequest.creditScore}</div>
                    <div className="text-sm font-semibold mt-1">{selectedRequest.creditBand}</div>
                  </div>
                </div>
                
                <div className="border-t border-slate-200 pt-4 mb-6">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Key Credit Factors</h4>
                  <div className="space-y-2">
                    {selectedRequest.reasons.map((reason, index) => (
                      <div key={index} className="flex items-start bg-slate-50 rounded-lg p-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-sm text-slate-700">{reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Action Buttons */}
                {selectedRequest.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg flex items-center justify-center"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(selectedRequest.id)}
                      className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg flex items-center justify-center"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Deny
                    </button>
                  </div>
                )}
                
                {selectedRequest.status === 'approved' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                    <span className="text-sm text-green-800 font-medium">This loan request has been approved</span>
                  </div>
                )}
                
                {selectedRequest.status === 'denied' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                    <XCircle className="w-5 h-5 text-red-600 mr-3" />
                    <span className="text-sm text-red-800 font-medium">This loan request has been denied</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
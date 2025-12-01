'use client'

import React, { useState, useEffect } from 'react';
import { DollarSign, User, Menu, X, CheckCircle, Clock, XCircle, AlertCircle, LogOut } from 'lucide-react';
import supabase from "../../../config/supabaseClient";

export default function LenderDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loanRequests, setLoanRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const navItems = [
    { icon: DollarSign, label: 'Loan Dashboard', href: '/lender/dashboard' },
    { icon: User, label: 'Profile', href: '/lender/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout' },
  ];

  // Fetch all loans
  useEffect(() => {
    fetchLoanRequests();
  }, []);

  const fetchLoanRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('loan_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        payments: req.payments || [], // Array of payment objects {date, amount, paid}
        createdAt: req.created_at,
      }));

      setLoanRequests(mapped);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch loan requests');
    } finally {
      setIsLoading(false);
    }
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

  const getPaymentBadge = (paid) => {
    if (paid) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          Paid
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          Due
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-slate-800">CreditView Lender</h1>

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

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Loan Requests & Payment Status</h2>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            <p className="mt-2 text-slate-600">Loading loan requests...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loanRequests.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Loan Requests Found</h3>
              </div>
            ) : (
              loanRequests.map(req => (
                <div
                  key={req.id}
                  className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedRequest?.id === req.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedRequest(req)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{req.borrowerName}</h3>
                      <p className="text-xs text-slate-500">Loan: {req.loanType}</p>
                      <p className="text-xs text-slate-500">Applied: {req.requestDate}</p>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <p className="text-xs text-slate-500">Amount</p>
                      <p className="text-sm font-semibold text-slate-700">${req.loanAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Term</p>
                      <p className="text-sm font-semibold text-slate-700">{req.loanTerm} months</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Payments</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {req.payments.filter(p => p.paid).length}/{req.payments.length} paid
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Details Panel */}
            {selectedRequest && (
              <div className="lg:sticky lg:top-8 h-fit bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-2">{selectedRequest.borrowerName}</h3>
                <p className="text-sm text-slate-500 mb-3">Loan ID: {selectedRequest.id}</p>
                <p className="text-sm text-slate-700 mb-1">Loan Type: {selectedRequest.loanType}</p>
                <p className="text-sm text-slate-700 mb-1">Amount: ${selectedRequest.loanAmount.toLocaleString()}</p>
                <p className="text-sm text-slate-700 mb-1">Term: {selectedRequest.loanTerm} months</p>
                <p className="text-sm text-slate-700 mb-1">Purpose: {selectedRequest.loanPurpose}</p>
                {getStatusBadge(selectedRequest.status)}

                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Payment Schedule</h4>
                  <ul className="space-y-1">
                    {selectedRequest.payments.length === 0 ? (
                      <li className="text-slate-500 text-sm">No payments scheduled yet.</li>
                    ) : (
                      selectedRequest.payments.map((p, idx) => (
                        <li key={idx} className="flex justify-between items-center text-sm">
                          <span>{p.date}</span>
                          <span>${p.amount.toLocaleString()}</span>
                          {getPaymentBadge(p.paid)}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

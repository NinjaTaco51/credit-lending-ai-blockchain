// ============================================
// LENDER PAYMENT STATUS DASHBOARD
// File: app/lender/payments/page.jsx
// ============================================

'use client'

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, DollarSign, User, Menu, X, LogOut, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import supabase from '../../../config/supabaseClient';

export default function LenderPaymentStatus() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all, current, overdue, completed
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalAmount: 0,
    activePayments: 0,
    overduePayments: 0,
    totalCollected: 0
  });

  useEffect(() => {
    fetchPaymentStatus();
  }, []);

  const fetchPaymentStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all approved loans
      const { data: loansData, error: loansError } = await supabase
        .from('loan_requests')
        .select('*')
        .eq('status', 'approved')
        .order('request_date', { ascending: false });

      if (loansError) throw loansError;

      // Get all payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('*');

      if (paymentsError) throw paymentsError;

      // Enrich loans with payment data
      const enrichedLoans = (loansData || []).map(loan => {
        const loanPayments = (paymentsData || []).filter(p => p.loan_id === loan.request_id);
        const paidPayments = loanPayments.filter(p => p.status === 'paid');
        const overduePayments = loanPayments.filter(p => p.status === 'overdue');
        const nextPayment = loanPayments.find(p => p.status === 'pending');
        const overduePayment = loanPayments.find(p => p.status === 'overdue');
        const totalPaid = paidPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        let paymentStatus = 'current';
        if (overduePayments.length > 0) {
          paymentStatus = 'overdue';
        } else if (loanPayments.length > 0 && paidPayments.length === loanPayments.length) {
          paymentStatus = 'completed';
        }

        return {
          ...loan,
          payments: loanPayments,
          paymentsMade: paidPayments.length,
          totalPayments: loanPayments.length,
          overdueCount: overduePayments.length,
          totalPaid,
          remainingBalance: parseFloat(loan.loan_amount || 0) - totalPaid,
          nextPayment,
          overduePayment,
          paymentStatus
        };
      });

      setLoans(enrichedLoans);

      // Calculate stats
      const totalCollected = enrichedLoans.reduce((sum, l) => sum + l.totalPaid, 0);
      const activePayments = enrichedLoans.filter(l => l.nextPayment).length;
      const overduePayments = enrichedLoans.filter(l => l.overduePayment).length;

      setStats({
        totalLoans: enrichedLoans.length,
        totalAmount: enrichedLoans.reduce((sum, l) => sum + parseFloat(l.loan_amount || 0), 0),
        activePayments,
        overduePayments,
        totalCollected
      });

    } catch (err) {
      console.error(err);
      setError('Failed to load payment status');
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { icon: DollarSign, label: 'Loan Requests', href: '/lender/requests' },
    { icon: TrendingUp, label: 'Payment Status', href: '/lender/payments' },
    { icon: User, label: 'Profile', href: '/lender/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout' },
  ];

  const filteredLoans = loans.filter(loan => {
    if (filter === 'all') return true;
    return loan.paymentStatus === filter;
  });

  const filterButtons = [
    { key: 'all', label: 'All Loans', count: loans.length },
    { key: 'current', label: 'Current', count: loans.filter(l => l.paymentStatus === 'current').length },
    { key: 'overdue', label: 'Overdue', count: loans.filter(l => l.paymentStatus === 'overdue').length },
    { key: 'completed', label: 'Completed', count: loans.filter(l => l.paymentStatus === 'completed').length },
  ];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-slate-800">CreditView</h1>
            <div className="hidden lg:flex space-x-4">
              {navItems.map(item => (
                <a key={item.label} href={item.href} className="flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md">
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </a>
              ))}
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              {mobileMenuOpen ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white">
          <div className="px-2 py-3 space-y-1">
            {navItems.map(item => (
              <a key={item.label} href={item.href} className="flex items-center px-3 py-2 text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md">
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Payment Status</h1>
          <p className="text-slate-600 mt-1">Monitor borrower payment activity and collection status</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Loans</p>
                <p className="text-2xl font-bold text-slate-800">{stats.totalLoans}</p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Loaned</p>
                <p className="text-2xl font-bold text-slate-800">${stats.totalAmount.toLocaleString()}</p>
              </div>
              <DollarSign className="w-10 h-10 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Collected</p>
                <p className="text-2xl font-bold text-green-800">${stats.totalCollected.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Payments</p>
                <p className="text-2xl font-bold text-slate-800">{stats.activePayments}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Overdue</p>
                <p className="text-2xl font-bold text-red-800">{stats.overduePayments}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {filterButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === btn.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>

        {/* Loan List */}
        {isLoading ? (
          <p className="text-center text-slate-600">Loading payment status...</p>
        ) : error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-slate-600">No loans found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredLoans.map(loan => (
              <div key={loan.request_id} className="bg-white rounded-2xl shadow overflow-hidden">
                {/* Loan Header */}
                <div className="p-6 border-b border-slate-200">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">{loan.borrower_name}</h2>
                      <p className="text-sm text-slate-500">{loan.request_id}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                        Approved
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        loan.paymentStatus === 'overdue' ? 'bg-red-100 text-red-700' :
                        loan.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {loan.paymentStatus === 'overdue' ? 'Overdue' :
                         loan.paymentStatus === 'completed' ? 'Completed' :
                         'Current'}
                      </span>
                    </div>
                  </div>

                  {/* Loan Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Loan Amount</p>
                      <p className="font-semibold text-slate-800">${parseFloat(loan.loan_amount || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Loan Type</p>
                      <p className="font-semibold text-slate-800">{loan.loan_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Total Paid</p>
                      <p className="font-semibold text-green-800">${loan.totalPaid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Remaining</p>
                      <p className="font-semibold text-orange-800">${loan.remainingBalance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Payments</p>
                      <p className="font-semibold text-slate-800">
                        {loan.paymentsMade}/{loan.totalPayments}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Credit Score</p>
                      <p className="font-semibold text-slate-800">{loan.credit_score} - {loan.credit_band}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Monthly Payment</p>
                      <p className="font-semibold text-slate-800">${parseFloat(loan.monthly_payment || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Loan Term</p>
                      <p className="font-semibold text-slate-800">{loan.loan_term_months} months</p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {loan.totalPayments > 0 && (
                  <div className="px-6 py-4 bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-slate-600 font-medium">Payment Progress</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {Math.round((loan.paymentsMade / loan.totalPayments) * 100)}%
                      </p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          loan.paymentStatus === 'overdue' ? 'bg-red-500' :
                          loan.paymentStatus === 'completed' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${(loan.paymentsMade / loan.totalPayments) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Overdue Alert */}
                {loan.overduePayment && (
                  <div className="bg-red-50 border-t border-red-200 p-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-red-800 mb-1">Overdue Payment Alert</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-red-700">Amount Overdue</p>
                            <p className="font-semibold text-red-900">${parseFloat(loan.overduePayment.amount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-red-700">Was Due</p>
                            <p className="font-semibold text-red-900">{formatDate(loan.overduePayment.due_date)}</p>
                          </div>
                          {loan.overdueCount > 1 && (
                            <div>
                              <p className="text-sm text-red-700">Total Overdue</p>
                              <p className="font-semibold text-red-900">{loan.overdueCount} payments</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Next Payment Info */}
                {loan.nextPayment && !loan.overduePayment && (
                  <div className="bg-blue-50 border-t border-blue-200 p-6">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-blue-800 mb-1">Next Payment Expected</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-blue-700">Amount</p>
                            <p className="font-semibold text-blue-900">${parseFloat(loan.nextPayment.amount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-blue-700">Due Date</p>
                            <p className="font-semibold text-blue-900">{formatDate(loan.nextPayment.due_date)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed Status */}
                {loan.paymentStatus === 'completed' && (
                  <div className="bg-green-50 border-t border-green-200 p-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <p className="font-semibold text-green-800">Loan Fully Paid - All payments completed!</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
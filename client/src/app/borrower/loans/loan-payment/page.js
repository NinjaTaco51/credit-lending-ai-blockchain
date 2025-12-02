'use client'

import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Clock, CheckCircle, AlertCircle, Menu, X, LogOut, User, CreditCard, BanknoteArrowDown } from 'lucide-react';
import supabase from "../../../../config/supabaseClient"

export default function BorrowerPaymentDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBorrowerData();
  }, []);

  const fetchBorrowerData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get approved loans (in production, filter by current user)
      const { data: loansData, error: loansError } = await supabase
        .from('loan_requests')
        .select('*')
        .eq('status', 'approved')
        .order('request_date', { ascending: false });

      if (loansError) throw loansError;

      // Get all payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('loan_payments')
        .select('*')
        .order('due_date', { ascending: true });

      if (paymentsError) throw paymentsError;

      // Enrich loans with payment data
      const enrichedLoans = (loansData || []).map(loan => {
        const loanPayments = (paymentsData || []).filter(p => p.loan_id === loan.request_id);
        const paidPayments = loanPayments.filter(p => p.status === 'paid');
        const nextPayment = loanPayments.find(p => p.status === 'pending' || p.status === 'overdue');
        
        return {
          ...loan,
          payments: loanPayments,
          paidCount: paidPayments.length,
          totalCount: loanPayments.length,
          totalPaid: paidPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
          nextPayment
        };
      });

      setLoans(enrichedLoans);
    } catch (err) {
      console.error(err);
      setError('Failed to load payment data');
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { icon: CreditCard,label: 'Credit Score', href: '/borrower/credit-score'},
    { icon: BanknoteArrowDown, label: 'Loan Dashboard', href: '/borrower/loans' },
    { icon: DollarSign, label: 'Loan Payments', href: '/borrower/loans/loan-payment' },
    { icon: User, label: 'Profile', href: '/borrower/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout'}
  ];

  const handleMakePayment = async (payment) => {
    alert(`Payment feature coming soon!\n\nPayment ID: ${payment.payment_id}\nAmount: $${payment.amount}\nDue: ${payment.due_date}`);
    // TODO: Integrate with blockchain payment
  };

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">My Loan Payments</h1>
          <p className="text-slate-600 mt-1">Track and manage your loan payments</p>
        </div>

        {isLoading ? (
          <p className="text-center text-slate-600">Loading payment information...</p>
        ) : error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : loans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-slate-600">You don't have any active loans.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {loans.map(loan => {
              const progress = loan.totalCount > 0 ? (loan.paidCount / loan.totalCount) * 100 : 0;
              const remainingBalance = parseFloat(loan.loan_amount || 0) - loan.totalPaid;

              return (
                <div key={loan.request_id} className="bg-white rounded-2xl shadow overflow-hidden">
                  {/* Loan Header */}
                  <div className="p-6 border-b border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-800">{loan.loan_type}</h2>
                        <p className="text-sm text-slate-500">{loan.request_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">Original Amount</p>
                        <p className="text-2xl font-bold text-slate-800">${parseFloat(loan.loan_amount || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 mb-1">Total Paid</p>
                        <p className="text-lg font-bold text-blue-900">${loan.totalPaid.toLocaleString()}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-600 mb-1">Remaining</p>
                        <p className="text-lg font-bold text-orange-900">${remainingBalance.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">Monthly</p>
                        <p className="text-lg font-bold text-green-900">${parseFloat(loan.monthly_payment || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {loan.totalCount > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm text-slate-600">Payment Progress</p>
                          <p className="text-sm font-medium text-slate-800">
                            {loan.paidCount} of {loan.totalCount} payments ({Math.round(progress)}%)
                          </p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                          <div 
                            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Next Payment Due */}
                  {loan.nextPayment && (
                    <div className={`p-6 border-b border-slate-200 ${loan.nextPayment.status === 'overdue' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {loan.nextPayment.status === 'overdue' ? (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-yellow-600" />
                            )}
                            <h3 className={`font-semibold ${loan.nextPayment.status === 'overdue' ? 'text-red-800' : 'text-yellow-800'}`}>
                              {loan.nextPayment.status === 'overdue' ? 'Payment Overdue!' : 'Upcoming Payment'}
                            </h3>
                          </div>
                          <div className="flex gap-6">
                            <div>
                              <p className="text-sm text-slate-600">Amount Due</p>
                              <p className="text-lg font-bold text-slate-800">${parseFloat(loan.nextPayment.amount || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-600">Due Date</p>
                              <p className="text-lg font-bold text-slate-800">{formatDate(loan.nextPayment.due_date)}</p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleMakePayment(loan.nextPayment)}
                          className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                            loan.nextPayment.status === 'overdue' 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          Pay Now
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payment History */}
                  <div className="p-6">
                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Payment History
                    </h3>
                    {loan.payments.length === 0 ? (
                      <p className="text-slate-600 text-sm">No payment schedule available yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {loan.payments.map((payment) => (
                          <div key={payment.payment_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-4">
                              {payment.status === 'paid' ? (
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                              ) : payment.status === 'overdue' ? (
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                              ) : (
                                <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                              )}
                              <div>
                                <p className="font-medium text-slate-800">
                                  ${parseFloat(payment.amount || 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Due: {formatDate(payment.due_date)}
                                  {payment.paid_date && ` • Paid: ${formatDate(payment.paid_date)}`}
                                </p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              payment.status === 'paid' ? 'bg-green-100 text-green-700' :
                              payment.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {payment.status === 'paid' ? 'Paid' : 
                               payment.status === 'overdue' ? 'Overdue' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
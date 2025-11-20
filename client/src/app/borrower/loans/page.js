'use client'

import React, { useState, useEffect } from 'react';
import { CreditCard, History, DollarSign, User, FileText, BookOpen, HelpCircle, Menu, X, AlertCircle, CheckCircle, Home, Car, GraduationCap, Briefcase, LogOut } from 'lucide-react';

export default function LoanRequestPage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Simulating whether user has completed credit check
  // In a real app, this would come from your backend/database
  const [hasCreditScore, setHasCreditScore] = useState(false);
  const [userCreditScore] = useState(720); // Mock credit score
  
  const [loanRequest, setLoanRequest] = useState({
    loanType: '',
    loanAmount: '',
    loanPurpose: '',
    loanTerm: ''
  });
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoanRequest({
      ...loanRequest,
      [name]: value
    });
  };
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('Loan request data:', loanRequest);
      alert('Loan request submitted successfully! You will receive a response within 24-48 hours.');
      setIsLoading(false);
      
      // Reset form
      setLoanRequest({
        loanType: '',
        loanAmount: '',
        loanPurpose: '',
        loanTerm: ''
      });
    }, 1500);
  };
  
  const navItems = [
    { icon: CreditCard,label: 'Dashboard', href: '/borrower/dashboard'},
    { icon: DollarSign, label: 'Loan Portal', href: '/borrower/loans' },
    { icon: User, label: 'Profile', href: '/borrower/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout'}
  ];
  
  const loanTypes = [
    { value: 'personal', label: 'Personal Loan', icon: User },
    { value: 'home', label: 'Home/Mortgage Loan', icon: Home },
    { value: 'auto', label: 'Auto Loan', icon: Car },
    { value: 'student', label: 'Student Loan', icon: GraduationCap },
    { value: 'business', label: 'Business Loan', icon: Briefcase }
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
                <h1 className="text-2xl font-bold text-slate-800">CreditView</h1>
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
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Request a Loan</h2>
          <p className="text-slate-600">Complete the form below to submit your loan application</p>
        </div>
        
        {/* Credit Check Warning/Success Banner */}
        {!hasCreditScore ? (
          <div className="max-w-3xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Credit Check Required</h3>
                <p className="text-sm text-red-700 mb-3">
                  You must complete a credit check on the dashboard before you can request a loan. This helps us provide you with accurate loan options and terms.
                </p>
                <a
                  href="/borrower/dashboard"
                  className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-800 mb-1">Credit Check Complete</h3>
                <p className="text-sm text-green-700">
                  Your credit score: <span className="font-bold">{userCreditScore}</span> - You're eligible to apply for loans
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Loan Request Form */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className={`space-y-6 ${!hasCreditScore ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Loan Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Loan Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {loanTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setLoanRequest({ ...loanRequest, loanType: type.value })}
                      className={`flex items-center p-4 border-2 rounded-lg transition-all ${
                        loanRequest.loanType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <type.icon className={`w-6 h-6 mr-3 ${
                        loanRequest.loanType === type.value ? 'text-blue-600' : 'text-slate-400'
                      }`} />
                      <span className={`font-medium ${
                        loanRequest.loanType === type.value ? 'text-blue-900' : 'text-slate-700'
                      }`}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Loan Amount and Term */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Loan Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      name="loanAmount"
                      value={loanRequest.loanAmount}
                      onChange={handleInputChange}
                      className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="50000"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Loan Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="loanTerm"
                    value={loanRequest.loanTerm}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select term</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                    <option value="48">48 months</option>
                    <option value="60">60 months</option>
                    <option value="120">120 months (10 years)</option>
                    <option value="180">180 months (15 years)</option>
                    <option value="240">240 months (20 years)</option>
                    <option value="360">360 months (30 years)</option>
                  </select>
                </div>
              </div>
              
              {/* Loan Purpose */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Loan Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="loanPurpose"
                  value={loanRequest.loanPurpose}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what you'll use the loan for..."
                  rows="3"
                />
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || !hasCreditScore}
                className="w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting Request...' : 'Submit Loan Request'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Information Box */}
        <div className="max-w-3xl mx-auto mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              What Happens Next?
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="font-bold mr-2">1.</span>
                <span>Your application will be reviewed by our lending team within 24-48 hours</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">2.</span>
                <span>We may contact you for additional documentation or information</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">3.</span>
                <span>You'll receive loan offers from multiple lenders with terms and rates</span>
              </li>
              <li className="flex items-start">
                <span className="font-bold mr-2">4.</span>
                <span>Review and accept the offer that works best for you</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
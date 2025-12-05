'use client'

import React, { useState } from 'react';
import {
  DollarSign,
  User,
  Mail,
  Phone,
  HelpCircle,
  Shield,
  AlertCircle,
  CheckCircle,
  Menu,
  X,
  LogOut,
  FileText,
} from 'lucide-react';
import supabase from "../../../config/supabaseClient";

export default function LenderApplicationPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    experience: '',
    typicalLoanSize: '',
    notes: '',
  });

  const navItems = [
    { icon: DollarSign, label: 'Borrower Credit', href: '/borrower/credit-score' },
    { icon: User, label: 'Borrower Login', href: '/borrower/login' },
    { icon: User, label: 'Lender Login', href: '/lender/login' },
    { icon: LogOut, label: 'Home', href: '/' },
  ];

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormError('');
    setFormSuccess('');
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const { name, email, phone, company, experience, typicalLoanSize, notes } = formData;

    // Basic validations
    if (!name || !email) {
      setFormError('Please fill in at least your name and email.');
      return;
    }

    if (!isValidEmail(email)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert into a dedicated lender applications table
      // Make sure this table exists in Supabase:
      // lender_applications: id, name, email, phone, company, experience, typical_loan_size, notes, status, created_at
      const { data, error } = await supabase
        .from('lender_applications')
        .insert({
          name,
          email,
          phone,
          company,
          experience,
          typical_loan_size: typicalLoanSize,
          notes,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting lender application:', error);
        setFormError(error.message || 'Failed to submit application. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // OPTIONAL: call an Edge Function / webhook to notify admins via email
      // await supabase.functions.invoke('notify-admin-lender-application', {
      //   body: { applicationId: data.id }
      // });

      setFormSuccess(
        'Application submitted! Our team will review your information and contact you by email with next steps.'
      );
      setFormError('');
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        experience: '',
        typicalLoanSize: '',
        notes: '',
      });
    } catch (err) {
      console.error('Unexpected error submitting lender application:', err);
      setFormError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Apply to Become a Lender</h2>
          <p className="text-slate-600">
            Submit your information and our team will follow up to create your lender account.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Info Banner */}
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
            <Shield className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900 mb-1">Manual Review</h3>
              <p className="text-sm text-amber-800">
                Your application will be reviewed by our admin team. If approved, we will create
                your account and email you a secure link to set your password.
              </p>
            </div>
          </div>

          {/* Error / Success */}
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">{formError}</p>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-green-700">{formSuccess}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="Jane Smith"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lender Details */}
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Lender Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lending Experience
                  </label>
                  <textarea
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    rows="3"
                    placeholder="Tell us briefly about your lending or investing experience..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Typical Loan Size / Range
                  </label>
                  <textarea
                    name="typicalLoanSize"
                    value={formData.typicalLoanSize}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    rows="3"
                    placeholder="e.g. $5,000 - $25,000 per loan"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  rows="3"
                  placeholder="Anything else you’d like us to know?"
                />
              </div>
            </div>

            {/* Help Box */}
            <div className="pt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    What happens after I submit?
                  </h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Our admins review your application.</li>
                    <li>• If approved, we create your lender account.</li>
                    <li>• You receive an email with a secure link to set your password.</li>
                    <li>• Then you can log in and start reviewing borrower requests.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-slate-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting Application...' : 'Submit Lender Application'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
'use client'

import React, { useState, useEffect } from 'react';
import { CreditCard, History, DollarSign, User, FileText, BookOpen, HelpCircle, Menu, X, Save, Mail, Phone, Calendar, Lock, Eye, EyeOff } from 'lucide-react';

export default function EditProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Mock user data - in real app, this would come from your backend
  const [profileData, setProfileData] = useState({
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    dob: '1990-05-15'
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value
    });
  };
  
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };
  
  const handleSave = async () => {
    // Validate password fields if any are filled
    if (passwordData.currentPassword || passwordData.newPassword || passwordData.confirmPassword) {
      if (!passwordData.currentPassword) {
        alert('Please enter your current password');
        return;
      }
      if (!passwordData.newPassword) {
        alert('Please enter a new password');
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert('New passwords do not match!');
        return;
      }
      if (passwordData.newPassword.length < 8) {
        alert('New password must be at least 8 characters long');
        return;
      }
    }
    
    setIsLoading(true);
    setSuccessMessage('');
    
    // Simulate API call
    setTimeout(() => {
      console.log('Updated profile data:', profileData);
      if (passwordData.currentPassword) {
        console.log('Password updated');
      }
      setSuccessMessage('Profile updated successfully!');
      setIsLoading(false);
      
      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    }, 1500);
  };
  
  const navItems = [
    { icon: CreditCard, label: 'Dashboard', href: '/borrower/dashboard' },
    { icon: DollarSign, label: 'Loan Portal', href: '/borrower/loans' },
    { icon: User, label: 'Profile', href: '/borrower/profile' }
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Edit Profile</h2>
          <p className="text-slate-600">Update your personal information and preferences</p>
        </div>
        
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <Save className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-sm text-green-800 font-medium">{successMessage}</span>
          </div>
        )}
        
        {/* Profile Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="space-y-6">
            {/* Personal Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    placeholder="John Doe"
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
                
                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                
                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      name="dob"
                      value={profileData.dob}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Change Password Section */}
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Change Password
              </h3>
              
              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Must be at least 8 characters with uppercase, lowercase, and numbers
                  </p>
                </div>
                
                {/* Confirm New Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Button */}
            <div className="pt-6 border-t border-slate-200">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Save className="w-5 h-5 mr-2" />
                {isLoading ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
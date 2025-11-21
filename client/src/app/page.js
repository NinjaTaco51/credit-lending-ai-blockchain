'use client'

import React, { useState, useEffect } from 'react';
import { CreditCard, Eye, EyeOff, Mail, Lock, User, Phone, Calendar, Building2, UserCircle } from 'lucide-react';
import supabase from "../config/supabaseClient"

export default function AuthPages() {
  const [mounted, setMounted] = useState(false);
  const [userType, setUserType] = useState('borrower'); // 'borrower' or 'lender'
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  
  const [signupData, setSignupData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
    companyName: '', // For lenders only
    businessId: '' // For lenders only
  });
  
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData({
      ...loginData,
      [name]: value
    });
  };
  
  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData({
      ...signupData,
      [name]: value
    });
  };
  
  const handleLoginSubmit = async () => {

    setIsLoading(true);

    const { data, error } = await supabase
      .from("Account")
      .select("password_hash")
      .eq("email", loginData.email)
  
      if (error) {
        console.log(error)
      }
    

    if (data[0].password_hash == loginData.password) {
      if (userType == "lender") {
        setIsLoading(false);
        window.location.href = "/lender/requests"
      } else {
        setIsLoading(false);
        window.location.href = "/borrower/dashboard"
      }
    } else {
      alert("incorrect password")
      setIsLoading(false);
    }

  };
  
  const handleSignupSubmit = async () => {
    if (signupData.password !== signupData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    setIsLoading(true);

    const passwordHash = signupData.password

    const { data, error } = await supabase
      .from("Account")
      .insert([
        {
          email: signupData.email,
          name: signupData.fullName,
          phone: signupData.phone,
          dob: signupData.dob,
          password_hash: passwordHash,
          type: userType
        }
      ])
  
      if (error) {
        console.log(error)
      }

    setIsLoading(false);      
    setAuthMode('login');

  };
  
  const switchUserType = (type) => {
    setUserType(type);
    setAuthMode('login');
    setLoginData({ email: '', password: '' });
    setSignupData({
      fullName: '',
      email: '',
      phone: '',
      dob: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      businessId: ''
    });
  };
  
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
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => switchUserType('borrower')}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  userType === 'borrower'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <UserCircle className="w-4 h-4 mr-2" />
                Borrower Portal
              </button>
              <button
                onClick={() => switchUserType('lender')}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  userType === 'lender'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Lender Portal
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {authMode === 'login' ? (
          // LOGIN PAGE
          <div className="max-w-md mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                {userType === 'borrower' ? (
                  <UserCircle className="w-8 h-8 text-white" />
                ) : (
                  <Building2 className="w-8 h-8 text-white" />
                )}
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">
                {userType === 'borrower' ? 'Borrower Login' : 'Lender Login'}
              </h2>
              <p className="text-slate-600">
                Sign in to your {userType === 'borrower' ? 'borrower' : 'lender'} account
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="space-y-4">
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
                      value={loginData.email}
                      onChange={handleLoginChange}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
                
                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                {/* Submit Button */}
                <button
                  onClick={handleLoginSubmit}
                  disabled={isLoading}
                  className="w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
                
                {/* Sign Up Link */}
                <div className="text-center pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // SIGNUP PAGE
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                {userType === 'borrower' ? (
                  <UserCircle className="w-8 h-8 text-white" />
                ) : (
                  <Building2 className="w-8 h-8 text-white" />
                )}
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">
                {userType === 'borrower' ? 'Create Borrower Account' : 'Create Lender Account'}
              </h2>
              <p className="text-slate-600">
                Join CreditView as a {userType === 'borrower' ? 'borrower' : 'lender'}
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name / Company Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {userType === 'borrower' ? 'Full Name' : 'Company Name'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      {userType === 'borrower' ? (
                        <User className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      ) : (
                        <Building2 className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      )}
                      <input
                        type="text"
                        name={userType === 'borrower' ? 'fullName' : 'companyName'}
                        value={userType === 'borrower' ? signupData.fullName : signupData.companyName}
                        onChange={handleSignupChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={userType === 'borrower' ? 'John Doe' : 'Acme Lending Corp'}
                      />
                    </div>
                  </div>
                  
                  {/* Business ID (Lenders only) */}
                  {userType === 'lender' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Business ID / Tax ID <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="businessId"
                          value={signupData.businessId}
                          onChange={handleSignupChange}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="12-3456789"
                        />
                      </div>
                    </div>
                  )}
                  
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
                        value={signupData.email}
                        onChange={handleSignupChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        value={signupData.phone}
                        onChange={handleSignupChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  
                  {/* Date of Birth (Borrowers only) */}
                  {userType === 'borrower' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Date of Birth <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                        <input
                          type="date"
                          name="dob"
                          value={signupData.dob}
                          onChange={handleSignupChange}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={signupData.password}
                        onChange={handleSignupChange}
                        className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Must be at least 8 characters with uppercase, lowercase, and numbers
                    </p>
                  </div>
                  
                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={signupData.confirmPassword}
                        onChange={handleSignupChange}
                        className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="••••••••"
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
                
                {/* Submit Button */}
                <button
                  onClick={handleSignupSubmit}
                  disabled={isLoading}
                  className="w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
                
                {/* Login Link */}
                <div className="text-center pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
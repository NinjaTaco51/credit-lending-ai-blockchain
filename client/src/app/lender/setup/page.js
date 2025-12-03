'use client'

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Building2, CheckCircle, User } from 'lucide-react';
import supabase from "../../../config/supabaseClient"
import bcrypt from 'bcryptjs'

export default function SetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  const [profileData, setProfileData] = useState({
    fullName: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false
  });

  // Get lender from Supabase Auth
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        if (typeof window !== 'undefined') {
          window.location.href = "/";
        }
        return;
      }

      setUserEmail(user.email || "");

      // Optionally prefill name from Account table
      const { data: accountRow, error: accountError } = await supabase
        .from("Account")
        .select("name")
        .eq("email", user.email)
        .maybeSingle();

      if (!accountError && accountRow?.name) {
        setProfileData(prev => ({ ...prev, fullName: accountRow.name }));
      }
    };

    init();
  }, []);

  useEffect(() => {
    const password = profileData.newPassword;
    setPasswordRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password)
    });
  }, [profileData.newPassword]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value
    });
  };

  function isValidPassword(password) {
    if (password.length < 8) return false;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasUppercase && hasLowercase && hasNumber;
  }

  const handleSubmit = async () => {
    if (!profileData.fullName || !profileData.newPassword || !profileData.confirmPassword) {
      alert("Please fill in all fields");
      return;
    }

    if (!isValidPassword(profileData.newPassword)) {
      alert("Password does not meet requirements");
      return;
    }

    if (profileData.newPassword !== profileData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (!userEmail) {
      alert("No logged-in user found");
      return;
    }

    setIsLoading(true);

    const passwordHash = await bcrypt.hash(profileData.newPassword, 12);
    const { error } = await supabase
      .from("Account")
      .update({ name: profileData.fullName, password_hash: passwordHash })
      .eq("email", userEmail);

    if (error) {
      console.error("Error updating account:", error);
      alert("Failed to update account.");
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    alert('Account set up successfully!');
    window.location.href = "/lender/requests";
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
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center px-4 py-2 text-sm font-medium text-slate-600">
                <Building2 className="w-4 h-4 mr-2" />
                Lender Portal
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              Set Up Your Account
            </h2>
            <p className="text-slate-600">
              Complete your account setup with a name and secure password
            </p>
            {userEmail && (
              <p className="text-sm text-slate-500 mt-2">
                {userEmail}
              </p>
            )}
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={profileData.newPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-slate-700 mb-2">Password Requirements:</p>
                <div className="space-y-1">
                  <div className="flex items-center text-sm">
                    <CheckCircle className={`w-4 h-4 mr-2 ${passwordRequirements.minLength ? 'text-green-500' : 'text-slate-300'}`} />
                    <span className={passwordRequirements.minLength ? 'text-slate-700' : 'text-slate-500'}>
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className={`w-4 h-4 mr-2 ${passwordRequirements.hasUppercase ? 'text-green-500' : 'text-slate-300'}`} />
                    <span className={passwordRequirements.hasUppercase ? 'text-slate-700' : 'text-slate-500'}>
                      One uppercase letter
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className={`w-4 h-4 mr-2 ${passwordRequirements.hasLowercase ? 'text-green-500' : 'text-slate-300'}`} />
                    <span className={passwordRequirements.hasLowercase ? 'text-slate-700' : 'text-slate-500'}>
                      One lowercase letter
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className={`w-4 h-4 mr-2 ${passwordRequirements.hasNumber ? 'text-green-500' : 'text-slate-300'}`} />
                    <span className={passwordRequirements.hasNumber ? 'text-slate-700' : 'text-slate-500'}>
                      One number
                    </span>
                  </div>
                </div>
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
                    value={profileData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Setting Up Account...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
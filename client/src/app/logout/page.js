'use client'

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, LogIn } from 'lucide-react';

export default function LoggedOutPage() {
  
  useEffect(() => {
    localStorage.removeItem('userEmail');
  }, []);
  
  
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
              <a
                href="/"
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                Sign In
              </a>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Logged Out Message */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-3">You've Been Logged Out</h2>
          <p className="text-lg text-slate-600 mb-2">Thank you for using CreditView</p>
          <p className="text-sm text-slate-500">Your session has ended successfully</p>
        </div>
        
        {/* Sign Back In Button */}
        <div className="flex justify-center mb-8">
          <a
            href="/"
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg flex items-center justify-center"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign Back In
          </a>
        </div>
      </main>
    </div>
  );
}
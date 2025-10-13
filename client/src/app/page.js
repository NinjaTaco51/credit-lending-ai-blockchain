'use client'

import React, { useState } from 'react';
import { CreditCard, History, DollarSign, User, FileText, BookOpen, HelpCircle, Menu, X } from 'lucide-react';

export default function CreditScoreDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const creditScore = 742;
  
  const getScoreColor = (score) => {
    if (score >= 800) return '#10b981';
    if (score >= 740) return '#3b82f6';
    if (score >= 670) return '#f59e0b';
    if (score >= 580) return '#f97316';
    return '#ef4444';
  };
  
  const getScoreLabel = (score) => {
    if (score >= 800) return 'Excellent';
    if (score >= 740) return 'Very Good';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  };
  
  const scoreColor = getScoreColor(creditScore);
  const scoreLabel = getScoreLabel(creditScore);
  const scorePercentage = (creditScore / 850) * 100;
  
  const navItems = [
    { icon: CreditCard, label: 'Accounts', href: '#accounts' },
    { icon: History, label: 'History', href: '#history' },
    { icon: DollarSign, label: 'Loan Portal', href: '#loans' },
    { icon: User, label: 'Profile', href: '#profile' },
    { icon: FileText, label: 'Terms & Privacy', href: '#terms' },
    { icon: BookOpen, label: 'Resources', href: '#resources' },
    { icon: HelpCircle, label: 'Support', href: '#support' }
  ];
  
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Your Credit Score</h2>
          <p className="text-slate-600">Last updated today</p>
        </div>
        
        {/* Credit Score Display */}
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-6">
          <div className="flex flex-col items-center">
            {/* Circular Progress */}
            <div className="relative w-64 h-64 mb-6">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${scorePercentage * 2.51327} 251.327`}
                  style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
                />
              </svg>
              
              {/* Score text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-6xl font-bold text-slate-800">{creditScore}</div>
                <div className="text-sm text-slate-500 mt-1">out of 850</div>
              </div>
            </div>
            
            {/* Score label */}
            <div className="mb-8">
              <span 
                className="inline-block px-6 py-2 rounded-full text-white font-semibold text-lg"
                style={{ backgroundColor: scoreColor }}
              >
                {scoreLabel}
              </span>
            </div>
            
            {/* Score range indicators */}
            <div className="w-full max-w-md mb-8">
              <div className="flex justify-between text-xs text-slate-600 mb-2">
                <span>Poor</span>
                <span>Fair</span>
                <span>Good</span>
                <span>Very Good</span>
                <span>Excellent</span>
              </div>
              <div className="h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-blue-500 to-green-500 rounded-full"></div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>300</span>
                <span>850</span>
              </div>
            </div>
            
            {/* CTA Button */}
            <button
              onClick={() => window.location.href = '#analysis'}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5"
            >
              View Score Analysis & Insights
            </button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-slate-600 text-sm mb-1">Payment History</div>
            <div className="text-2xl font-bold text-green-600">Excellent</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-slate-600 text-sm mb-1">Credit Utilization</div>
            <div className="text-2xl font-bold text-blue-600">23%</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-slate-600 text-sm mb-1">Total Accounts</div>
            <div className="text-2xl font-bold text-slate-700">8</div>
          </div>
        </div>
      </main>
    </div>
  );
}
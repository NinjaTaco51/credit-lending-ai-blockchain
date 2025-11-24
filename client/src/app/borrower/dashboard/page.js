'use client'

import React, { useEffect, useState } from 'react';
import { CreditCard, History, DollarSign, User, FileText, BookOpen, HelpCircle, Menu, X, AlertCircle, CheckCircle, Home, Car, GraduationCap, Briefcase, LogOut } from 'lucide-react';
import supabase from "../../../config/supabaseClient"

export default function Dashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creditScore, setCreditScore] = useState(0);
  const [reasons, setReasons] = useState([]);
  const [showScore, setShowScore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    age: '',
    monthlyIncome: '',
    housingCost: '',
    otherExpenses: '',
    invested: '',
    occupation: '',
    educationLevel: '',
    numCreditCards: '',
    numAccounts: '',
    numLoans: '',
    loanTypes: {
      mortgage: false,
      auto: false,
      student: false,
      personal: false,
      debtConsol: false,
      creditBuilder: false,
      payDay: false,
      homeEquity: false,
      other: false
    },
  });

  useEffect(() => {
    const fetchAndPrefill = async () => {
      const email = localStorage.getItem('userEmail');
      if (!email) {
        window.location.href = "/";
        return;
      }

      const { data, error } = await supabase
        .from('Account')
        .select('credit_data, dob')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Prefill error:', error);
        return;
      }

      // Check if data exists before accessing it
      if (!data) {
        console.log('No data found for this user');
        return;
      }

      const birthDate = new Date(data.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();

      // Adjust if the birthday hasn't occurred yet this year
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      let trueLoans = {
          mortgage: false,
          auto: false,
          student: false,
          personal: false,
          debtConsol: false,
          creditBuilder: false,
          payDay: false,
          homeEquity: false,
          other: false
        }
  
      if (data.credit_data) {
        let dbLoans = data.credit_data.loans;
        for (let i = 0; i < dbLoans.length; i++) {
          if (dbLoans[i] == "Mortgage Loan") {
            trueLoans["mortgage"] = true
          } else if (dbLoans[i] == "Auto Loan") {
            trueLoans["auto"] = true
          } else if (dbLoans[i] == "Student Loan") {
            trueLoans["student"] = true
          } else if (dbLoans[i] == "Personal Loan") {
            trueLoans["personal"] = true
          } else if (dbLoans[i] == "Debt Consolidation Loan") {
            trueLoans["debtConsol"] = true
          } else if (dbLoans[i] == "Credit-Builder Loan") {
            trueLoans["creditBuilder"] = true
          } else if (dbLoans[i] == "Payday Loan") {
            trueLoans["payDay"] = true
          } else if (dbLoans[i] == "Home Equity Loan") {
            trueLoans["homeEquity"] = true
          } else {
            trueLoans["other"] = true
          }
        }
        console.log(trueLoans)
      }

      // Safely coerce to strings for controlled inputs
      setFormData(prev => ({
        ...prev,
        age: age,
        monthlyIncome: (data.credit_data?.income_monthly ?? '').toString(),
        housingCost: (data.credit_data?.housing_cost_monthly ?? '').toString(),
        otherExpenses: (data.credit_data?.other_expenses_monthly ?? '').toString(),
        invested: (data.credit_data?.invested ?? '').toString(),
        occupation: data.credit_data?.employment_role ?? '',
        educationLevel: data.credit_data?.education_level ?? '',
        numCreditCards: (data.credit_data?.num_credit_cards ?? '').toString(),
        numAccounts: (data.credit_data?.num_bank_accounts ?? '').toString(),
        numLoans: (data.credit_data?.num_loans ?? '').toString(),
        loanTypes: trueLoans ?? {
          mortgage: false,
          auto: false,
          student: false,
          personal: false,
          debtConsol: false,
          creditBuilder: false,
          payDay: false,
          homeEquity: false,
          other: false
        },
      }));
    };

    fetchAndPrefill();
  }, []);
  
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
  
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    if (name in formData.loanTypes) {
      setFormData({
        ...formData,
        loanTypes: {
          ...formData.loanTypes,
          [name]: checked
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: checked
      });
    }
  };
  
  const handleSubmit = async (e) => {
    
    e.preventDefault();
    setIsLoading(true);

    const email = localStorage.getItem('userEmail');
      if (!email) {
        window.location.href = "/";
        return;
      }

    let { data: dobRow, error: dobError } = await supabase
      .from('Account')
      .select('dob')
      .eq('email', email)
      .maybeSingle();

    const birthDate = new Date(dobRow.dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    // Adjust if the birthday hasn't occurred yet this year
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const application_month = monthNames[today.getMonth()];

    // Map keys to display names
    const loanLabels = {
      mortgage: "Mortgage Loan",
      auto: "Auto Loan",
      student: "Student Loan",
      personal: "Personal Loan",
      debtConsol: "Debt Consolidation Loan",
      creditBuilder: "Credit-Builder Loan",
      payDay: "Payday Loan",
      homeEquity: "Home Equity Loan",
      other: "Other Loan"
    };

    const loans = Object.entries(formData.loanTypes)
      .filter(([, checked]) => checked)
      .map(([key]) => loanLabels[key]);

    const dataInJson = {
      "income_monthly": Number(formData.monthlyIncome),
      "housing_cost_monthly": Number(formData.housingCost),
      "other_expenses_monthly": Number(formData.otherExpenses),
      "employment_role": String(formData.occupation),
      "education_level": String(formData.educationLevel),
      "loans": loans,
      age,
      application_month,
      "num_credit_cards": Number(formData.numCreditCards),
      "num_bank_accounts": Number(formData.numAccounts),
      "num_loans": Number(formData.numLoans),
      "invested": Number(formData.invested),
    };

    console.log("Sending payload:", dataInJson);

    const { data: creditDataRow, error: creditDataError } = await supabase
      .from('Account')
      .update({"credit_data": dataInJson})
      .eq('email', email)
      .maybeSingle();

    try {
      const response = await fetch("http://localhost:8080/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dataInJson),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert(`Error: ${errorData.error}`);
        setIsLoading(false);
        return;
      }

      const result = await response.json();

      const { data: creditScoreRow, error: creditScoreError } = await supabase
      .from('Account')
      .update({"credit_score": result.credit_score, "credit_reasons": result.reasons})
      .eq('email', email)
      .maybeSingle();
      
      setCreditScore(Number(result.credit_score));
      setReasons(result.reasons || []);
      setShowScore(true);
      setIsLoading(false);

    } catch (error) {
      // Network-level failures (server down, CORS, DNS, etc.) appear here
      console.error("Request failed:", error);
      alert("An unexpected error occurred while sending data to the server.");
      setIsLoading(false);
    }
  };
  
  const scoreColor = getScoreColor(creditScore);
  const scoreLabel = getScoreLabel(creditScore);
  const scorePercentage = (creditScore / 850) * 100;
  
  const navItems = [
    { icon: CreditCard,label: 'Dashboard', href: '/borrower/dashboard'},
    { icon: DollarSign, label: 'Loan Portal', href: '/borrower/loans' },
    { icon: User, label: 'Profile', href: '/borrower/profile' },
    { icon: LogOut, label: 'Logout', href: '/logout'}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Credit Score Dashboard</h2>
          <p className="text-slate-600">Enter your information to view your credit score</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Input Form */}
          <div className="bg-white rounded-2xl shadow-lg p-8 max-h-[800px] overflow-y-auto">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Your Information</h3>
            
            <div className="space-y-4">
              
              {/* Monthly Income */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monthly Income (Gross) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-500">$</span>
                  <input
                    type="number"
                    name="monthlyIncome"
                    value={formData.monthlyIncome}
                    onChange={handleInputChange}
                    onWheel={(e) => e.target.blur()}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                    placeholder="5000"
                    required
                  />
                </div>
              </div>
              
              {/* Monthly Housing Cost */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monthly Housing Cost (Rent/Mortgage) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-500">$</span>
                  <input
                    type="number"
                    name="housingCost"
                    value={formData.housingCost}
                    onChange={handleInputChange}
                    onWheel={(e) => e.target.blur()}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                    placeholder="1500"
                    required
                  />
                </div>
              </div>
              
              {/* Other Monthly Expenses */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Other Monthly Expenses <span className="text-red-500">*</span>
                  <span className="text-xs text-slate-500 block mt-1">(Insurance, food, utilities, etc.)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-500">$</span>
                  <input
                    type="number"
                    name="otherExpenses"
                    value={formData.otherExpenses}
                    onChange={handleInputChange}
                    onWheel={(e) => e.target.blur()}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                    placeholder="800"
                    required
                  />
                </div>
              </div>
              
              {/* Invested Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monthly Invested Amount <span className="text-red-500">*</span>
                  <span className="text-xs text-slate-500 block mt-1">(Investment, Savings, etc.)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-500">$</span>
                  <input
                    type="number"
                    name="invested"
                    value={formData.invested}
                    onChange={handleInputChange}
                    onWheel={(e) => e.target.blur()}
                    className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                    placeholder="800"
                    required
                  />
                </div>
              </div>

              {/* Job / Occupation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Job / Occupation <span className="text-red-500">*</span>
                </label>
                <select
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  required
                >
                  <option value="">Select occupation</option>
                  <option value="professional">Professional/Technical</option>
                  <option value="management">Management/Executive</option>
                  <option value="sales">Sales</option>
                  <option value="administrative">Administrative/Clerical</option>
                  <option value="service">Service Industry</option>
                  <option value="manufacturing">Manufacturing/Production</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="education">Education</option>
                  <option value="government">Government</option>
                  <option value="self-employed">Self-Employed</option>
                  <option value="retired">Retired</option>
                  <option value="student">Student</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              {/* Educational Level */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Educational Level <span className="text-slate-500">(Optional)</span>
                </label>
                <select
                  name="educationLevel"
                  value={formData.educationLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Select education level</option>
                  <option value="high-school">High School</option>
                  <option value="some-college">Some College</option>
                  <option value="associate">Associate Degree</option>
                  <option value="bachelor">Bachelor's Degree</option>
                  <option value="master">Master's Degree</option>
                  <option value="doctorate">Doctorate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              {/* Number of Credit Card */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Number of Credit Cards <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="numCreditCards"
                  value={formData.numCreditCards}
                  onChange={handleInputChange}
                  onWheel={(e) => e.target.blur()}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                  placeholder="5"
                  min="0"
                  step="1"
                  required
                />
              </div>

              {/* Number of Bank Account */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Number of Bank Accounts <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="numAccounts"
                  value={formData.numAccounts}
                  onChange={handleInputChange}
                  onWheel={(e) => e.target.blur()}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                  placeholder="5"
                  min="0"
                  step="1"
                  required
                />
              </div>

              {/* Number of Loans */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Number of Current Loans <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="numLoans"
                  value={formData.numLoans}
                  onChange={handleInputChange}
                  onWheel={(e) => e.target.blur()}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:opacity-100"
                  placeholder="5"
                  min="0"
                  step="1"
                  required
                />
              </div>

              {/* Loan Types Held */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Loan Types Currently Held
                </label>
                <div className="space-y-2 pl-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="mortgage"
                      checked={formData.loanTypes.mortgage}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Mortgage</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="homeEquity"
                      checked={formData.loanTypes.homeEquity}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Home Equity</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="auto"
                      checked={formData.loanTypes.auto}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Auto Loan</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="student"
                      checked={formData.loanTypes.student}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Student Loan</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="personal"
                      checked={formData.loanTypes.personal}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Personal Loan</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="debtConsol"
                      checked={formData.loanTypes.debtConsol}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Debt Consolidation</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="creditBuilder"
                      checked={formData.loanTypes.creditBuilder}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Credit Builder</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="payDay"
                      checked={formData.loanTypes.payDay}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Payday</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="other"
                      checked={formData.loanTypes.other}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Other</span>
                  </label>
                </div>
              </div>
              
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Submit Information'}
              </button>
            </div>
          </div>
          
          {/* Right Side - Credit Score Display */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            {!showScore ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <CreditCard className="w-16 h-16 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-4">Your Credit Score Will Appear Here</h3>
                  <p className="text-slate-600 max-w-md">
                    Fill out the form on the left and submit your information to view your credit score and detailed analysis.
                  </p>
                </div>
              </div>
            ) : (
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
                
                {/* Score Reasons */}
                {reasons.length > 0 && (
                  <div className="w-full max-w-md">
                    <h4 className="text-lg font-semibold text-slate-800 mb-3">Key Factors</h4>
                    <div className="space-y-2">
                      {reasons.map((reason, index) => (
                        <div key={index} className="flex items-start bg-slate-50 rounded-lg p-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">
                            {index + 1}
                          </div>
                          <p className="text-sm text-slate-700">{reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
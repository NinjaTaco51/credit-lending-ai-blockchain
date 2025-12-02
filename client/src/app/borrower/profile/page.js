'use client'

import React, { useState, useEffect } from 'react';
import { CreditCard, History, DollarSign, User, BanknoteArrowDown, FileText, BookOpen, HelpCircle, Menu, X, Save, Mail, Phone, Calendar, Lock, Eye, EyeOff, Wallet, CheckCircle, AlertCircle, Shield, LogOut } from 'lucide-react';
import supabase from "../../../config/supabaseClient"
import bcrypt from 'bcryptjs';

export default function EditProfilePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      return true;
    }
    return false;
  }

  function isValidPhone(phone) {
    const phoneStr = phone.toString();
    const phoneRegex = /^\d{10}$/;
    if (phoneRegex.test(phoneStr)) {
      return true;
    }
    return false;
  }

  function isValidPassword(password) {
    if (password.length < 8) {
      return false;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (hasUppercase && hasLowercase && hasNumber) {
      return true;
    }
    return false;
  }

  // MetaMask state
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [isSavingWallet, setIsSavingWallet] = useState(false);

  useEffect(() => {
    checkIfWalletIsConnected();
    loadUserWalletFromBackend();
  }, []);

  // Load user's saved wallet address from backend
  const loadUserWalletFromBackend = async () => {
    try {
      const email = localStorage.getItem('userEmail');
      if (!email) {
        console.warn('No userEmail in localStorage');
        return;
      }

      const { data, error } = await supabase
        .from('Account')
        .select('wallet_address')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error loading wallet from Supabase:', error);
        return;
      }

      if (data && data.wallet_address) {
        setWalletAddress(data.wallet_address);
        console.log('Wallet loaded from Supabase:', data.wallet_address);
      } else {
        console.log('No wallet saved for this user yet');
      }
    } catch (error) {
      console.error('Error loading wallet address:', error);
    }
  };

  // Check if MetaMask is installed and wallet is already connected
  const checkIfWalletIsConnected = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          // Don't automatically set - let user explicitly connect
          console.log('MetaMask wallet available:', accounts[0]);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  // Connect MetaMask wallet
  const connectWallet = async () => {
    setIsConnecting(true);
    setWalletError('');

    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        setWalletError('MetaMask is not installed. Please install MetaMask extension from metamask.io');
        setIsConnecting(false);
        return;
      }

      console.log('MetaMask detected, requesting accounts...');

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      console.log('Accounts received:', accounts);

      if (!accounts || accounts.length === 0) {
        setWalletError('No accounts found. Please create a MetaMask account first.');
        setIsConnecting(false);
        return;
      }

      const connectedAddress = accounts[0];
      console.log('Connected address:', connectedAddress);

      // Set the wallet address directly (no backend for now)
      setWalletAddress(connectedAddress);
      setWalletError('');
      console.log('Wallet connected successfully!');

      try {
        await saveWalletToBackend(connectedAddress);
      } catch (error) {
        console.error('Supabase save failed, but wallet is connected locally');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      if (error.code === 4001) {
        setWalletError('Connection rejected. Please approve the connection in MetaMask.');
      } else if (error.code === -32002) {
        setWalletError('Connection request pending. Please check MetaMask for a pending request.');
      } else {
        setWalletError(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Save wallet address to backend
  const saveWalletToBackend = async (address) => {
    setIsSavingWallet(true);
    try {
      const email = localStorage.getItem('userEmail');
      if (!email) {
        throw new Error('No user email in localStorage');
      }

      const { error } = await supabase
        .from('Account')
        .update({ wallet_address: address })
        .eq('email', email);

      if (error) {
        console.error('Error saving wallet to Supabase:', error);
        setWalletError('Wallet connected but failed to save to your profile. Please try again.');
        throw error;
      }

      console.log('Wallet saved successfully to Supabase');
    } catch (error) {
      console.error('Error saving wallet to backend:', error);
      setWalletError('Wallet connected but failed to save to your profile. Please try again.');
      throw error;
    } finally {
      setIsSavingWallet(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      console.log('Disconnecting wallet...');

      const email = localStorage.getItem('userEmail');
      if (!email) {
        throw new Error('No user email in localStorage');
      }

      const { error } = await supabase
        .from('Account')
        .update({ wallet_address: null })
        .eq('email', email);

      if (error) {
        console.error('Error clearing wallet in Supabase:', error);
        setWalletError('Failed to disconnect wallet. Please try again.');
        return;
      }

      setWalletAddress('');
      setWalletError('');
      console.log('Wallet disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setWalletError('Failed to disconnect wallet. Please try again.');
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length > 0 && walletAddress) {
          // User changed account in MetaMask
          const newAddress = accounts[0];
          try {
            await saveWalletToBackend(newAddress);
            setWalletAddress(newAddress);
          } catch (error) {
            setWalletError('Failed to update wallet address. Please reconnect.');
          }
        } else if (accounts.length === 0) {
          // User disconnected in MetaMask
          setWalletAddress('');
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [walletAddress]);

  // Format wallet address for display
  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };


  useEffect(() => {
    const fetchAndPrefill = async () => {
      const email = localStorage.getItem('userEmail');
      if (!email) {
        window.location.href = "/";
        return;
      }


      let { data, error } = await supabase
        .from("Account")
        .select('name, email, phone, dob')
        .eq('email', email)
        .maybeSingle();

      setProfileData({
        fullName: data.name,
        email: data.email,
        phone: data.phone,
        dob: data.dob
      });
      console.log(profileData)
    };
    fetchAndPrefill();
  }, []);


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
    const email = localStorage.getItem('userEmail');
    if (!email) {
      window.location.href = "/";
      return;
    }

    //Validate all profile fields are inputted
    if (!profileData.fullName || !profileData.email || !profileData.phone || !profileData.dob) {
      alert("Please Fill in All Fields in Personal Information")
      return;
    }

    //check valid email format
    if (!isValidEmail(profileData.email)) {
      alert("Input Valid Email")
      return;
    }

    //check valid phone format
    if (!isValidPhone(profileData.phone)) {
      alert("Input Valid Phone")
      return;
    }

    // Validate password fields if any are filled
    if (passwordData.currentPassword || passwordData.newPassword || passwordData.confirmPassword) {
      if (!passwordData.currentPassword) {
        alert('Please enter your current password');
        return;
      }
      if (!passwordData.newPassword) {
        alert('Please enter a new password or Delete Current Password to Edit Basic Profile Info');
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert('New passwords do not match!');
        return;
      }
      if (!isValidPassword(passwordData.newPassword)) {
        alert("Input Valid Password that meets requirements")
        return;
      }

      const { data: pwCheck, error: pwCheckError } = await supabase
        .from('Account')
        .select('password_hash')
        .eq('email', email)
        .maybeSingle();

      const currentpasswordHash = pwCheck.password_hash
      const passwordCorrect = await bcrypt.compare(passwordData.currentPassword, currentpasswordHash);

      if (passwordCorrect) {
        const newPasswordHash = await bcrypt.hash(passwordData.newPassword, 12);
        const { data: pwUpdate, error: pwUpdateError } = await supabase
          .from('Account')
          .update({ 'password_hash': newPasswordHash })
          .eq('email', email)
      } else {
        alert("Incorrect Current Password")
        return;
      }

    }

    setIsLoading(true);

    const { data: update, error: updateError } = await supabase
      .from('Account')
      .update({
        "name": profileData.fullName,
        "email": profileData.email,
        "phone": profileData.phone,
        "dob": profileData.dob
      })
      .eq('email', email)
      .maybeSingle();

    setIsLoading(false);

    // Clear password fields
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    alert("Profile Updated")


  }

  const navItems = [
    { icon: CreditCard,label: 'Credit Score', href: '/borrower/credit-score'},
    { icon: BanknoteArrowDown, label: 'Loan Dashboard', href: '/borrower/loans' },
    { icon: DollarSign, label: 'Loan Payments', href: '/borrower/loans/loan-payment' },
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
                      placeholder="5551234567"
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
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Change Password
              </h3>

              <p className="mb-4 text-sm text-red-500">Current Password Needed to make New Password</p>

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
                      {showCurrentPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
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
                      {showNewPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
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
                      {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Web3 Wallet Section */}
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <Wallet className="w-5 h-5 mr-2" />
                Web3 Wallet Connection
              </h3>

              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Connect your MetaMask wallet to enable blockchain-based features and cryptocurrency transactions.
                </p>

                {/* Security Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900 mb-1">Security Notice</h4>
                      <p className="text-xs text-amber-800">
                        We only store your public wallet address. Your private keys remain secure in your MetaMask wallet and are never shared with our platform.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wallet Error Message */}
                {walletError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-800 mb-1">Connection Error</h4>
                      <p className="text-sm text-red-700">{walletError}</p>
                    </div>
                  </div>
                )}

                {/* Wallet Connected Status */}
                {walletAddress ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-green-800 mb-1">Wallet Connected</h4>
                          <p className="text-sm text-green-700 mb-2">
                            Your MetaMask wallet is successfully connected and saved to your profile
                          </p>
                          <div className="bg-white rounded-md p-3 border border-green-200">
                            <p className="text-xs text-slate-500 mb-1">Wallet Address (Public)</p>
                            <p className="text-sm font-mono text-slate-900 break-all">{walletAddress}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={disconnectWallet}
                      className="mt-4 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start mb-4">
                      <Wallet className="w-5 h-5 text-slate-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 mb-1">No Wallet Connected</h4>
                        <p className="text-sm text-slate-600">
                          Connect your MetaMask wallet to get started
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={connectWallet}
                      disabled={isConnecting || isSavingWallet}
                      className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      {isConnecting ? 'Connecting...' : isSavingWallet ? 'Saving...' : 'Connect MetaMask Wallet'}
                    </button>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Why Connect a Wallet?
                  </h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Receive loan disbursements in cryptocurrency</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Make repayments using digital assets</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Access blockchain-verified credit history</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Participate in DeFi lending opportunities</span>
                    </li>
                  </ul>
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

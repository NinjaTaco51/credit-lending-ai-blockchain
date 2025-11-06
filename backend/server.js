const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL;
const CREDIT_SCORE_ADDRESS = process.env.CREDIT_SCORE_ADDRESS;
const LENDING_PLATFORM_ADDRESS = process.env.LENDING_PLATFORM_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Contract ABIs (simplified - include only functions we need)
const CREDIT_SCORE_ABI = [
  "function registerUser(address _user) external",
  "function getUserCredit(address _user) external view returns (tuple(uint256 score, uint256 totalLoans, uint256 successfulRepayments, uint256 missedPayments, bool isRegistered))",
  "function getCreditScore(address _user) external view returns (uint256)",
  "function updateCreditScore(address _user, uint256 _totalLoans, uint256 _successfulRepayments, uint256 _missedPayments) external"
];

const LENDING_PLATFORM_ABI = [
  "function requestLoan(uint256 _amount, uint256 _interestRate, uint256 _duration) external",
  "function fundLoan(uint256 _requestId) external payable",
  "function makeRepayment(uint256 _loanId) external payable",
  "function getLoanRequest(uint256 _requestId) external view returns (tuple(uint256 requestId, address borrower, uint256 amount, uint256 interestRate, uint256 duration, bool isFunded))",
  "function getLoanDetails(uint256 _loanId) external view returns (tuple(uint256 loanId, address borrower, address lender, uint256 amount, uint256 interestRate, uint256 duration, uint256 startTime, uint256 amountRepaid, bool isActive))",
  "function nextRequestId() external view returns (uint256)",
  "function nextLoanId() external view returns (uint256)"
];

// Setup provider and contracts
const provider = new ethers.JsonRpcProvider(RPC_URL);
const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
const creditScoreContract = new ethers.Contract(CREDIT_SCORE_ADDRESS, CREDIT_SCORE_ABI, adminWallet);
const lendingPlatformContract = new ethers.Contract(LENDING_PLATFORM_ADDRESS, LENDING_PLATFORM_ABI, adminWallet);

// ============================================
// USER ENDPOINTS
// ============================================

// Register a new user
app.post('/api/users/register', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const tx = await creditScoreContract.registerUser(address);
    await tx.wait();

    res.json({ 
      success: true, 
      message: 'User registered successfully',
      transactionHash: tx.hash 
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user credit profile
app.get('/api/users/:address/credit', async (req, res) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const credit = await creditScoreContract.getUserCredit(address);

    res.json({
      address,
      score: credit.score.toString(),
      totalLoans: credit.totalLoans.toString(),
      successfulRepayments: credit.successfulRepayments.toString(),
      missedPayments: credit.missedPayments.toString(),
      isRegistered: credit.isRegistered
    });
  } catch (error) {
    console.error('Error getting credit profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LOAN REQUEST ENDPOINTS
// ============================================

// Get all loan requests
app.get('/api/loans/requests', async (req, res) => {
  try {
    const nextRequestId = await lendingPlatformContract.nextRequestId();
    const requests = [];

    for (let i = 0; i < nextRequestId; i++) {
      const request = await lendingPlatformContract.getLoanRequest(i);
      
      if (!request.isFunded) {
        requests.push({
          requestId: request.requestId.toString(),
          borrower: request.borrower,
          amount: ethers.formatEther(request.amount),
          interestRate: request.interestRate.toString(),
          duration: request.duration.toString(),
          isFunded: request.isFunded
        });
      }
    }

    res.json({ requests });
  } catch (error) {
    console.error('Error getting loan requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific loan request
app.get('/api/loans/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await lendingPlatformContract.getLoanRequest(requestId);

    res.json({
      requestId: request.requestId.toString(),
      borrower: request.borrower,
      amount: ethers.formatEther(request.amount),
      interestRate: request.interestRate.toString(),
      duration: request.duration.toString(),
      isFunded: request.isFunded
    });
  } catch (error) {
    console.error('Error getting loan request:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LOAN ENDPOINTS
// ============================================

// Get loan details
app.get('/api/loans/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await lendingPlatformContract.getLoanDetails(loanId);

    res.json({
      loanId: loan.loanId.toString(),
      borrower: loan.borrower,
      lender: loan.lender,
      amount: ethers.formatEther(loan.amount),
      interestRate: loan.interestRate.toString(),
      duration: loan.duration.toString(),
      startTime: loan.startTime.toString(),
      amountRepaid: ethers.formatEther(loan.amountRepaid),
      isActive: loan.isActive
    });
  } catch (error) {
    console.error('Error getting loan details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all loans for a user (as borrower)
app.get('/api/users/:address/loans/borrowed', async (req, res) => {
  try {
    const { address } = req.params;
    const nextLoanId = await lendingPlatformContract.nextLoanId();
    const loans = [];

    for (let i = 0; i < nextLoanId; i++) {
      const loan = await lendingPlatformContract.getLoanDetails(i);
      
      if (loan.borrower.toLowerCase() === address.toLowerCase()) {
        loans.push({
          loanId: loan.loanId.toString(),
          borrower: loan.borrower,
          lender: loan.lender,
          amount: ethers.formatEther(loan.amount),
          interestRate: loan.interestRate.toString(),
          duration: loan.duration.toString(),
          startTime: loan.startTime.toString(),
          amountRepaid: ethers.formatEther(loan.amountRepaid),
          isActive: loan.isActive
        });
      }
    }

    res.json({ loans });
  } catch (error) {
    console.error('Error getting borrowed loans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all loans for a user (as lender)
app.get('/api/users/:address/loans/lent', async (req, res) => {
  try {
    const { address } = req.params;
    const nextLoanId = await lendingPlatformContract.nextLoanId();
    const loans = [];

    for (let i = 0; i < nextLoanId; i++) {
      const loan = await lendingPlatformContract.getLoanDetails(i);
      
      if (loan.lender.toLowerCase() === address.toLowerCase()) {
        loans.push({
          loanId: loan.loanId.toString(),
          borrower: loan.borrower,
          lender: loan.lender,
          amount: ethers.formatEther(loan.amount),
          interestRate: loan.interestRate.toString(),
          duration: loan.duration.toString(),
          startTime: loan.startTime.toString(),
          amountRepaid: ethers.formatEther(loan.amountRepaid),
          isActive: loan.isActive
        });
      }
    }

    res.json({ loans });
  } catch (error) {
    console.error('Error getting lent loans:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    creditScoreAddress: CREDIT_SCORE_ADDRESS,
    lendingPlatformAddress: LENDING_PLATFORM_ADDRESS
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`========================================`);
  console.log(`API endpoints available at:`);
  console.log(`http://localhost:${PORT}/api/health`);
  console.log(`http://localhost:${PORT}/api/users/:address/credit`);
  console.log(`http://localhost:${PORT}/api/loans/requests`);
  console.log(`========================================\n`);
});
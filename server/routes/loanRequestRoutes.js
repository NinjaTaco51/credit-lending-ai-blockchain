// ============================================
// server/routes/loanRequestRoutes.js (MongoDB)
// ============================================
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Define Mongoose Schema
const LoanRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, required: true }, // LR-123...
    borrowerEmail: { type: String, required: true },
    borrowerName: { type: String, required: true },
    loanType: { type: String, required: true },
    loanAmount: { type: Number, required: true },
    loanTerm: { type: Number, required: true }, // months
    loanPurpose: { type: String },
    creditScore: { type: Number },
    creditBand: { type: String },
    reasons: { type: [String], default: [] },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'denied'], 
      default: 'pending' 
    },
    requestDate: { type: Date, required: true }
  },
  {
    timestamps: true // adds createdAt, updatedAt
  }
);

// Create Model
const LoanRequest = mongoose.model('LoanRequest', LoanRequestSchema);

// ============================================
// GET all loan requests with filtering
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const requests = await LoanRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({ 
      success: true,
      requests: requests.map(req => ({
        id: req.requestId,
        borrowerName: req.borrowerName,
        email: req.borrowerEmail,
        loanType: req.loanType,
        loanAmount: req.loanAmount,
        loanTerm: req.loanTerm,
        loanPurpose: req.loanPurpose,
        creditScore: req.creditScore,
        creditBand: req.creditBand,
        reasons: req.reasons || [],
        // store as yyyy-mm-dd like before
        requestDate: req.requestDate.toISOString().split('T')[0],
        status: req.status
      }))
    });
  } catch (error) {
    console.error('Error fetching loan requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch loan requests' 
    });
  }
});

// ============================================
// GET single loan request
// ============================================
router.get('/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await LoanRequest.findOne({ requestId });
    
    if (!request) {
      return res.status(404).json({ 
        success: false,
        error: 'Loan request not found' 
      });
    }
    
    res.json({ 
      success: true,
      request: {
        id: request.requestId,
        borrowerName: request.borrowerName,
        email: request.borrowerEmail,
        loanType: request.loanType,
        loanAmount: request.loanAmount,
        loanTerm: request.loanTerm,
        loanPurpose: request.loanPurpose,
        creditScore: request.creditScore,
        creditBand: request.creditBand,
        reasons: request.reasons || [],
        requestDate: request.requestDate.toISOString().split('T')[0],
        status: request.status
      }
    });
  } catch (error) {
    console.error('Error fetching loan request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch loan request' 
    });
  }
});

// ============================================
// POST create new loan request
// ============================================
router.post('/', async (req, res) => {
  try {
    const {
      borrowerEmail,
      borrowerName,
      loanType,
      loanAmount,
      loanTerm,
      loanPurpose,
      creditScore,
      creditBand,
      reasons
    } = req.body;
    
    // Validation
    if (!borrowerEmail || !borrowerName || !loanType || !loanAmount || !loanTerm) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields' 
      });
    }
    
    // Generate unique request ID
    const requestId = `LR-${Date.now()}`;
    const requestDate = new Date(); // full Date in Mongo

    const newRequest = await LoanRequest.create({
      requestId,
      borrowerEmail,
      borrowerName,
      loanType,
      loanAmount,
      loanTerm,
      loanPurpose: loanPurpose || '',
      creditScore: creditScore || null,
      creditBand: creditBand || null,
      reasons: reasons || [],
      requestDate,
      status: 'pending'
    });
    
    res.status(201).json({
      success: true,
      message: 'Loan request created successfully',
      requestId: newRequest.requestId
    });
  } catch (error) {
    console.error('Error creating loan request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create loan request' 
    });
  }
});

// ============================================
// PATCH update loan request status
// ============================================
router.patch('/:requestId/status', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'approved', 'denied'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status. Must be: pending, approved, or denied' 
      });
    }
    
    const updated = await LoanRequest.findOneAndUpdate(
      { requestId },
      { status },
      { new: true } // return updated doc
    );
    
    if (!updated) {
      return res.status(404).json({ 
        success: false,
        error: 'Loan request not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Status updated successfully',
      status: updated.status
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update status' 
    });
  }
});

// ============================================
// GET statistics
// ============================================
router.get('/stats/summary', async (req, res) => {
  try {
    // Aggregate stats in one shot
    const results = await LoanRequest.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          denied: {
            $sum: { $cond: [{ $eq: ['$status', 'denied'] }, 1, 0] }
          },
          totalAmount: { $sum: '$loanAmount' },
          avgCreditScore: { $avg: '$creditScore' }
        }
      }
    ]);

    const stats = results[0] || {
      total: 0,
      pending: 0,
      approved: 0,
      denied: 0,
      totalAmount: 0,
      avgCreditScore: 0
    };

    res.json({ 
      success: true,
      stats: {
        total: stats.total || 0,
        pending: stats.pending || 0,
        approved: stats.approved || 0,
        denied: stats.denied || 0,
        totalAmount: stats.totalAmount || 0,
        avgCreditScore: stats.avgCreditScore
          ? Math.round(stats.avgCreditScore)
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics' 
    });
  }
});

module.exports = router;

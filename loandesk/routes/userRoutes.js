const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/auth'); // Your auth middleware

// All routes require authentication
router.get('/wallet', authenticateToken, walletController.getWallet);
router.post('/wallet', authenticateToken, walletController.saveWallet);
router.delete('/wallet', authenticateToken, walletController.removeWallet);

module.exports = router;
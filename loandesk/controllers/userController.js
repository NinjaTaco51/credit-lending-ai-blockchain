const User = require('../models/User');

// Get user's wallet address
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('walletAddress');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      walletAddress: user.walletAddress || null 
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to retrieve wallet address' });
  }
};

// Save wallet address
exports.saveWallet = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    // Validate Ethereum address format
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Update user with wallet address
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress: walletAddress.toLowerCase() }, // Store in lowercase
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      walletAddress: user.walletAddress 
    });
  } catch (error) {
    console.error('Error saving wallet:', error);
    res.status(500).json({ error: 'Failed to save wallet address' });
  }
};

// Remove wallet address
exports.removeWallet = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress: null },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Wallet disconnected successfully'
    });
  } catch (error) {
    console.error('Error removing wallet:', error);
    res.status(500).json({ error: 'Failed to remove wallet address' });
  }
};
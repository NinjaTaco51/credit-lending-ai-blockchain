// ============================================
// server/server.js (FINAL, ATLAS-FRIENDLY)
// ============================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// --------------------------------------------
// 1. Basic Middleware
// --------------------------------------------
app.use(cors());
app.use(express.json());

// --------------------------------------------
// 2. MongoDB Connection (Mongoose)
// --------------------------------------------
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/creditview';
const PORT = process.env.PORT || 3000;

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err);
});

// ⬇️ IMPORTANT: NO OPTIONS OBJECT HERE
mongoose
  .connect(MONGO_URI) // ← just this, nothing else
  .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// --------------------------------------------
// 3. Routes
// --------------------------------------------

// Only include the routes that actually exist
const loanRequestRoutes = require('./routes/loanRequestRoutes');
app.use('/api/loan-requests', loanRequestRoutes);

// --------------------------------------------
// 4. Health Check
// --------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// --------------------------------------------
// 5. Error Handling Middleware
// --------------------------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    message: err.message || 'Internal server error',
  });
});

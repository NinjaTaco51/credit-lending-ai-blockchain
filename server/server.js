require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CONNECT TO MONGODB
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    console.error("❌ MONGODB_URI is missing in .env file");
    process.exit(1);
}

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 2. DEFINE THE DATA SCHEMA (How data looks in Mongo)
const CreditScoreSchema = new mongoose.Schema({
    userId: { type: String, required: false },
    score: Number,
    band: String,
    reasons: [String],
    inputData: Object, // Optional: Store what the user sent
    calculatedAt: { type: Date, default: Date.now }
});

const CreditScore = mongoose.model('CreditScore', CreditScoreSchema);

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('MongoDB Credit Server Running'));

// 3. API ROUTE
app.post('/api/calculate-score', async (req, res) => {
    const { userId, ...financialData } = req.body;
    const jsonData = JSON.stringify(financialData);

    // Spawn Python Script
    const pythonProcess = spawn('python3', ['model.py', jsonData]);

    let resultString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => { resultString += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorString += data.toString(); });

    pythonProcess.on('close', async (code) => {
        if (code !== 0) {
            console.error("Python Error:", errorString);
            return res.status(500).json({ error: "AI Model Failed", details: errorString });
        }

        try {
            // Parse AI Result
            const aiResult = JSON.parse(resultString);

            // 4. SAVE TO MONGODB
            const newEntry = new CreditScore({
                userId: userId || 'anonymous',
                score: aiResult.credit_score,
                band: aiResult.band,
                reasons: aiResult.reasons,
                inputData: financialData
            });

            await newEntry.save();
            console.log(`Saved score ${aiResult.credit_score} to MongoDB`);

            // Respond to Frontend
            res.json(aiResult);

        } catch (e) {
            console.error("Error processing result:", e);
            res.status(500).json({ error: "Server Error", details: e.message });
        }
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes

app.post("/api/credit-score", async (req, res) => {
  const { userId } = req.body;

  let score = await getCreditScoreFromDatabase(userId);

  if (score === null) {
    const apiResponse = await fetch ("https://external-credit-score-api.com/getScore", { // Example external API URL
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const modelResult = await apiResponse.json();

    // save to database
    score = await CreditScoreModel.create({
      userID,
      score: modelResult.score,
      createAt: new Date()
    });
  }

  res.json({ score: score.score });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
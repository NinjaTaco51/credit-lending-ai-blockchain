# 🏦 Blockchain Lending Platform

A decentralized peer-to-peer lending platform built with Solidity, Hardhat, Express, and React.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Testing the Platform](#testing-the-platform)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)

---

## ✨ Features

- 🔐 Connect wallet via MetaMask
- 💰 Request loans with custom terms (amount, interest rate, duration)
- 🤝 Fund loan requests from other users
- 💳 Make loan repayments
- 📊 Credit score tracking system
- 📈 View borrowed and lent loans
- ⚡ Real-time transaction updates

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.x or v20.x) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **MetaMask** browser extension - [Install here](https://metamask.io/)
- **Git** - [Download here](https://git-scm.com/)

Check your installations:
```bash
node --version
npm --version
git --version
```

---

## 📁 Project Structure

```
lending-platform/
├── contracts/              # Solidity smart contracts
│   ├── CreditScore.sol
│   └── LendingPlatform.sol
├── scripts/               # Deployment scripts
│   └── deploy.js
├── test/                  # Contract tests
├── backend/               # Express API server
│   ├── server.js
│   ├── package.json
│   └── .env
├── frontend/              # React application
│   ├── src/
│   ├── public/
│   └── package.json
├── hardhat.config.js      # Hardhat configuration
└── package.json           # Root dependencies
```

---

## 🚀 Installation & Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/lending-platform.git
cd lending-platform
```

### Step 2: Install Root Dependencies

```bash
npm install
```

This installs Hardhat and blockchain development tools.

### Step 3: Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### Step 4: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Step 5: Compile Smart Contracts

```bash
npx hardhat compile
```

You should see:
```
Compiled 2 Solidity files successfully
```

### Step 6: Start Local Blockchain

Open a **new terminal window** (Terminal 1) and run:

```bash
npx hardhat node
```

**Keep this terminal running!** You'll see 20 test accounts with 10,000 ETH each. The blockchain runs at `http://localhost:8545`.

⚠️ **IMPORTANT:** These private keys are PUBLIC and for testing only. Never use them on real networks!

### Step 7: Deploy Smart Contracts

Open a **second terminal window** (Terminal 2) and run:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

You should see output like:
```
✅ CreditScore deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ LendingPlatform deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

**Copy these addresses!** You'll need them in the next steps.

### Step 8: Configure Backend

Create `backend/.env` file:

```bash
cd backend
```

Create a file named `.env` with the following content (replace with your deployed addresses):

```env
PORT=3001
RPC_URL=http://localhost:8545
CREDIT_SCORE_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
LENDING_PLATFORM_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

💡 The `ADMIN_PRIVATE_KEY` is Account #0 from the Hardhat node (safe for local development).

### Step 9: Update Frontend Contract Address

Edit `frontend/src/App.js` and update line 6 with your deployed `LENDING_PLATFORM_ADDRESS`:

```javascript
const LENDING_PLATFORM_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'; // Your address here
```

### Step 10: Configure MetaMask

1. **Open MetaMask** and click the network dropdown
2. **Add Network Manually**:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `1337`
   - **Currency Symbol:** `ETH`
3. **Import Test Account**:
   - Click account icon → Import Account
   - Select "Private Key"
   - Paste this private key (Account #1 from Hardhat):
     ```
     0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
     ```
   - Name it "Hardhat Test 1"
4. **Import a Second Account** (for testing funding loans):
   - Repeat step 3 with Account #2:
     ```
     0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
     ```
   - Name it "Hardhat Test 2"

---

## 🎮 Running the Application

You'll need **3 terminal windows** running simultaneously:

### Terminal 1: Hardhat Node (Blockchain)

```bash
cd lending-platform
npx hardhat node
```

Keep running. You'll see transaction logs here.

### Terminal 2: Backend Server (API)

```bash
cd lending-platform/backend
npm start
```

You should see:
```
🚀 Backend server running on port 3001
```

### Terminal 3: Frontend (React App)

```bash
cd lending-platform/frontend
npm start
```

Browser opens automatically at `http://localhost:3000`

---

## 🧪 Testing the Platform

### Complete Test Flow:

1. **Open the app** at http://localhost:3000
2. **Connect MetaMask**:
   - Click "Connect Wallet"
   - Approve the connection
   - Ensure you're on "Hardhat Local" network
3. **Request a Loan** (as Borrower):
   - Click "Request Loan" tab
   - Enter: 1 ETH, 5% interest, 30 days
   - Click "Request Loan"
   - Approve MetaMask transaction
4. **Switch Accounts** in MetaMask (to Account #2)
5. **Fund the Loan** (as Lender):
   - Click "Browse Loans" tab
   - Click "Fund This Loan"
   - Approve MetaMask transaction
6. **Switch Back** to Account #1 (Borrower)
7. **Make Repayment**:
   - Click "My Borrowed Loans" tab
   - Enter repayment amount (e.g., 0.5 ETH)
   - Click "Make Repayment"
   - Approve MetaMask transaction
8. **View as Lender**:
   - Switch to Account #2
   - Click "My Lent Loans" tab
   - See repayment progress

### Testing API Endpoints:

```bash
# Health check
curl http://localhost:3001/api/health

# Get loan requests
curl http://localhost:3001/api/loans/requests

# Get user credit (replace with your address)
curl http://localhost:3001/api/users/0x70997970C51812dc3A010C7d01b50e0d17dc79C8/credit
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to localhost:8545"

**Solution:** Make sure Terminal 1 (Hardhat node) is running.

```bash
npx hardhat node
```

### Issue: "Contract not deployed"

**Solution:** Redeploy contracts and update addresses in `.env` and `App.js`:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Issue: "Transaction failed" or "Insufficient funds"

**Solutions:**
- Ensure MetaMask is on "Hardhat Local" network (Chain ID 1337)
- Verify you imported accounts with test ETH
- Reset account in MetaMask: Settings → Advanced → Clear activity tab data

### Issue: "Port 3000 already in use"

**Solution:** Kill the process or use a different port:

```bash
# On Windows
netstat -ano | findstr :3000
taskkill /PID [PID_NUMBER] /F

# On Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Issue: Backend can't connect to contracts

**Solution:** Verify addresses in `backend/.env` match deployed contracts:

```bash
cat backend/.env
```

### Issue: Compilation warnings about SPDX or pragma

**Solution:** These are handled. If you see errors, ensure contracts have:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
```

### Issue: MetaMask shows wrong network

**Solution:** Manually switch to "Hardhat Local" in MetaMask network dropdown.

### Issue: "Nonce too high" error

**Solution:** Reset your MetaMask account:
- MetaMask Settings → Advanced → Clear activity tab data

---

## 🏗️ Tech Stack

### Smart Contracts
- **Solidity** ^0.8.27
- **Hardhat** 2.22.15
- **Ethers.js** 6.13.0

### Backend
- **Node.js** & **Express** 4.18.x
- **Ethers.js** 6.x
- **CORS** enabled for frontend
- **dotenv** for configuration

### Frontend
- **React** 18.x
- **Ethers.js** 6.x (Web3 integration)
- **Axios** (API calls)
- CSS3 (Responsive design)

### Development Tools
- **Hardhat Network** (Local blockchain)
- **MetaMask** (Wallet connection)
- **Nodemon** (Backend hot reload)

---

## 📝 Smart Contract Functions

### CreditScore Contract

- `registerUser(address)` - Register new user
- `getUserCredit(address)` - Get user's credit profile
- `getCreditScore(address)` - Get credit score
- `updateCreditScore(...)` - Update credit metrics (admin only)

### LendingPlatform Contract

- `requestLoan(amount, interestRate, duration)` - Create loan request
- `fundLoan(requestId)` - Fund a loan request
- `makeRepayment(loanId)` - Make loan repayment
- `getLoanRequest(requestId)` - Get request details
- `getLoanDetails(loanId)` - Get loan details

---

## 🔒 Security Notes

⚠️ **This is a development/educational project:**

- Smart contracts are NOT audited
- Use only on local networks
- Never deploy to mainnet without professional audit
- Test accounts have PUBLIC private keys
- Implement additional security for production:
  - Access controls
  - Rate limiting
  - Input validation
  - Re-entrancy guards
  - Oracle integration for price feeds

---

## 📚 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [React Documentation](https://react.dev/)
- [MetaMask Developer Docs](https://docs.metamask.io/)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Verify all 3 terminals are running
3. Ensure MetaMask is configured correctly
4. Check console logs in browser DevTools (F12)
5. Review Hardhat node terminal for transaction errors

---

## 🎉 Success Checklist

- [ ] Node.js and npm installed
- [ ] Repository cloned
- [ ] Dependencies installed (root, backend, frontend)
- [ ] Contracts compiled successfully
- [ ] Hardhat node running (Terminal 1)
- [ ] Contracts deployed (addresses saved)
- [ ] Backend `.env` configured
- [ ] Frontend contract address updated
- [ ] MetaMask installed and configured
- [ ] Test accounts imported to MetaMask
- [ ] Backend server running (Terminal 2)
- [ ] Frontend app running (Terminal 3)
- [ ] Successfully connected wallet
- [ ] Successfully requested a loan
- [ ] Successfully funded a loan
- [ ] Successfully made a repayment

---

**Happy Lending! 🚀**
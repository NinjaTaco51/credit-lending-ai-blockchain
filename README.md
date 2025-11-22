# Blockchain Set Up Instructions
## Terminal 1:

For first time initialization (scroll down if set up already):
```
$ cd loandesk
$ npm init -y
$ npm install --save-dev hardhat@hh2
> Create a Javascript Project
```

if there are issues with project not initializing, delete hardhat.config.js
-> after running the above lines again, choose 
```
> Create an empty hardhat.config.js 
```
and paste below code into hardhat.config.js:

```
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Local dev chain (best for class demo)
    hardhat: {},
    // Testnet (optional)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
```

Create .env file with contents:
```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/(your metamask private key for etherum)
PRIVATE_KEY=(your metamask private key for etherum)
LENDER_ADDRESS=(your account address)
```

**Start here if hardhat has already been set up**
```
$ cd loandesk
$ npx hardhat node
```

## Terminal 2:
Run command and keep this terminal running!
```
$ cd loandesk
$ npx hardhat run scripts/deploy.js --network localhost
```
```
$ cd frontend
```
create or modify .env file in /frontend
```
VITE_CONTRACT_ADDRESS= [copy and paste borrower address]
VITE_LENDER_ADDRESS=[copy and paste lender address]
```

in /artifacts/contracts/
-> Copy LoanDesk.json

in frontend/src/abi/
-> Paste LoanDesk.json (replace if needed)

## Terminal 3
View Request Form
```
$ cd frontend
$ npm run dev
```
Connect MetaMask → try loan request!
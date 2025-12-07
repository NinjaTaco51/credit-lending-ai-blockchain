# credit-lending-ai-blockchain
A software engineering project for CS4800 that leverages artificial intelligence for credit risk assessment and blockchain for secure, transparent lending transactions. The platform aims to provide fair, data-driven credit scoring and a decentralized lending ecosystem.

1. Run AI Model
    Terminal 1:
    $ cd creditmodel

    # Create VM
    $ python -m venv .venv

    # Open VM **
    $ source .venv/bin/activate       # (Linux/Mac)
    $ .\.venv\Scripts\Activate.ps1    # (Windows)

    # Install dependencies
    $ pip install -r requirements.txt

    # Run the model **
    $ python ./server/model.py    # (Linux/Mac)
    $ python .\server\model.py    # (Windows)

    # Run the application
    $ uvicorn server.app:app --reload --port 8080

2. Set up metamask
    Terminal 2:
    # For first time initialization:
    $ npm init -y
    $ npm install --save-dev hardhat@hh2
    > Create a Javascript Project

    # if there are issues with project not initializing, delete hardhat.config.js
    # -> after running the above lines again, choose Create an empty hardhat.config.js and paste below code:

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

    In /loandesk Create .env file with contents:
    SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/(your metamask private key for etherum)
    PRIVATE_KEY=(your metamask private key for etherum)
    LENDER_ADDRESS=(your account address)

    $ cd loandesk
    $ npx hardhat node

3. Set up Client and Run Application
    Terminal 3

    $ cd client
    $ npm install @supabase/supabase-js
    $ npm install bcryptjs
    $ touch .env
    # in env in client folder add 
    APP_SUPABASE_URL = https://gojqrulogcdunldjlraf.supabase.co
    APP_ANON_KEY = (get from supabase)

    # Run Application
    $ npm run dev
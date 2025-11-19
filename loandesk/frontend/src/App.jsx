import { useEffect, useState } from "react";
import { ethers } from "ethers";
import BorrowerForm from "./components/BorrowerForm";
import BorrowerRequests from "./components/BorrowerRequests";
import LenderDashboard from "./components/LenderDashboard";
import abiFile from "./abi/LoanDesk.json";
import "./App.css";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const LENDER_ADDRESS = import.meta.env.VITE_LENDER_ADDRESS.toLowerCase();

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [roleOverride, setRoleOverride] = useState(null); // 👈 new

  async function connectWallet() {
    if (!window.ethereum) return alert("Please install MetaMask");
    const _provider = new ethers.BrowserProvider(window.ethereum);
    await _provider.send("eth_requestAccounts", []);
    const _signer = await _provider.getSigner();
    const _account = await _signer.getAddress();
    const _contract = new ethers.Contract(CONTRACT_ADDRESS, abiFile.abi, _signer);
    const _net = await _provider.getNetwork();

    setProvider(_provider);
    setSigner(_signer);
    setContract(_contract);
    setAccount(_account);
    setNetwork(_net);
  }

  // determine role automatically unless overridden
  const autoIsLender = account && account.toLowerCase() === LENDER_ADDRESS;
  const isLender = roleOverride ?? autoIsLender;

  return (
    <div className="app">
      <header>
        <h1>Request Loan</h1>
        {account ? (
          <p>
            Connected: {account} ({isLender ? "Lender" : "Borrower"})
          </p>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
        {network && <p>Network: {Number(network.chainId)}</p>}

        {/* 👇 Add this toggle */}
        {account && (
          <div style={{ marginTop: "1rem" }}>
            <label>
              <input
                type="checkbox"
                checked={isLender}
                onChange={(e) =>
                  setRoleOverride(e.target.checked ? true : false)
                }
              />{" "}
              View as Lender
            </label>{" "}
            <button
              style={{ marginLeft: "1rem" }}
              onClick={() => setRoleOverride(null)}
            >
              Reset to Auto
            </button>
          </div>
        )}
      </header>

      {account && contract && (
        <>
          {!isLender && (
            <>
              <BorrowerForm contract={contract} />
              <BorrowerRequests contract={contract} account={account} />
            </>
          )}
          {isLender && <LenderDashboard contract={contract} />}
        </>
      )}
    </div>
  );
}

export default App;

import json, os
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account
from solcx import compile_standard, install_solc, set_solc_version

load_dotenv()
PRIVATE_KEY = os.environ["PRIVATE_KEY"]
RPC_URL     = os.environ["RPC_URL"]
CHAIN_ID    = int(os.getenv("CHAIN_ID", "11155111"))  # Sepolia

set_solc_version("0.8.26")

SRC = Path("contracts/Greeter.sol").read_text()

compiled = compile_standard(
    {
        "language": "Solidity",
        "sources": {"Greeter.sol": {"content": SRC}},
        "settings": {
            "outputSelection": {"*": {"*": ["abi", "evm.bytecode", "evm.deployedBytecode"]}}
        },
    },
    allow_paths="."
)

artifact_dir = Path("artifacts")
artifact_dir.mkdir(parents=True, exist_ok=True)
(Path(artifact_dir / "Greeter.json")).write_text(json.dumps(compiled, indent=2))

abi = compiled["contracts"]["Greeter.sol"]["Greeter"]["abi"]
bytecode = compiled["contracts"]["Greeter.sol"]["Greeter"]["evm"]["bytecode"]["object"]

w3 = Web3(Web3.HTTPProvider(RPC_URL))
assert w3.is_connected(), "RPC not reachable"

acct = Account.from_key(PRIVATE_KEY)
nonce = w3.eth.get_transaction_count(acct.address)

Greeter = w3.eth.contract(abi=abi, bytecode=bytecode)

# constructor arg
construct_txn = Greeter.constructor("hello, testnet!").build_transaction({
    "from": acct.address,
    "nonce": nonce,
    "chainId": CHAIN_ID,
    "maxFeePerGas": w3.to_wei("30", "gwei"),
    "maxPriorityFeePerGas": w3.to_wei("1.5", "gwei"),
    "gas": 0,  # placeholder; we’ll estimate below
})

# gas estimate
gas_estimate = w3.eth.estimate_gas({k: v for k, v in construct_txn.items() if k != "gas"})
construct_txn["gas"] = int(gas_estimate * 1.2)

signed = acct.sign_transaction(construct_txn)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

print("Deployed Greeter at:", receipt.contractAddress)

# quick “test”: call greet(), then setGreeting()
greeter = w3.eth.contract(address=receipt.contractAddress, abi=abi)
print("greet() ->", greeter.functions.greet().call())

# send a state-changing tx
nonce += 1
tx = greeter.functions.setGreeting("gm, sepolia!").build_transaction({
    "from": acct.address,
    "nonce": nonce,
    "chainId": CHAIN_ID,
    "maxFeePerGas": w3.to_wei("30", "gwei"),
    "maxPriorityFeePerGas": w3.to_wei("1.5", "gwei"),
    "gas": 0,
})
tx["gas"] = int(w3.eth.estimate_gas({k: v for k, v in tx.items() if k != "gas"}) * 1.2)
signed2 = acct.sign_transaction(tx)
tx2_hash = w3.eth.send_raw_transaction(signed2.rawTransaction)
w3.eth.wait_for_transaction_receipt(tx2_hash)

print("greet() after setGreeting ->", greeter.functions.greet().call())

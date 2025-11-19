const hre = require("hardhat");

async function main() {
  const lender = process.env.LENDER_ADDRESS || "0x795d2a78bbe83833860a7e9c01f9544b6212e87e";
  const LoanDesk = await hre.ethers.getContractFactory("LoanDesk");
  const loandesk = await LoanDesk.deploy(lender);
  await loandesk.waitForDeployment();
  console.log("LoanDesk deployed to:", await loandesk.getAddress());
  console.log("Lender:", lender);
}
main().catch((e) => { console.error(e); process.exit(1); });
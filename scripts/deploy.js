const hre = require("hardhat");

async function main() {
  // Deploy CreditScore contract
  const CreditScore = await hre.ethers.getContractFactory("CreditScore");
  const creditScore = await CreditScore.deploy();
  await creditScore.waitForDeployment();
  const creditScoreAddress = await creditScore.getAddress();
  console.log("CreditScore deployed to:", creditScoreAddress);

  // Deploy LendingPlatform contract
  const LendingPlatform = await hre.ethers.getContractFactory("LendingPlatform");
  const lendingPlatform = await LendingPlatform.deploy(creditScoreAddress);
  await lendingPlatform.waitForDeployment();
  const lendingPlatformAddress = await lendingPlatform.getAddress();
  console.log("LendingPlatform deployed to:", lendingPlatformAddress);

  // Save addresses to .env file
  console.log("\nAdd these to your .env file:");
  console.log(`CREDIT_SCORE_ADDRESS=${creditScoreAddress}`);
  console.log(`LENDING_PLATFORM_ADDRESS=${lendingPlatformAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
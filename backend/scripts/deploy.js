// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Deploy the libraries
  const LinkedListLib = await hre.ethers.getContractFactory("LinkedListLib");
  const linkedListLib = await LinkedListLib.deploy();
  await linkedListLib.deployed();
  console.log("LinkedListLib deployed to:", linkedListLib.address);


  // We get the contract to deploy
  const Factory = await hre.ethers.getContractFactory("Factory");
  const factory = await Factory.deploy({
    libraries: {
      LinkedListLib: "0x25635f3b3Ea101d52F994F933Cb5aF948BaAd5d8"
    }
  });
  await factory.deployed();
  console.log("Factory deployed to:", factory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deploy ETH, USDb, and Factory smart contracts", function () {
  async function initialiseCoinsAndFactory() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    // get and deploy ETH, USDb
    const ETH = await ethers.getContractFactory("ETH", {
      signer: owner,
    });
    const USDb = await ethers.getContractFactory("USDb", {
        signer: owner,
    });
    const ETHContract = await ETH.deploy();
    const USDbContract = await USDb.deploy();
    
    // get and deploy LinkedListLib
    const LinkedList = await ethers.getContractFactory("LinkedListLib");
    const LinkedListContract = await LinkedList.deploy();

    // get and deploy Factory
    const Factory = await ethers.getContractFactory("Factory", {
      signer: owner,
      libraries: {
        LinkedListLib: LinkedListContract.address,
      },
    });
    const FactoryContract = await Factory.deploy();

    await ETHContract.deployed();
    await USDbContract.deployed();
    await LinkedListContract.deployed();
    await FactoryContract.deployed();

    return { owner, addr1, addr2, ETHContract, USDbContract, LinkedList, LinkedListContract, FactoryContract }
  }

  async function initialiseExchaneConract() {
    const { owner, addr1, addr2, ETHContract, USDbContract, FactoryContract } = await loadFixture(initialiseCoinsAndFactory);

    const Exchange = await FactoryContract.connect(owner).createPair(ETHContract.address, USDbContract.address);
    const ExchangeContract = await ethers.getContractAt("Exchange", Exchange.to);

    await ETHContract.connect(addr1).approve(ExchangeContract.address, 10000);
    await ETHContract.connect(addr2).approve(ExchangeContract.address, 10000);
    await USDbContract.connect(addr1).approve(ExchangeContract.address, 10000);
    await USDbContract.connect(addr2).approve(ExchangeContract.address, 10000);

    return { owner, addr1, addr2, ETHContract, USDbContract, FactoryContract, ExchangeContract }
  }
  
  // transfer ETH and USDb to addr1 and addr2
  beforeEach(async function () {
    const { owner, addr1, addr2, ETHContract, USDbContract } = await loadFixture(initialiseCoinsAndFactory);
    
    await ETHContract.connect(owner).setBalance(addr1.address, 10000);
    await ETHContract.connect(owner).setBalance(addr2.address, 10000);
    await USDbContract.connect(owner).setBalance(addr1.address, 10000);
    await USDbContract.connect(owner).setBalance(addr2.address, 10000);

    expect(await ETHContract.balanceOf(addr1.address)).to.equal(10000);
    expect(await ETHContract.balanceOf(addr2.address)).to.equal(10000);
    expect(await USDbContract.balanceOf(addr1.address)).to.equal(10000);
    expect(await USDbContract.balanceOf(addr2.address)).to.equal(10000);
  });

  // wipe out all ETH and USDb from addr1 and addr2
  afterEach(async function () {
    const { owner, addr1, addr2, ETHContract, USDbContract } = await loadFixture(initialiseCoinsAndFactory);
    await ETHContract.connect(owner).setBalance(addr1.address, 0);
    await ETHContract.connect(owner).setBalance(addr2.address, 0);
    await USDbContract.connect(owner).setBalance(addr1.address, 0);
    await USDbContract.connect(owner).setBalance(addr2.address, 0);

    expect(await ETHContract.balanceOf(addr1.address)).to.equal(0);
    expect(await ETHContract.balanceOf(addr2.address)).to.equal(0);
    expect(await USDbContract.balanceOf(addr1.address)).to.equal(0);
    expect(await USDbContract.balanceOf(addr2.address)).to.equal(0);
  });

  it ("Fully match a sell order", async function () {
    //             SELL 
    //     PRICE (USD)   AMOUNT
    //     --------------------
    //     50                 2     <--buy(2)--

    const { owner, addr1, addr2, ETHContract, USDbContract, ExchangeContract } = await loadFixture(initialiseExchaneConract);
    await ExchangeContract.connect(owner).initPVnode(50)

  //   console.log(await ETHContract.balanceOf(owner.address))
  //   console.log(await ETHContract.balanceOf(addr1.address))
  //   console.log(await ETHContract.balanceOf(addr2.address))


  })

})
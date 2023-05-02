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
    const ETHUSDbPairAddress = await FactoryContract.getPair(ETHContract.address, USDbContract.address)
    const ExchangeContract = await ethers.getContractAt("Exchange", ETHUSDbPairAddress);
    await ExchangeContract.deployed();

    await ETHContract.connect(addr1).approve(ExchangeContract.address, 10000);
    await ETHContract.connect(addr2).approve(ExchangeContract.address, 10000);
    await USDbContract.connect(addr1).approve(ExchangeContract.address, 10000);
    await USDbContract.connect(addr2).approve(ExchangeContract.address, 10000);

    expect(await ETHContract.getAllowance(addr1.address, ExchangeContract.address)).to.equal(10000);
    expect(await ETHContract.getAllowance(addr2.address, ExchangeContract.address)).to.equal(10000);
    expect(await USDbContract.getAllowance(addr1.address, ExchangeContract.address)).to.equal(10000);
    expect(await USDbContract.getAllowance(addr2.address, ExchangeContract.address)).to.equal(10000);

    console.log("- ETHContract.address: ", ETHContract.address)
    console.log("- USDbContract.address: ", USDbContract.address)
    console.log("- FactoryContract.address: ", FactoryContract.address)
    console.log("- ExchangeContract.address: ", ExchangeContract.address)

    return { owner, addr1, addr2, ETHContract, USDbContract, FactoryContract, ExchangeContract }
  }

  before(async function () {
    coinsAndFactory = await loadFixture(initialiseExchaneConract);
  });

  // transfer ETH and USDb to addr1 and addr2
  beforeEach(async function () {
    const { owner, addr1, addr2, ETHContract, USDbContract } = await coinsAndFactory;

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
    const { owner, addr1, addr2, ETHContract, USDbContract } = await coinsAndFactory;

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

    const { owner, addr1, addr2, ETHContract, USDbContract, ExchangeContract } = await coinsAndFactory;
  
    // place the sell order
    const sellPrice = 50;
    const sellAmount = 2;
    await ExchangeContract.connect(owner).initPVnode(sellPrice);
    const indexOfPrice50 = String(await ExchangeContract.getIndexOfPrice(sellPrice));

    await ExchangeContract.connect(addr1).newSellOrder(sellPrice, sellAmount, indexOfPrice50);
    expect(await ETHContract.balanceOf(addr1.address)).to.equal(10000 - sellAmount);
    expect(await USDbContract.balanceOf(addr1.address)).to.equal(10000);

    let PVobs50 = String(await ExchangeContract.getPVobs())
    expect(PVobs50).to.equal('50,2,50,0')

    expect(await ExchangeContract.getDeposits(addr1.address, ETHContract.address)).to.equal(2);
    expect(await ExchangeContract.getDeposits(addr1.address, USDbContract.address)).to.equal(0);

    let activeSellOrdersByAddr1 = await ExchangeContract.connect(addr1).activeSellOrders();

    expect((await ExchangeContract.orderBook(ETHContract.address, 50))._length).to.equal(1);
    expect((await ExchangeContract.orderBook(ETHContract.address, 50)).head).to.equal(activeSellOrdersByAddr1[0][0]);
    expect((await ExchangeContract.orderBook(ETHContract.address, 50)).tail).to.equal(activeSellOrdersByAddr1[0][0]);
    expect((await ExchangeContract.orderBook(USDbContract.address, 50))._length).to.equal(0);
    expect((await ExchangeContract.orderBook(USDbContract.address, 50)).head).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    expect((await ExchangeContract.orderBook(USDbContract.address, 50)).tail).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    
    expect((await ExchangeContract.getAllSellOrders(sellPrice)).length).to.equal(1);
    

    // place the buy order
    const buyPrice = 50;
    const buyAmount = 2;

    await ExchangeContract.connect(addr2).newBuyOrder(buyPrice, buyAmount, 0);

    // console.log(await ETHContract.balanceOf(addr2.address))
    // console.log(await USDbContract.balanceOf(addr2.address))
    // console.log(await ETHContract.balanceOf(addr1.address))
    // console.log(await USDbContract.balanceOf(addr1.address))



    // expect(await ETHContract.balanceOf(addr2.address)).to.equal(10000 + buyAmount);
    // expect(await USDbContract.balanceOf(addr2.address)).to.equal(10000 - (buyPrice * buyAmount));
  })

})
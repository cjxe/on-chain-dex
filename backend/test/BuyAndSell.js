const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const ETH_DECIMALS = 10 ** 6;
const USDb_DECIMALS = 10 ** 6;
const USD_DECIMALS = 100; // 1 USDb = 100 cents

// since decimals points are not supported in Solidity, we need to convert to cents
function convertToCents(amount) {
  return amount * USD_DECIMALS;
}

function convertToDecimal(amount) {
  return amount / USD_DECIMALS;
}

function calculateAfterFee(amount) {
  const FEE_RATE = 999; // 0.1%
  return amount * FEE_RATE / 1000;
}

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

    await ETHContract.connect(addr1).approve(ExchangeContract.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
    await ETHContract.connect(addr2).approve(ExchangeContract.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
    await USDbContract.connect(addr1).approve(ExchangeContract.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
    await USDbContract.connect(addr2).approve(ExchangeContract.address, "115792089237316195423570985008687907853269984665640564039457584007913129639935");

    expect(await ETHContract.getAllowance(addr1.address, ExchangeContract.address)).to.equal("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    expect(await ETHContract.getAllowance(addr2.address, ExchangeContract.address)).to.equal("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    expect(await USDbContract.getAllowance(addr1.address, ExchangeContract.address)).to.equal("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    expect(await USDbContract.getAllowance(addr2.address, ExchangeContract.address)).to.equal("115792089237316195423570985008687907853269984665640564039457584007913129639935");

    console.log("- ETHContract.address: ", ETHContract.address)
    console.log("- USDbContract.address: ", USDbContract.address)
    console.log("- FactoryContract.address: ", FactoryContract.address)
    console.log("- ExchangeContract.address: ", ExchangeContract.address)

    return { owner, addr1, addr2, ETHContract, USDbContract, FactoryContract, ExchangeContract }
  }

  // transfer ETH and USDb to addr1 and addr2
  beforeEach(async function () {
    coinsAndFactory = await loadFixture(initialiseExchaneConract);
    const { owner, addr1, addr2, ETHContract, USDbContract } = await coinsAndFactory;

    await ETHContract.connect(owner).setBalance(addr1.address, 1 * ETH_DECIMALS);
    await ETHContract.connect(owner).setBalance(addr2.address, 1 * ETH_DECIMALS);
    await USDbContract.connect(owner).setBalance(addr1.address, 100 * USDb_DECIMALS);
    await USDbContract.connect(owner).setBalance(addr2.address, 100 * USDb_DECIMALS);

    expect(await ETHContract.balanceOf(addr1.address)).to.equal(1 * ETH_DECIMALS);
    expect(await ETHContract.balanceOf(addr2.address)).to.equal(1 * ETH_DECIMALS);
    expect(await USDbContract.balanceOf(addr1.address)).to.equal(100 * USDb_DECIMALS);
    expect(await USDbContract.balanceOf(addr2.address)).to.equal(100 * USDb_DECIMALS);
  });

  // ! when testing, check in the following order:
  // ETH (sell) - addr1
  // USDb (buy) - addr1
  // ETH (sell) - addr2
  // USDb (buy) - addr2
  // getPVobs
  // getDeposits 
  // activeSellOrders
  // activeBuyOrders
  // getAllSellOrders
  // Orderbook

  it ("Fully match a sell order", async function () {
    //             SELL 
    //     PRICE (USD)   AMOUNT
    //     --------------------
    //     50                 2     <--buy(2)--

    const { owner, addr1, addr2, ETHContract, USDbContract, ExchangeContract } = await coinsAndFactory;
  
    // place the sell order
    const sellPrice = convertToCents(50); // 50 USD
    let sellAmount = 0.2 * ETH_DECIMALS;
    // Order size is 10 USD = $50 * 0.2 ETH

    // initialise price-volume node
    // this is done once per price in some exchange contract
    await ExchangeContract.connect(owner).initPVnode(sellPrice); 
    const indexOfPrice50 = String(await ExchangeContract.getIndexOfPrice(sellPrice));

    await ExchangeContract.connect(addr1).newSellOrder(sellPrice, sellAmount, indexOfPrice50);
    expect(await ETHContract.balanceOf(addr1.address)).to.equal(1 * ETH_DECIMALS - sellAmount);
    expect(await USDbContract.balanceOf(addr1.address)).to.equal(100 * USDb_DECIMALS);

    // calculate the sellAmount after deducting the exact sellAmount from our balance
    const sellAmountAfterFee = calculateAfterFee(sellAmount);

    let PVobs50 = String(await ExchangeContract.getPVobs())
    expect(PVobs50).to.equal(`${sellPrice},${sellAmountAfterFee},${convertToCents(50)},0`);

    expect(await ExchangeContract.getDeposits(addr1.address, ETHContract.address)).to.equal(sellAmountAfterFee);
    expect(await ExchangeContract.getDeposits(addr1.address, USDbContract.address)).to.equal(0);

    let activeSellOrdersByAddr1 = await ExchangeContract.connect(addr1).activeSellOrders();

    expect((await ExchangeContract.getAllSellOrders(sellPrice)).length).to.equal(1);
    expect((await ExchangeContract.getAllBuyOrders(sellPrice)).length).to.equal(0);

    expect((await ExchangeContract.orderBook(ETHContract.address, sellPrice))._length).to.equal(1);
    expect((await ExchangeContract.orderBook(ETHContract.address, sellPrice)).head).to.equal(activeSellOrdersByAddr1[0][0]);
    expect((await ExchangeContract.orderBook(ETHContract.address, sellPrice)).tail).to.equal(activeSellOrdersByAddr1[0][0]);
    expect((await ExchangeContract.orderBook(USDbContract.address, convertToCents(50)))._length).to.equal(0);
    expect((await ExchangeContract.orderBook(USDbContract.address, convertToCents(50))).head).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    expect((await ExchangeContract.orderBook(USDbContract.address, convertToCents(50))).tail).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");

    // place the buy order
    const buyPrice = convertToCents(50);
    const buyAmount = 0.2 * ETH_DECIMALS;
    const buyAmountAfterFee = calculateAfterFee(buyAmount);

    await ExchangeContract.connect(addr2).newBuyOrder(buyPrice, buyAmount, 0);

    expect(await ETHContract.balanceOf(addr1.address)).to.equal(1 * ETH_DECIMALS - sellAmount); // sent
    expect(await USDbContract.balanceOf(addr1.address)).to.equal(100 * USDb_DECIMALS + convertToDecimal(buyPrice) * buyAmountAfterFee); // received
    expect(await ETHContract.balanceOf(addr2.address)).to.equal(1 * ETH_DECIMALS + buyAmountAfterFee); // received
    expect(await USDbContract.balanceOf(addr2.address)).to.equal(100 * USDb_DECIMALS - convertToDecimal(buyPrice) * buyAmount); // sent
    // console.log("addr1 ETH balance: ", parseInt(await ETHContract.balanceOf(addr1.address))/ETH_DECIMALS)
    // console.log("addr1 USDb balance: ", parseInt(await USDbContract.balanceOf(addr1.address))/ETH_DECIMALS)
    // console.log("addr2 ETH balance: ", parseInt(await ETHContract.balanceOf(addr2.address))/ETH_DECIMALS)
    // console.log("addr2 USDb balance: ", parseInt(await USDbContract.balanceOf(addr2.address))/ETH_DECIMALS)

    PVobs50 = String(await ExchangeContract.getPVobs())
    expect(PVobs50).to.equal(`${sellPrice},${sellAmountAfterFee - buyAmountAfterFee},${buyPrice},${buyAmountAfterFee - sellAmountAfterFee}`)

    expect(await ExchangeContract.getDeposits(addr1.address, ETHContract.address)).to.equal(sellAmountAfterFee - buyAmountAfterFee);
    expect(await ExchangeContract.getDeposits(addr1.address, USDbContract.address)).to.equal(0);
    expect(await ExchangeContract.getDeposits(addr2.address, ETHContract.address)).to.equal(0);
    expect(await ExchangeContract.getDeposits(addr2.address, USDbContract.address)).to.equal(0);

    expect(String(await ExchangeContract.connect(addr1).activeSellOrders())).to.equal('');
    expect(String(await ExchangeContract.connect(addr1).activeBuyOrders())).to.equal('');
    expect(String(await ExchangeContract.connect(addr2).activeSellOrders())).to.equal('');
    expect(String(await ExchangeContract.connect(addr2).activeBuyOrders())).to.equal('');

    expect((await ExchangeContract.getAllSellOrders(sellPrice)).length).to.equal(0);
    expect((await ExchangeContract.getAllBuyOrders(sellPrice)).length).to.equal(0);

    expect((await ExchangeContract.orderBook(ETHContract.address, sellPrice))._length).to.equal(0);
    expect((await ExchangeContract.orderBook(ETHContract.address, sellPrice)).head).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    // the tail points to the last order if the head is empty
    // expect((await ExchangeContract.orderBook(ETHContract.address, sellPrice)).tail).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    expect((await ExchangeContract.orderBook(USDbContract.address, buyPrice))._length).to.equal(0);
    expect((await ExchangeContract.orderBook(USDbContract.address, buyPrice)).head).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    expect((await ExchangeContract.orderBook(USDbContract.address, buyPrice)).tail).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
  })

})
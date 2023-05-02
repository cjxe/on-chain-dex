// Variables
let userAddress, provider, signer;
let inputFlag;
let ExchangeABI, ExchangeContract;
let AggregatorV3InterfaceABI, EthereumPriceOracleContract;
let USDbABI, USDbContract, USDbWithSigner;
let ETHABI, ETHContract, ETHWithSigner;


// Elements
const connectWalletButton = document.getElementById("button-connect-wallet");
const ethSize = document.getElementById('eth-size');
const usdSize = document.getElementById('usd-size');
const limitPrice = document.getElementById('limit-price');
const feeValue = document.getElementById('fee-value');
const totalValue = document.getElementById('total-value');
const buyButton = document.getElementById('buy-button');
const sellButton = document.getElementById('sell-button');
const blockNumberValue = document.getElementById('block-number-value');
const pairWrapperDiv = document.querySelector('.left');


// Event listeners
document.addEventListener("DOMContentLoaded", onLoad);
connectWalletButton.addEventListener('click', connectWithMetamask);
ethSize.addEventListener('input', ethInputHandler);
usdSize.addEventListener('input', usdInputHandler);
limitPrice.addEventListener('input', limitInputHandler);
buyButton.addEventListener('mouseover', buyMouseoverHandler);
buyButton.addEventListener('mouseleave', buyMouseleaveHandler);
buyButton.addEventListener('click', buyHandler);
sellButton.addEventListener('mouseover', sellMouseoverHandler);
sellButton.addEventListener('mouseleave', sellMouseleaveHandler);
sellButton.addEventListener('click', sellHandler);
pairWrapperDiv.addEventListener('click', pairWrapperHandler);
ethereum.on('accountsChanged', () => location.reload());
ethereum.on('chainChanged', () => location.reload());


// Functions
/**
 * Function that loads after DOM content is loaded.
 * - Checks if MM is installed.
 * - If wallet is already connected, loads user address. 
 */
async function onLoad() {
  if (typeof window.ethereum !== 'undefined') {
    console.log('MetaMask is installed.');
    provider = new ethers.providers.Web3Provider(window.ethereum);
    const connected = await isMetamaskConnected();
    if (connected) {
      showAddress();
      signer = provider.getSigner();
      isSepolia();

      // init Exchange contract
      ExchangeABI = await fetch('./abi/Exchange_ABI.json');
      ExchangeABI = await ExchangeABI.json();
      ExchangeContract = new ethers.Contract('0xA11aC55dca0f39fF51eEc03A6E63A3De34B13f7B', ExchangeABI, provider);
      ExchangeContractWithSigner = ExchangeContract.connect(signer);

      // init Price oracle contract
      AggregatorV3InterfaceABI = await fetch('./abi/AggregatorV3Interface_ABI.json');
      AggregatorV3InterfaceABI = await AggregatorV3InterfaceABI.json();
      EthereumPriceOracleContract = new ethers.Contract('0x8A753747A1Fa494EC906cE90E9f37563A8AF630e', AggregatorV3InterfaceABI, provider);

      // check if USDb is approved
      USDbABI = await fetch('./abi/USDb_ABI.json');
      USDbABI = await USDbABI.json();
      USDbContract = new ethers.Contract('0xc4FcD839C4C584684e346dBfE1ed2817f8A7bCF7', USDbABI, provider);
      USDbWithSigner = USDbContract.connect(signer);
      const canSpendUSDb = await userCanSpendUSDb();
      await initApproveBuyButton(canSpendUSDb);

      // check if ETH is approved
      ETHABI = await fetch('./abi/USDb_ABI.json');
      ETHABI = await ETHABI.json();
      ETHContract = new ethers.Contract('0x5234D63caF31AF1871f40D77C47E7744DF732336', ETHABI, provider);
      ETHWithSigner = ETHContract.connect(signer);
      const canSpendETH = await userCanSpendETH();
      await initApproveSellButton(canSpendETH);
    }

    provider.on('block', async (blockNumber) => {
      console.log(blockNumber);
      updateBlockNumber(blockNumber);
      if (!connected) {
        disableUserInput();
        return false;
      }

      // fetch and update the order book (OB)
      let orderbooks = await fetchOB();
      updateOB(orderbooks[0], orderbooks[1]);
      updateActiveOrders();
      updatePriceOracle();
    });

  } else {
    disableUserInput();
    toastr["error"](`<a href='https://metamask.io/' target="_blank">Please install MetaMask by clicking here</a>`, "MetaMask is not installed");
  }
}

/**
 * Checks if metamask is already connected to the website.
 * @return {boolean}
 */
async function isMetamaskConnected() {
  const accounts = await provider.listAccounts();
  return accounts.length > 0;
}

/**
 * Checks if MM's network is Sepolia.
 * @return {boolean}
 */
async function isSepolia() {
  const network = await provider.getNetwork();
  if (network.chainId != 11155111) {
    toastr["error"](`Please switch the nework to "Sepolia Test Network".`, "Wrong network");
    return false;
  }
  return true;
}

/**
 * Launches a MetaMask popup to allow users to connect their wallet.
 */
async function connectWithMetamask() {
  const connectedToSepolia = await isSepolia();
  if (!connectedToSepolia) {
    return false;
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  userAddress = accounts[0];
  showAddress();
}

/**
 * Replaces the text of "Connect wallet" to user's address.
 */
async function showAddress() {
  const accounts = await provider.listAccounts();
  userAddress = accounts[0];
  connectWalletButton.innerHTML = userAddress.slice(0, 4) + '...' + userAddress.slice(userAddress.length - 5, userAddress.length - 1);
}

/**
 * Updates #usd-size after a change in #eth-size.
 * A flag named `inputFlag` helps #limit-price change when input event fires.
 */
function ethInputHandler() {
  inputValidator(ethSize, 3);
  inputFlag = 'eth';
  if (!(Number(limitPrice.value) > 0) && (Number(usdSize.value) > 0)) {
    usdSize.value = '';
  } else if (Number(limitPrice.value) > 0) {
    let usdValue = Number(ethSize.value) * Number(limitPrice.value);
    usdValue = Math.round(usdValue * 100)/100;
    usdSize.value = usdValue;
  }
}

/**
 * Updates #eth-size after a change in #usd-size.
 * A flag named `inputFlag` helps #limit-price change when input event fires.
 */
function usdInputHandler() {
  inputValidator(usdSize, 2);
  inputFlag = 'usd';
  if (!(Number(limitPrice.value) > 0) && (Number(ethSize.value) > 0)) {
    ethSize.value = '';
  } else if (Number(limitPrice.value) > 0) {
    let ethValue = Number(usdSize.value) / Number(limitPrice.value)
    ethValue = Math.round(ethValue * 1000)/1000;
    ethSize.value = ethValue;
  }
}

/**
 * Updates #eth-size OR #usd-size depending on `inputFlag`.
 */
function limitInputHandler() {
  inputValidator(limitPrice, 2);
  if (inputFlag == 'eth') {
    let usdValue = Number(ethSize.value) * Number(limitPrice.value);
    usdValue = Math.round(usdValue * 100)/100;
    usdSize.value = usdValue;
  } else if (inputFlag == 'usd') {
    let ethValue = Number(usdSize.value) / Number(limitPrice.value)
    ethValue = Math.round(ethValue * 1000)/1000;
    ethSize.value = ethValue;
  }
}

/**
 * When #buy-button is hovered, #fee-value and #total-value gets updated.
 * Dependent on #usd-size
 */
function buyMouseoverHandler() {
  if (Number(limitPrice.value) > 0 && (Number(ethSize.value) > 0)) {
    const fee = Math.round(usdSize.value * 1)/1000;
    if (usdSize.value < 1) {
      feeValue.innerHTML = '<0.001' + ' USD';
    } else {
      feeValue.innerHTML = fee.toLocaleString() + ' USD';
    }
    const total = usdSize.value - fee;
    totalValue.innerHTML = total.toLocaleString() + ' USD';
  }
}

/**
 * When #sell-button is hovered, #fee-value and #total-value gets updated.
 * Dependent on #eth-size
 */
function sellMouseoverHandler() {
  if (Number(limitPrice.value) > 0 && (Number(ethSize.value) > 0)) {
    const fee = (ethSize.value * 1)/1000;
    if (ethSize.value <= 0.1) {
      feeValue.innerHTML = '<0.001' + ' ETH';
    } else {
      feeValue.innerHTML = fee.toLocaleString() + ' ETH';
    } 
    const total = ethSize.value - fee;
    totalValue.innerHTML = total.toLocaleString() + ' ETH';
  }
}

/**
 * Resets #fee-value and #total-value once mouse is no longer hovering 
 * #buy-button.
 */
function buyMouseleaveHandler() {
  feeValue.innerHTML = 'Hover over a button';
  totalValue.innerHTML = '-';
}

/**
 * Resets #fee-value and #total-value once mouse is no longer hovering 
 * #sell-button.
 */
function sellMouseleaveHandler() {
  feeValue.innerHTML = 'Hover over a button';
  totalValue.innerHTML = '-';
}

/**
 * Updates #block-number-value once new block is fetched.
 * @param {Number} blockNumber: Current block number.
 */
function updateBlockNumber(blockNumber) {
  blockNumberValue.innerHTML = blockNumber;
}

/**
 * Fetches `sellOB` and `buyOB` using the Exchange contract.
 */
async function fetchOB() {
  const orderbooks = await ExchangeContract.getPVobs();
  return orderbooks;
}

/**
 * Creates an order book (OB) row that has price and an order size.
 * @param {Number} price: Buy or sell price of the row.
 * @param {Number} orderSize: The corresponding order size for a price.
 * @returns {Element}: A <div> that is a row.
 */
function initOBRow(price, orderSize, side) {
  let rowDiv = document.createElement("div");
  rowDiv.classList.add('row');

  let priceDiv = document.createElement("div");
  priceDiv.classList.add('price');
  priceDiv.innerHTML = (price/100).toFixed(2);
  rowDiv.addEventListener('click', () => {
    limitPrice.value = priceDiv.innerHTML;
    limitInputHandler();
  });

  let orderSizeDiv = document.createElement("div");
  orderSizeDiv.classList.add('order-size');
  orderSize = orderSize/1000000
  if (side == 'sell') {
    if (orderSize < 0.001) { 
      orderSizeDiv.innerHTML = '<0.001';
    } else {
      orderSizeDiv.innerHTML = Math.trunc(orderSize*1000)/1000;
    }
  } else if (side == 'buy') {
    if (orderSize/price*100 < 0.001) {
      orderSizeDiv.innerHTML = '<0.001';
    } else {
      orderSizeDiv.innerHTML = Math.trunc(orderSize/price*100*1000)/1000;
    }
  }
  
  rowDiv.appendChild(priceDiv);
  rowDiv.appendChild(orderSizeDiv);

  return rowDiv;
}

/**
 * Creates an order book (OB) mid row where row has the value spread.
 * @param {Number} spread: Difference of highest buy and lowest sell.
 * @returns {Element}: A <div> that is the mid row.
 */
function initOBMidBar(spread) {
  let midBarDiv = document.createElement("div");
  midBarDiv.classList.add('mid-bar', 'header-cell-vertical');

  let spreadDiv = document.createElement("div");
  spreadDiv.classList.add('one');
  spreadDiv.innerHTML = spread;
  
  let textDiv = document.createElement("div");
  textDiv.classList.add('two');
  textDiv.innerHTML = 'Spread';

  midBarDiv.appendChild(spreadDiv);
  midBarDiv.appendChild(textDiv);

  return midBarDiv;
}

/**
 * Updates the order book (OB) by creating buy, mid, sell rows and replacing
 * the previous order book main component.
 * @param {Array} sellOB: An array where each element has a price {Number} and
 *  an order size {Number}.
 * @param {Array} sellOB: An array where each element has a price {Number} and
 *  an order size {Number}.
 */
function updateOB(sellOB, buyOB) {
  // init main component
  let OBDiv = document.createElement("div");
  OBDiv.classList.add('main');
  OBDiv.id = 'ob-table';

  // init sellOB
  let sellOBDiv = document.createElement("div");
  sellOBDiv.classList.add('sell-ob', 'sell-price');
  let lowestSellPrice = Number.MAX_VALUE;

  // init buyOB
  let buyOBDiv = document.createElement("div");
  buyOBDiv.classList.add('buy-ob', 'buy-price');
  let highestBuyPrice = -Number.MAX_VALUE;

  // order sellOB and buyOB by price
  let sellOBarr = [], buyOBarr = [];
  for (let i=0; i<sellOB.length; i++) {
    if (sellOB[i][1] > 0) {
      sellOBarr.push({'price': sellOB[i][0], 'size': sellOB[i][1]});
      // update lowestPrice
      if (lowestSellPrice > sellOB[i][0]) {
        lowestSellPrice = sellOB[i][0];
      }
    }
    if (buyOB[i][1] > 0) {
      buyOBarr.push({'price': buyOB[i][0], 'size': buyOB[i][1]});
      if (highestBuyPrice < buyOB[i][0]) {
        highestBuyPrice = buyOB[i][0];
      }
    }
  }
  
  // max # to show is 20
  sellOBarr.sort(sortByPriceAsc);
  sellOBarr = sellOBarr.slice(0, 20)
  buyOBarr.sort(sortByPriceDes);
  buyOBarr = buyOBarr.slice(0, 20)

  // build final buyOB and sellOB
  for (let i=0; i<sellOBarr.length; i++) {
    sellOBDiv.appendChild(initOBRow(sellOBarr[i].price, sellOBarr[i].size, 'sell'));
  }

  for (let i=0; i<buyOBarr.length; i++) {
    
    buyOBDiv.appendChild(initOBRow(buyOBarr[i].price, buyOBarr[i].size, 'buy'));
  }

  // init spread bar
  let spread;
  if ((highestBuyPrice == -Number.MAX_VALUE) || (lowestSellPrice == Number.MAX_VALUE)) {
    spread = '-';
  } else {
    spread = (lowestSellPrice - highestBuyPrice)/100;
  }
  const midBarDiv = initOBMidBar(spread);

  OBDiv.appendChild(sellOBDiv);
  OBDiv.appendChild(midBarDiv);
  OBDiv.appendChild(buyOBDiv);

  let obTable = document.getElementById('ob-table');
  const parentDiv = obTable.parentNode;

  parentDiv.replaceChild(OBDiv, obTable);
}

/**
 * Creates an buy-row that has a side (BUY/SELL), Price (USD), Size (ETH), 
 * Total value (USD) and an action to cancel the order.
 * @param {Array} order: [txHash, price, size]
 * @param {String} side: 'buy' or 'sell'
 * @returns {Element}: A <div> that is a buy-row.
 */
async function initActiveOrderRow(order, side, priceIdx) {
  let rowDiv = document.createElement("div");
  rowDiv.classList.add('row', 'value-cell-vertical');

  let sideDiv = document.createElement("div");
  if (side == 'buy') {
    sideDiv.classList.add('buy-side', 'one');
    sideDiv.innerHTML = 'BUY';
  } else if (side == 'sell') {
    sideDiv.classList.add('sell-side', 'one');
    sideDiv.innerHTML = 'SELL';
  }

  let priceDiv = document.createElement("div");
  priceDiv.classList.add('two');
  const price = (order[1]/100).toFixed(2);
  priceDiv.innerHTML = price;

  let sizeDiv = document.createElement("div");
  sizeDiv.classList.add('three');
  const actualSize = (parseInt(order[2]._hex, 16)/1000000);
  const size = Math.trunc((parseInt(order[2]._hex, 16)/1000000)*1000)/1000;
  if (side == 'buy') {
    if ((parseInt(order[2]._hex, 16)/price) < 1000) {
      sizeDiv.innerHTML = '<0.001';
    } else {
      sizeDiv.innerHTML = Math.trunc(actualSize/price*1000)/1000;
    }
  } else if (side == 'sell') {
    if (parseInt(order[2]._hex, 16) < 1000) {
      sizeDiv.innerHTML = '<0.001';
    } else {
      sizeDiv.innerHTML = size;
    }
  }
  
  let valueDiv = document.createElement("div");
  valueDiv.classList.add('four');
  if (side == 'buy') {
    if (actualSize < 0.01) {
      valueDiv.innerHTML = '<0.01';
    } else {
      valueDiv.innerHTML = Math.trunc(actualSize*100)/100;
    }
  } else if (side == 'sell') {
    if ((price * actualSize) < 0.01) {
      valueDiv.innerHTML = '<0.01';
    } else {
      valueDiv.innerHTML = Math.trunc(price * actualSize*100)/100;
    }
  }

  // cancel button
  let actionDiv = document.createElement("div");
  actionDiv.classList.add('five');
  let cancelButton = document.createElement("button");
  cancelButton.classList.add('sell-price', 'cancel-button');
  cancelButton.innerHTML = 'Cancel';
  if (side == 'buy') {
    cancelButton.addEventListener('click', async () => {
      const tx = await ExchangeContractWithSigner.deleteBuyOrder(order[1], order[0], priceIdx);
      toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Cancelling the buy order...");
      const receipt = await tx.wait();
      if (receipt.status == 1) {
        toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Successfully cancelled the buy order");
      } else {
        toastr["error"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Failed to cancel the buy order");
      }
    });
  } else if (side == 'sell') {
    cancelButton.addEventListener('click', async () => {
      const tx = await ExchangeContractWithSigner.deleteSellOrder(order[1], order[0], priceIdx);
      toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Cancelling the sell order...");
      const receipt = await tx.wait();
      if (receipt.status == 1) {
        toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Successfully cancelled the sell order");
      } else {
        toastr["error"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Failed to cancel the sell order");
      }
    });
  }

  actionDiv.appendChild(cancelButton);

  rowDiv.appendChild(sideDiv);
  rowDiv.appendChild(priceDiv);
  rowDiv.appendChild(sizeDiv);
  rowDiv.appendChild(valueDiv);
  rowDiv.appendChild(actionDiv);

  return rowDiv;
}

/**
 * Updates 'active orders' by creating new rows and replacing the current 
 * table with the newly created one.
 */
async function updateActiveOrders() {
  const activeBuyOrders = await ExchangeContract.activeBuyOrders({from:userAddress});
  const activeSellOrders = await ExchangeContract.activeSellOrders({from:userAddress});

  // get priceIdx
  const orderbooks = await fetchOB();
  const orderbook = orderbooks[0];
  let priceIdx;

  // init main component
  let mainDiv = document.createElement("div");
  mainDiv.id = 'active-orders-main';

  for (let i=0; i<activeBuyOrders.length; i++) {
    for (let j=0; j<orderbook.length; j++) {
      if (orderbook[j][0] == activeBuyOrders[i][1]) {
        priceIdx = j;
        break;
      };
    }
    mainDiv.appendChild(await initActiveOrderRow(activeBuyOrders[i], 'buy', priceIdx));
  }

  for (let i=0; i<activeSellOrders.length; i++) {
    for (let j=0; j<orderbook.length; j++) {
      if (orderbook[j][0] == activeSellOrders[i][1]) {
        priceIdx = j;
        break;
      };
    }
    mainDiv.appendChild(await initActiveOrderRow(activeSellOrders[i], 'sell', priceIdx));
  }

  let currentTable = document.getElementById('active-orders-main');
  const parentDiv = currentTable.parentNode;

  parentDiv.replaceChild(mainDiv, currentTable);
}

/**
 * Updates the price oracle using 'Chainlik Ethereum Data Feeds':
 * https://docs.chain.link/docs/ethereum-addresses/
 */
async function updatePriceOracle() {
  const priceOracleValue = document.getElementById('price-oracle-value');
  priceOracleValue.innerHTML = '$' + (parseInt((await EthereumPriceOracleContract.latestAnswer())._hex, 16)/100000000).toFixed(2);
}

/**
 * Check if Exchange contract can spend user address's USDb
 * @returns {boolean}
 */
async function userCanSpendUSDb() {
  const allowance = parseInt((await USDbContract.getAllowance(userAddress, '0xA11aC55dca0f39fF51eEc03A6E63A3De34B13f7B'))._hex, 16);
  if (allowance > 1000000000000) return true;
  return false;
}

/**
 * Initialise "Approve USDb" button
 * @param {boolean} userCanSpend: true if Exchange contract can spend USDb
 */
async function initApproveBuyButton(userCanSpend) {
  if (userCanSpend) return;
  buyButton.innerHTML = 'Approve USDb';
  buyButton.addEventListener('click', approveUSD);
}

/**
 * Make the approve-usdb-button ready to make a write call for Exchange 
 *  contract to be able to spend user's USDb.
 */
async function approveUSD() {
  const tx = await USDbWithSigner.approve('0xA11aC55dca0f39fF51eEc03A6E63A3De34B13f7B', '115792089237316195423570985008687907853269984665640564039457584007913129639935');
  buyButton.innerHTML = 'Approving...';
  toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Approving USDb...");
  const receipt = await tx.wait();
  if (receipt.status == 1) {
    toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Successfully approved USDb");
    buyButton.innerHTML = 'Buy ETH';
    buyButton.removeEventListener('click', approveUSD);
  } else {
    toastr["error"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Failed to approve USDb");
  }
}

/**
 * Check if Exchange contract can spend user address's ETH
 * @returns {boolean}
 */
async function userCanSpendETH() {
  const allowance = parseInt((await USDbContract.getAllowance(userAddress, '0xA11aC55dca0f39fF51eEc03A6E63A3De34B13f7B'))._hex, 16);
  if (allowance > 1000000000000) return true;
  return false;
}

/**
 * Initialise "Approve ETH" button
 * @param {boolean} userCanSpend: true if Exchange contract can spend ETH
 */
async function initApproveSellButton(userCanSpend) {
  if (userCanSpend) return;
  sellButton.innerHTML = 'Approve ETH';
  sellButton.addEventListener('click', approveETH);
}

/**
 * Make the approve-eth-button ready to make a write call for Exchange 
 *  contract to be able to spend user's ETH.
 */
async function approveETH() {
  const tx = await ETHWithSigner.approve('0xA11aC55dca0f39fF51eEc03A6E63A3De34B13f7B', '115792089237316195423570985008687907853269984665640564039457584007913129639935');
  sellButton.innerHTML = 'Approving...';
  toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Approving ETH...");
  const receipt = await tx.wait();
  if (receipt.status == 1) {
    toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Successfully approved ETH");
    sellButton.innerHTML = 'Sell ETH';
    sellButton.removeEventListener('click', approveETH);
  } else {
    toastr["error"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Failed to approve ETH");
  }
}

/**
 * Fires when wallet is not connected. 
 * Disables: input, button
 */
function disableUserInput() {
  var buttons = document.getElementsByTagName("button");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].disabled = true;
  }
  connectWalletButton.disabled = false;
  ethSize.disabled = true;
  usdSize.disabled = true;
  limitPrice.disabled = true;
  feeValue.innerHTML = '-';
}

/**
 * Makes a new buy order.
 * Checks if PVnode for that price exist; if not, creates one. 
 */
async function buyHandler() {
  // validation
  if (ethSize.value == '' || usdSize.value == '' || limitPrice.value == '') return false;
  if (ethSize.value < 0.002) {
    toastr["error"](`Min. buy size is 0.002 ETH`, "ETH buy amount is too small");
    return false;
  }

  // check if PVnode for the limit price already exist
  const orderbooks = await fetchOB();
  const orderbook = orderbooks[0];
  let index;
  let _limitPrice = Math.round(limitPrice.value*100);
  let doesPVnodeExist = false;
  for (let i=0; i<orderbook.length; i++) {
    if (orderbook[i][0] == _limitPrice) {
      doesPVnodeExist = true;
      index = i;
      break;
    };
  }

  if (!doesPVnodeExist) {
    const tx = await ExchangeContractWithSigner.initPVnode(_limitPrice);
    buyButton.innerHTML = 'Loading...';
    toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a></br> This is needed when an order for this price has never been placed.`, "Initialising a price index...");
    await tx.wait();
    toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a></br> Please confirm the second transaction. This is for placing the order.`, "Successfully initialised a price node");
    buyButton.innerHTML = 'Please confirm again';
    index = orderbook.length;
  }

  // make new buy order
  const tx = await ExchangeContractWithSigner.newBuyOrder(_limitPrice, ethSize.value * 1000000,index);
  buyMouseoverHandler();
  buyButton.innerHTML = 'Buy ETH';
  toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Placing a new buy order...");
  const receipt = await tx.wait();
  buyMouseleaveHandler();
  if (receipt.status == 1) {
    toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Successfully placed a new buy order");
  } else {
    toastr["error"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Failed to place a new buy order");
  }
}

/**
 * Makes a new sell order.
 * Checks if PVnode for that price exist; if not, creates one. 
 */
async function sellHandler() {
  // validation
  if (ethSize.value == '' || usdSize.value == '' || limitPrice.value == '') return false;
  if (ethSize.value < 0.002) {
    toastr["error"](`Min. sell size is 0.002 ETH`, "ETH sell amount is too small");
    return false;
  }
  
  // check if PVnode for the limit price already exist
  const orderbooks = await fetchOB();
  const orderbook = orderbooks[0];
  let index;
  let _limitPrice = Math.round(limitPrice.value*100);
  let doesPVnodeExist = false;
  for (let i=0; i<orderbook.length; i++) {
    if (orderbook[i][0] == _limitPrice) {
      doesPVnodeExist = true;
      index = i;
      break;
    };
  }

  if (!doesPVnodeExist) {
    const tx = await ExchangeContractWithSigner.initPVnode(_limitPrice);
    sellButton.innerHTML = 'Loading...';
    toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a></br> This is needed when an order for this price has never been placed.`, "Initialising a price index...");
    await tx.wait();
    toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a></br> Please confirm the second transaction. This is for placing the order.`, "Successfully initialised a price node");
    sellButton.innerHTML = 'Please confirm again';
    index = orderbook.length;
  }

  // make new sell order
  const tx = await ExchangeContractWithSigner.newSellOrder(_limitPrice, ethSize.value * 1000000, index);
  sellMouseoverHandler();
  sellButton.innerHTML = 'Sell ETH';
  toastr["info"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Placing a new sell order...");
  const receipt = await tx.wait();
  sellMouseleaveHandler();
  if (receipt.status == 1) {
    toastr["success"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Successfully placed a new sell order");
  } else {
    toastr["error"](`<a href='https://sepolia.etherscan.io/tx/${tx.hash}' target="_blank">Click here for the etherscan link</a>`, "Failed to place a new sell order");
  }
}

/**
 * Activated when a "select a market" dropdown is clicked. 
 * TODO:
 * - [ ] Dropdown box
 */
function pairWrapperHandler() {
  toastr["warning"](``, "More markets are coming soon");
}

/**
 * Validates size and limit price inputs. Makes sure the decimal point is
 *  restricted to a certain length.
 * @param {Node.ELEMENT_NODE} inputElement: Input element which is validated.
 * @param {Number} numOfDecimalPoints: Number of decimal points to show.
 */
function inputValidator(inputElement, numOfDecimalPoints) {
  let t = inputElement.value;
  inputElement.value = (t.indexOf(".") >= 0) ? (t.substr(0, t.indexOf(".")) + t.substr(t.indexOf("."), numOfDecimalPoints + 1)) : t;
  t = inputElement.value;
  inputElement.value = (t.indexOf(",") >= 0) ? (t.substr(0, t.indexOf(",")) + t.substr(t.indexOf(","), numOfDecimalPoints + 1)) : t;
}

/**
 * Sorts array of objects both by ascending and descending order.
 * https://stackoverflow.com/a/979278/12959962
 * @param {Object} a: First object element of the array.
 * @param {Object} b: Second object element of the array.
 */
function sortByPriceAsc(a, b) {
  return parseFloat(a.price) - parseFloat(b.price);
}
function sortByPriceDes(a, b) {
  return parseFloat(b.price) - parseFloat(a.price);
}

toastr.options = {
  "closeButton": true,
  "debug": false,
  "newestOnTop": false,
  "progressBar": true,
  "positionClass": "toast-bottom-right",
  "preventDuplicates": false,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}
// Variables
let userAddress;
let provider;
let inputFlag;
let ExchangeCAddress;
let ExchangeABI;

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

// Event listeners
document.addEventListener("DOMContentLoaded", onLoad);
connectWalletButton.addEventListener('click', connectWithMetamask);
ethSize.addEventListener('input', ethInputHandler);
usdSize.addEventListener('input', usdInputHandler);
limitPrice.addEventListener('input', limitInputHandler);
buyButton.addEventListener('mouseover', buyMouseoverHandler);
buyButton.addEventListener('mouseleave', buyMouseleaveHandler);
sellButton.addEventListener('mouseover', sellMouseoverHandler);
sellButton.addEventListener('mouseleave', sellMouseleaveHandler);


// Functions
/**
 * Function that loads after DOM content is loaded.
 * - Checks if MM is installed.
 * - If wallet is already connected, loads user address. 
 */
async function onLoad() {
  if (typeof window.ethereum !== 'undefined') {
    console.log('MetaMask is installed.');
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const connected = await isMetamaskConnected();
    if (connected) {
      showAddress();
      isRinkeby();

      ExchangeABI = await fetch('./abi/Exchange_ABI.json');
      ExchangeABI = await ExchangeABI.json();
      ExchangeCAddress = new ethers.Contract('0x049Dd1d63f5e8c90d92dc8AFa3CEa7403A8bEeF0', ExchangeABI, provider);

      // TODO
      // - [ ] check if tokenA is approved. If not: change button to approve tokenA
      // - [ ] check if tokenB is approved. Same as above for tokenB
      // load eth and usd balance as placeholder
    }

    provider.on('block', async (blockNumber) => {
      console.log(blockNumber);
      updateBlockNumber(blockNumber);

      // fetch and update the order book (OB)
      let orderbooks = await fetchOB();
      updateOB(orderbooks[0], orderbooks[1]);

      // fetch active orders
      
      // update price oracle
    });


  } else {
    alert('Please install MetaMask!');
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
 * Checks if MM's network is Rinkeby.
 * @return {boolean}
 */
async function isRinkeby() {
  const network = await provider.getNetwork();
  if (network.chainId != 4) {
    alert('Please switch the nework to "Rinkeby".')
    return false;
  }
  return true;
}

/**
 * Launches a MetaMask popup to allow users to connect their wallet.
 */
async function connectWithMetamask() {
  const connectedToRinkeby = await isRinkeby();
  if (!connectedToRinkeby) {
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
    const fee = Math.round(usdSize.value * 1)/100;
    const total = usdSize.value - fee;
    feeValue.innerHTML = fee.toLocaleString() + ' USD';
    totalValue.innerHTML = total.toLocaleString() + ' USD';
  }
}

/**
 * When #sell-button is hovered, #fee-value and #total-value gets updated.
 * Dependent on #eth-size
 */
function sellMouseoverHandler() {
  if (Number(limitPrice.value) > 0 && (Number(ethSize.value) > 0)) {
    const fee = Math.round(ethSize.value * 1)/1000;
    const total = ethSize.value - fee;
    feeValue.innerHTML = fee.toLocaleString() + ' ETH';
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
  const orderbooks = await ExchangeCAddress.getPVobs();
  return orderbooks;
}

/**
 * Creates an order book (OB) row that has price and an order size.
 * @param {Number} price: Buy or sell price of the row.
 * @param {Number} orderSize: The corresponding order size for a price.
 * @returns {Element}: A <div> that is a row.
 */
function initOBRow(price, orderSize) {
  let rowDiv = document.createElement("div");
  rowDiv.classList.add('row');

  let priceDiv = document.createElement("div");
  priceDiv.classList.add('price');
  priceDiv.innerHTML = (price/100).toFixed(2);

  let orderSizeDiv = document.createElement("div");
  orderSizeDiv.classList.add('order-size')
  orderSize = orderSize/1000000
  orderSizeDiv.innerHTML = Math.round(orderSize * 1000)/1000;

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

  for (let i=0; i<sellOB.length; i++) {
    if (sellOB[i][1] > 0) { // TODO, test this!
      sellOBDiv.appendChild(initOBRow(sellOB[i][0], sellOB[i][1]));
      // update lowestPrice
      if (lowestSellPrice > sellOB[i][0]) {
        lowestSellPrice = sellOB[i][0];
      }
    }
    if (buyOB[i][1] > 0) {
      buyOBDiv.appendChild(initOBRow(buyOB[i][0], buyOB[i][1]));
      if (highestBuyPrice < buyOB[i][0]) {
        highestBuyPrice = buyOB[i][0];
      }
    }
  }

  const midBarDiv = initOBMidBar((lowestSellPrice - highestBuyPrice)/100);

  OBDiv.appendChild(sellOBDiv);
  OBDiv.appendChild(midBarDiv);
  OBDiv.appendChild(buyOBDiv);

  let obTable = document.getElementById('ob-table');
  const parentDiv = obTable.parentNode;

  parentDiv.replaceChild(OBDiv, obTable);
}

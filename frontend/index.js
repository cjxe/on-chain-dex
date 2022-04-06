let userAddress;
let provider;
let inputFlag;

// Elements
const connectWalletButton = document.getElementById("button-connect-wallet");
const ethSize = document.getElementById('eth-size');
const usdSize = document.getElementById('usd-size');
const limitPrice = document.getElementById('limit-price');
const feeValue = document.getElementById('fee-value');
const totalValue = document.getElementById('total-value');
const buyButton = document.getElementById('buy-button');
const sellButton = document.getElementById('sell-button');

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
    }
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

function buyMouseoverHandler() {
  if (Number(limitPrice.value) > 0 && (Number(ethSize.value) > 0)) {
    const fee = Math.round(usdSize.value * 1)/1000;
    const total = usdSize.value - fee;
    feeValue.innerHTML = fee + ' USD';
    totalValue.innerHTML = total + ' USD';
  }
}

function sellMouseoverHandler() {
  if (Number(limitPrice.value) > 0 && (Number(ethSize.value) > 0)) {
    const fee = Math.round(ethSize.value * 1)/1000;
    const total = ethSize.value - fee;
    feeValue.innerHTML = fee + ' ETH';
    totalValue.innerHTML = total + ' ETH';
  }
}

function buyMouseleaveHandler() {
  feeValue.innerHTML = 'Hover on a button';
  totalValue.innerHTML = '-';
}

function sellMouseleaveHandler() {
  feeValue.innerHTML = 'Hover on a button';
  totalValue.innerHTML = '-';
}
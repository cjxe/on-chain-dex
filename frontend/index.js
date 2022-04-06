let userAddress;
let provider;

// Elements
const connectWalletButton = document.getElementById("button-connect-wallet");

// Event listeners
document.addEventListener("DOMContentLoaded", onLoad);
connectWalletButton.addEventListener('click', connectWithMetamask);

// Functions
/**
 * Function that loads after DOM content is loaded.
 * - Checks if MM is installed.
 * - If wallet is already connected, loads user address. 
 */
async function onLoad() {
  if (typeof window.ethereum !== 'undefined') {
    console.log('MetaMask is installed!');
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    const connected = isMetamaskConnected();
    if (connected) {
      const accounts = await provider.listAccounts();
      userAddress = accounts[0];
      showAddress();
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
 * Launches a MetaMask popup to allow users to connect their wallet.
 */
async function connectWithMetamask() {
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  userAddress = accounts[0];
  showAddress();
}

/**
 * Replaces the text of "Connect wallet" to user's address.
 */
function showAddress() {
  connectWalletButton.innerHTML = userAddress.slice(0, 4) + '...' + userAddress.slice(userAddress.length - 5, userAddress.length - 1);
}






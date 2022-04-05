// SPDX-License-Identifier: MIT
// og ethereum.org erc20 example: https://ethereum.org/en/developers/tutorials/understand-the-erc-20-token-smart-contract/
// opzensepling example: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.0.0/contracts/token/ERC20/ERC20.sol
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";

contract USDb is Ownable {
    string public constant name = "USD on the Blockcahin";
    string public constant symbol = "USDb";
    uint8 public constant decimals = 6;
    uint256 public totalSupply = 10000**decimals;

    mapping(address => uint256) balances;
    mapping(address => mapping(address => uint256)) allowances; // owner allows contract X to spend Y many tokens

    constructor() {
        // creator gets all the tokens
        balances[msg.sender] = totalSupply;
    }

    function setBalance(address tokenOwner, uint256 amount)
        public
        onlyOwner
        returns (bool)
    {
        totalSupply = totalSupply - balances[tokenOwner] + amount;
        balances[tokenOwner] = amount;
        return true;
    }

    function mint(address tokenOwner, uint256 amount)
        public
        onlyOwner
        returns (bool)
    {
        balances[tokenOwner] += amount;
        totalSupply += amount;
        return true;
    }

    function burn(address tokenOwner, uint256 amount)
        public
        onlyOwner
        returns (bool)
    {
        require(balances[tokenOwner] >= amount, "Burn amount exceeds balance.");
        balances[tokenOwner] -= amount;
        totalSupply -= amount;
        return true;
    }

    function balanceOf(address tokenOwner) public view returns (uint256) {
        return balances[tokenOwner];
    }

    // function transfer(address from, address to, uint256 amount) public {
    //     balances[from] -= amount;
    //     balances[to] += amount;
    // }
    // Problem 1: `from` is the person who calls the contract, aka `msg.sender`
    // Extra 1: Use `require()` for returning a custom error message (however it will increase the gas cost)
    // Extra 2: No need to use SafeMath methods (e.g., `add(x,y)`, `sub(x,y)`) since solidity 0.8< checks for integer overflow natively with 4 operations (+, -, /, *)
    // Extra 3: Why use returns(bool)? A: https://ethereum.stackexchange.com/a/57724/79733

    function transfer(address to, uint256 amount) public returns (bool) {
        require(
            amount <= balances[msg.sender],
            "Transfer amount exceeds balance."
        );
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }

    // Transfering from one wallet to another (without being the owner)
    // 1- Write a function that a wallet allows another wallet to spend X amount of the coin
    // 2- transfer from one wallet to another
    function approve(address delegate, uint256 amount) public returns (bool) {
        allowances[msg.sender][delegate] = amount;
        return true;
    }

    function getAllowance(address owner, address delegate)
        public
        view
        returns (uint256)
    {
        // ! don't gorget `view` since no state is modified
        return allowances[owner][delegate];
    }

    // spend as someone else
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public returns (bool) {
        require(amount <= balances[from], "Transfer amount exceeds balance.");
        // require(allowances[from][msg.sender] != 0)
        require(
            amount <= allowances[from][msg.sender],
            "Transfer amount exceeds allowance."
        );

        balances[from] -= amount;
        allowances[from][msg.sender] -= amount; // ! don't forget
        balances[to] += amount;
        return true;
    }
}

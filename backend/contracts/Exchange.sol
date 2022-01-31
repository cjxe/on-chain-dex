// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
// import "contracts/USDb.sol"; // instead of importing the contract, import the interface
import "contracts/IUSDb.sol";
import {LinkedListLib} from "contracts/LinkedList.sol";

contract Exchange is Ownable {
    // STORAGE
    address private tokenA = 0xd9145CCE52D386f254917e481eB44e9943F39138;
    address private tokenB = 0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8;
    mapping(address => uint256) reserves;
    mapping(address => mapping(address => uint256)) deposits; // addr A deposit B token, C many
    mapping(address => mapping(uint256 => uint256)) sellOrders; // addr A sell for B, C many
    mapping(address => mapping(uint256 => uint256)) buyOrders; // addr A buy for B, C many

    mapping(address => mapping(uint256 => LinkedListLib.LinkedList)) orderBook; // token A, price B, orders[seller, amount]

    function deposit(address tokenAddress, uint256 amount)
        private
        returns (bool)
    {
        // TODO:
        // - [ ] introduce how much of the pool you own
        // - [ ] make it internal

        require(
            tokenAddress == tokenA || tokenAddress == tokenB,
            "Deposited token is not in the pool."
        );

        // subtract token amount from depositer => this contract needs to get approved to spend
        // 1- approve that this contract can use invoker's tokenA/B
        // approve(address(this), amount); // this doesn't work because right now (with contract Exchange is USDb{...}) we
        // are making the Exchange contract have all the functions of USDb (making it USDb + anything in the Exchange contract).
        // In order to access the contract (without adding it to the current contract), we need some sort of API => interface of USDb.
        // IUSDb(tokenAddress).approve(address(this), 5); // caller is `this` contract, so this line is approving to itself.
        // Thus, approving must be done by calling the original USDb by us to say `this` contract can spend our USDb
        //
        // 2- call `transferFrom()`
        IUSDb(tokenAddress).transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][tokenAddress] += amount;
        reserves[tokenAddress] += amount;
        return true;
    }

    function withdraw(address tokenAddress, uint256 amount)
        private
        returns (bool)
    {
        require(
            tokenAddress == tokenA || tokenAddress == tokenB,
            "Withdrawn token is not in the pool."
        );
        require(
            deposits[msg.sender][tokenAddress] >= amount,
            "Withdraw amount exceeds deposited."
        );
        IUSDb(tokenAddress).transfer(msg.sender, amount);
        deposits[msg.sender][tokenAddress] -= amount;
        reserves[tokenAddress] -= amount;
        return true;
    }

    function getDeposits(address account, address tokenAddress)
        public
        view
        returns (uint256)
    {
        require(
            tokenAddress == tokenA || tokenAddress == tokenB,
            "Token is not in the pool."
        );
        return deposits[account][tokenAddress];
    }

    function getPrice() public view returns (uint256) {
        require(
            reserves[tokenA] != 0 && reserves[tokenB] != 0,
            "One token does not exist in the pool."
        );
        return (reserves[tokenA] / reserves[tokenB]);
    }

    function newSellOrder(uint256 price, uint256 amount) public returns (bool) {
        deposit(tokenA, amount);
        // TODO
        // check if buy order matches the price
        sellOrders[msg.sender][price] += amount;

        LinkedListLib.Order memory o;
        o.seller = msg.sender;
        o.amount = amount;

        // if no node, initHead
        if (orderBook[tokenA][price].length == 0) {
            LinkedListLib.initHead(
                orderBook[tokenA][price],
                o.seller,
                o.amount
            );
        } else {
            LinkedListLib.addNode(orderBook[tokenA][price], o.seller, o.amount);
        }

        return true;
    }

    function getSellOrders(uint256 price)
        public
        view
        returns (LinkedListLib.Order[] memory)
    {
        LinkedListLib.Order[] memory orders = new LinkedListLib.Order[](
            orderBook[tokenA][price].length
        );

        bytes32 currId = orderBook[tokenA][price].head;

        for (uint256 i = 0; i < orderBook[tokenA][price].length; i++) {
            orders[i] = orderBook[tokenA][price].nodes[currId].order;
            currId = orderBook[tokenA][price].nodes[currId].next;
        }
        return orders;
    }

    // temp func
    function isActiveSellOrder(uint256 price) public view returns (uint256) {
        return sellOrders[msg.sender][price];
    }

    // broken
    function deleteSellOrder(uint256 price) public returns (bool) {
        withdraw(tokenA, deposits[msg.sender][tokenA]);
        sellOrders[msg.sender][price] = 0;

        // TODO
        // - [ ] del from `orderBook`
        return true;
    }

    function newBuyOrder(uint256 price, uint256 amount) public returns (bool) {
        deposit(tokenB, price * amount);
        buyOrders[msg.sender][price] += price * amount; // - [ ] make edits on this

        uint256 len = orderBook[tokenA][price].length;
        for (uint8 i = 0; i < len; i++) {
            bytes32 head_ = orderBook[tokenA][price].head;
            uint256 sellAmount = orderBook[tokenA][price]
                .nodes[head_]
                .order
                .amount;

            if (amount == 0) {
                return true;
            } else if (sellAmount <= amount) {
                LinkedListLib.Order memory o = orderBook[tokenA][price]
                    .nodes[head_]
                    .order;
                LinkedListLib.popHead(orderBook[tokenA][price]);

                reserves[tokenA] -= o.amount;
                deposits[o.seller][tokenA] -= o.amount;
                IUSDb(tokenA).transfer(msg.sender, o.amount);
                IUSDb(tokenB).transfer(o.seller, price * o.amount);
                amount -= o.amount;
            } else if (sellAmount > amount) {
                LinkedListLib.Order memory o = orderBook[tokenA][price]
                    .nodes[head_]
                    .order;
                orderBook[tokenA][price].nodes[head_].order.amount -= amount;

                reserves[tokenA] -= amount;
                deposits[o.seller][tokenA] -= amount;
                IUSDb(tokenA).transfer(msg.sender, amount);
                IUSDb(tokenB).transfer(o.seller, price * amount);
                amount = 0;
            } else {
                // new buy order
            }
        }

        return true;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IUSDb.sol";
import {LinkedListLib} from "./LinkedList.sol";
import {OPVSetLib} from "./OPVSet.sol";
import {PVNodeLib} from "./PVNode.sol";

contract Exchange is Ownable {
    address public factory;
    address public tokenA;
    address public tokenB;
    uint16 public feeRate;
    uint256 public tokenAaccumulatedFee;
    uint256 public tokenBaccumulatedFee;

    constructor(address _tokenA, address _tokenB, address _deployer) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        factory = msg.sender;
        _transferOwnership(_deployer);
        feeRate = 999; // 0.1%
    }

    // addr A deposit B token, C many
    mapping(address => mapping(address => uint256)) deposits;

    // token A, price B, orders[seller, amount]
    mapping(address => mapping(uint256 => LinkedListLib.LinkedList))
        public orderBook;

    // addr A: [[sellOrderId, price, volume]]
    OPVSetLib.OPVset private _sellOrders;
    OPVSetLib.OPVset private _buyOrders;

    // [[price, volume]]
    PVNodeLib.PVnode[] private sellOB;
    PVNodeLib.PVnode[] private buyOB;

    function deposit(address tokenAddress, uint256 amount)
        private
        returns (bool)
    {
        require(
            tokenAddress == tokenA || tokenAddress == tokenB,
            "Deposited token is not in the pool"
        );
        IUSDb(tokenAddress).transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][tokenAddress] += amount;
        return true;
    }

    function withdraw(address tokenAddress, uint256 amount)
        private
        returns (bool)
    {
        require(
            tokenAddress == tokenA || tokenAddress == tokenB,
            "Withdrawn token is not in the pool"
        );
        require(
            deposits[msg.sender][tokenAddress] >= amount,
            "Withdraw amount exceeds deposited"
        );
        IUSDb(tokenAddress).transfer(msg.sender, amount);
        deposits[msg.sender][tokenAddress] -= amount;
        return true;
    }

    function getDeposits(address account, address tokenAddress)
        external
        view
        returns (uint256)
    {
        require(
            tokenAddress == tokenA || tokenAddress == tokenB,
            "Token is not in the pool"
        );
        return deposits[account][tokenAddress];
    }

    // Sell
    function newSellOrder(
        uint32 price,
        uint256 sellAmount,
        uint256 priceIdx
    ) external returns (bool) {
        // get priceIdx using the FE
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index"
        );

        // no fee under 1000
        deposit(tokenA, sellAmount);
        uint256 currentFee = (sellAmount * (1000-feeRate)) / 1000;
        tokenAaccumulatedFee += currentFee;
        deposits[msg.sender][tokenA] -= currentFee;
        sellAmount -= currentFee;

        uint256 len = orderBook[tokenB][price].length;
        for (uint8 i = 0; i < len; i++) {
            bytes32 head_ = orderBook[tokenB][price].head;
            uint256 buyAmount = orderBook[tokenB][price]
                .nodes[head_]
                .order
                .amount;

            if (sellAmount == 0) {
                return true;
            } else if ((price * sellAmount) / 100 >= buyAmount) {
                // sell amount >= buy amount
                LinkedListLib.Order memory o = orderBook[tokenB][price]
                    .nodes[head_]
                    .order;
                LinkedListLib.popHead(orderBook[tokenB][price]);
                OPVSetLib._remove(_buyOrders, o.seller, head_);
                PVNodeLib._subVolume(buyOB, priceIdx, o.amount);

                deposits[o.seller][tokenB] -= o.amount;
                deposits[msg.sender][tokenA] -= (o.amount / price) * 100;
                IUSDb(tokenB).transfer(msg.sender, o.amount);
                IUSDb(tokenA).transfer(o.seller, (o.amount / price) * 100);
                sellAmount -= (o.amount / price) * 100;
            } else if (buyAmount > (price * sellAmount) / 100) {
                LinkedListLib.Order memory o = orderBook[tokenB][price]
                    .nodes[head_]
                    .order;
                orderBook[tokenB][price].nodes[head_].order.amount -=
                    (price *
                    sellAmount) / 100;
                OPVSetLib._subVolume(
                    _buyOrders,
                    o.seller,
                    head_,
                    (price * sellAmount) / 100
                );
                PVNodeLib._subVolume(buyOB, priceIdx, (price * sellAmount) / 100);

                deposits[o.seller][tokenB] -= (price * sellAmount) / 100;
                deposits[msg.sender][tokenA] -= sellAmount;
                IUSDb(tokenB).transfer(msg.sender, (price * sellAmount) / 100);
                IUSDb(tokenA).transfer(o.seller, sellAmount);
                sellAmount = 0;
            }
        }
        // new sell order
        if (orderBook[tokenA][price].length == 0 && sellAmount > 0) {
            bytes32 orderId = LinkedListLib.initHead(
                orderBook[tokenA][price],
                msg.sender,
                sellAmount
            );
            OPVSetLib._add(_sellOrders, msg.sender, orderId, price, sellAmount);
            PVNodeLib._addVolume(sellOB, priceIdx, sellAmount);
        } else if (sellAmount > 0) {
            bytes32 orderId = LinkedListLib.addNode(
                orderBook[tokenA][price],
                msg.sender,
                sellAmount
            );
            OPVSetLib._add(_sellOrders, msg.sender, orderId, price, sellAmount);
            PVNodeLib._addVolume(sellOB, priceIdx, sellAmount);
        }

        return true;
    }

    function getAllSellOrders(uint32 price)
        external
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

    function activeSellOrders()
        external
        view
        returns (OPVSetLib.OPVnode[] memory)
    {
        OPVSetLib.OPVnode[] memory sellOrders = new OPVSetLib.OPVnode[](
            _sellOrders._orders[msg.sender].length
        );

        for (uint256 i = 0; i < _sellOrders._orders[msg.sender].length; i++) {
            sellOrders[i] = _sellOrders._orders[msg.sender][i];
        }
        return sellOrders;
    }

    function deleteSellOrder(
        uint32 price,
        bytes32 orderId,
        uint256 priceIdx
    ) external returns (bool) {
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index"
        );

        LinkedListLib.Order memory o = orderBook[tokenA][price]
            .nodes[orderId]
            .order;
        require(msg.sender == o.seller, "Seller does not match the caller");

        withdraw(tokenA, o.amount);

        LinkedListLib.deleteNode(orderBook[tokenA][price], orderId);
        OPVSetLib._remove(_sellOrders, msg.sender, orderId);
        PVNodeLib._subVolume(sellOB, priceIdx, o.amount);

        return true;
    }

    // Buy
    function newBuyOrder(
        uint32 price,
        uint256 buyAmount,
        uint256 priceIdx
    ) external returns (bool) {
        // get priceIdx using the FE
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index"
        );

		// no fee under 1000
        deposit(tokenB, (price * buyAmount) / 100);
        uint256 currentFee = (price * (buyAmount * (1000-feeRate)) / 1000) / 100;
        tokenBaccumulatedFee += currentFee;
        deposits[msg.sender][tokenB] -= currentFee;
        buyAmount -= (buyAmount * (1000-feeRate)) / 1000;

        uint256 len = orderBook[tokenA][price].length;
        for (uint8 i = 0; i < len; i++) {
            bytes32 head_ = orderBook[tokenA][price].head;
            uint256 sellAmount = orderBook[tokenA][price]
                .nodes[head_]
                .order
                .amount;

            if (buyAmount == 0) {
                return true;
            } else if (buyAmount >= sellAmount) {
                // buy amount >= sell amount
                LinkedListLib.Order memory o = orderBook[tokenA][price]
                    .nodes[head_]
                    .order;
                LinkedListLib.popHead(orderBook[tokenA][price]);
                OPVSetLib._remove(_sellOrders, o.seller, head_);
                PVNodeLib._subVolume(sellOB, priceIdx, o.amount);

                deposits[o.seller][tokenA] -= o.amount;
                deposits[msg.sender][tokenB] -= (price * o.amount) / 100;
                IUSDb(tokenA).transfer(msg.sender, o.amount);
                IUSDb(tokenB).transfer(o.seller, (price * o.amount) / 100);
                buyAmount -= o.amount;
            } else if (sellAmount > buyAmount) {
                LinkedListLib.Order memory o = orderBook[tokenA][price]
                    .nodes[head_]
                    .order;
                orderBook[tokenA][price].nodes[head_].order.amount -= buyAmount;
                OPVSetLib._subVolume(_sellOrders, o.seller, head_, buyAmount);
                PVNodeLib._subVolume(sellOB, priceIdx, buyAmount);

                deposits[o.seller][tokenA] -= buyAmount;
                deposits[msg.sender][tokenB] -= (price * buyAmount) / 100;
                IUSDb(tokenA).transfer(msg.sender, buyAmount);
                IUSDb(tokenB).transfer(o.seller, (price * buyAmount) / 100);
                buyAmount = 0;
            }
        }
        // new buy order
        if (orderBook[tokenB][price].length == 0 && buyAmount > 0) {
            bytes32 orderId = LinkedListLib.initHead(
                orderBook[tokenB][price],
                msg.sender,
                (price * buyAmount) / 100
            );
            OPVSetLib._add(
                _buyOrders,
                msg.sender,
                orderId,
                price,
                (price * buyAmount) / 100
            );
            PVNodeLib._addVolume(buyOB, priceIdx, (price * buyAmount) / 100);
        } else if (buyAmount > 0) {
            bytes32 orderId = LinkedListLib.addNode(
                orderBook[tokenB][price],
                msg.sender,
                (price * buyAmount) / 100
            );
            OPVSetLib._add(
                _buyOrders,
                msg.sender,
                orderId,
                price,
                (price * buyAmount) / 100
            );
            PVNodeLib._addVolume(buyOB, priceIdx, (price * buyAmount) / 100);
        }

        return true;
    }

    function deleteBuyOrder(
        uint32 price,
        bytes32 orderId,
        uint256 priceIdx
    ) external returns (bool) {
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index"
        );

        LinkedListLib.Order memory o = orderBook[tokenB][price]
            .nodes[orderId]
            .order;
        require(msg.sender == o.seller, "Seller does not match the caller");

        withdraw(tokenB, o.amount);

        LinkedListLib.deleteNode(orderBook[tokenB][price], orderId);
        OPVSetLib._remove(_buyOrders, msg.sender, orderId);
        PVNodeLib._subVolume(buyOB, priceIdx, o.amount);

        return true;
    }

    function getAllBuyOrders(uint32 price)
        external
        view
        returns (LinkedListLib.Order[] memory)
    {
        LinkedListLib.Order[] memory orders = new LinkedListLib.Order[](
            orderBook[tokenB][price].length
        );

        bytes32 currId = orderBook[tokenB][price].head;

        for (uint256 i = 0; i < orderBook[tokenB][price].length; i++) {
            orders[i] = orderBook[tokenB][price].nodes[currId].order;
            currId = orderBook[tokenB][price].nodes[currId].next;
        }
        return orders;
    }

    function activeBuyOrders()
        external
        view
        returns (OPVSetLib.OPVnode[] memory)
    {
        OPVSetLib.OPVnode[] memory buyOrders = new OPVSetLib.OPVnode[](
            _buyOrders._orders[msg.sender].length
        );

        for (uint256 i = 0; i < _buyOrders._orders[msg.sender].length; i++) {
            buyOrders[i] = _buyOrders._orders[msg.sender][i];
        }
        return buyOrders;
    }

    // sellOB + buyOB functions
    function getPVobs()
        external
        view
        returns (PVNodeLib.PVnode[] memory, PVNodeLib.PVnode[] memory)
    {
        return (sellOB, buyOB);
    }

    function initPVnode(uint32 price) external returns (uint256) {
        if (
            orderBook[tokenA][price].tail == "" &&
            orderBook[tokenB][price].tail == ""
        ) {
            orderBook[tokenA][price].tail = "1"; // placeholder
            sellOB.push(PVNodeLib.PVnode(price, 0));
            buyOB.push(PVNodeLib.PVnode(price, 0));
            return buyOB.length - 1;
        }
        revert("Price already exist in orderbook");
    }

    function getIndexOfPrice(uint32 price) external view returns (uint256) {
        for (uint256 i = 0; i < sellOB.length; i++) {
            if (sellOB[i].price == price) {
                return i;
            }
        }
        revert("Price is not in the array");
    }
    // sellOB + buyOB functions end here

    function collectFees() external onlyOwner returns (bool) {
        IUSDb(tokenA).transfer(msg.sender, tokenAaccumulatedFee);
        IUSDb(tokenB).transfer(msg.sender, tokenBaccumulatedFee);
        tokenAaccumulatedFee = 0;
        tokenBaccumulatedFee = 0;
        return true;
    }
}

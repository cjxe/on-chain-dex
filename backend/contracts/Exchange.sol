// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/IUSDb.sol";
import {LinkedListLib} from "contracts/LinkedList.sol";
import {OPVSetLib} from "contracts/OPVSet.sol";

contract Exchange is Ownable {
    // STORAGE
    address private tokenA = 0xd9145CCE52D386f254917e481eB44e9943F39138;
    address private tokenB = 0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8;
    mapping(address => mapping(address => uint256)) deposits; // addr A deposit B token, C many

    OPVSetLib.OPVset private _sellOrders; // addr A: [[sellOrderId, price, volume]]
    OPVSetLib.OPVset private _buyOrders;

    mapping(address => mapping(uint256 => LinkedListLib.LinkedList))
        public orderBook; // token A, price B, orders[seller, amount]

    // price-volume node
    struct PVnode {
        uint32 price;
        uint256 volume;
    }

    PVnode[] private sellOB; // sell orderbook
    PVnode[] private buyOB; // buy orderbook

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

    // Sell
    function newSellOrder(
        uint32 price,
        uint256 sellAmount,
        uint256 priceIdx
    ) public returns (bool) {
        // get priceIdx using the FE
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index."
        );

        deposit(tokenA, sellAmount);

        uint256 len = orderBook[tokenB][price].length;
        for (uint8 i = 0; i < len; i++) {
            bytes32 head_ = orderBook[tokenB][price].head;
            uint256 buyAmount = orderBook[tokenB][price]
                .nodes[head_]
                .order
                .amount; // do i need to divide by price ???

            if (sellAmount == 0) {
                return true;
            } else if (price * sellAmount >= buyAmount) {
                // sell amount >= buy amount
                LinkedListLib.Order memory o = orderBook[tokenB][price]
                    .nodes[head_]
                    .order;
                LinkedListLib.popHead(orderBook[tokenB][price]);
                OPVSetLib._remove(_buyOrders, o.seller, head_);
                _subVolume(buyOB, priceIdx, o.amount);

                deposits[o.seller][tokenB] -= o.amount;
                deposits[msg.sender][tokenA] -= o.amount / price;
                IUSDb(tokenB).transfer(msg.sender, o.amount);
                IUSDb(tokenA).transfer(o.seller, o.amount / price);
                sellAmount -= o.amount / price;
            } else if (buyAmount > price * sellAmount) {
                LinkedListLib.Order memory o = orderBook[tokenB][price]
                    .nodes[head_]
                    .order;
                orderBook[tokenB][price].nodes[head_].order.amount -=
                    price *
                    sellAmount;
                OPVSetLib._subVolume(
                    _buyOrders,
                    o.seller,
                    head_,
                    price * sellAmount
                ); // - [ ] test
                _subVolume(buyOB, priceIdx, price * sellAmount);

                deposits[o.seller][tokenB] -= price * sellAmount;
                deposits[msg.sender][tokenA] -= sellAmount;
                IUSDb(tokenB).transfer(msg.sender, price * sellAmount);
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
            _addVolume(sellOB, priceIdx, sellAmount);
        } else if (sellAmount > 0) {
            bytes32 orderId = LinkedListLib.addNode(
                orderBook[tokenA][price],
                msg.sender,
                sellAmount
            );
            OPVSetLib._add(_sellOrders, msg.sender, orderId, price, sellAmount);
            _addVolume(sellOB, priceIdx, sellAmount);
        }

        return true;
    }

    function getAllSellOrders(uint32 price)
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

    function activeSellOrders()
        public
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
    ) public returns (bool) {
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index."
        );

        LinkedListLib.Order memory o = orderBook[tokenA][price]
            .nodes[orderId]
            .order;
        require(msg.sender == o.seller, "Seller does not match the caller.");

        withdraw(tokenA, o.amount);

        LinkedListLib.deleteNode(orderBook[tokenA][price], orderId);
        OPVSetLib._remove(_sellOrders, msg.sender, orderId);
        _subVolume(sellOB, priceIdx, o.amount);

        return true;
    }

    // Buy
    function newBuyOrder(
        uint32 price,
        uint256 buyAmount,
        uint256 priceIdx
    ) public returns (bool) {
        // get priceIdx using the FE
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index."
        );

        deposit(tokenB, price * buyAmount);

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
                _subVolume(sellOB, priceIdx, o.amount);

                deposits[o.seller][tokenA] -= o.amount;
                deposits[msg.sender][tokenB] -= price * o.amount;
                IUSDb(tokenA).transfer(msg.sender, o.amount);
                IUSDb(tokenB).transfer(o.seller, price * o.amount);
                buyAmount -= o.amount;
            } else if (sellAmount > buyAmount) {
                LinkedListLib.Order memory o = orderBook[tokenA][price]
                    .nodes[head_]
                    .order;
                orderBook[tokenA][price].nodes[head_].order.amount -= buyAmount;
                OPVSetLib._subVolume(_sellOrders, o.seller, head_, buyAmount); // - [ ] test
                _subVolume(sellOB, priceIdx, buyAmount);

                deposits[o.seller][tokenA] -= buyAmount;
                deposits[msg.sender][tokenB] -= price * buyAmount;
                IUSDb(tokenA).transfer(msg.sender, buyAmount);
                IUSDb(tokenB).transfer(o.seller, price * buyAmount);
                buyAmount = 0;
            }
        }
        // new buy order
        if (orderBook[tokenB][price].length == 0 && buyAmount > 0) {
            bytes32 orderId = LinkedListLib.initHead(
                orderBook[tokenB][price],
                msg.sender,
                price * buyAmount
            );
            OPVSetLib._add(
                _buyOrders,
                msg.sender,
                orderId,
                price,
                price * buyAmount
            );
            _addVolume(buyOB, priceIdx, price * buyAmount);
        } else if (buyAmount > 0) {
            bytes32 orderId = LinkedListLib.addNode(
                orderBook[tokenB][price],
                msg.sender,
                price * buyAmount
            );
            OPVSetLib._add(
                _buyOrders,
                msg.sender,
                orderId,
                price,
                price * buyAmount
            );
            _addVolume(buyOB, priceIdx, price * buyAmount);
        }

        return true;
    }

    function deleteBuyOrder(
        uint32 price,
        bytes32 orderId,
        uint256 priceIdx
    ) public returns (bool) {
        require(
            buyOB[priceIdx].price == price && sellOB[priceIdx].price == price,
            "Price does not match the index."
        );

        LinkedListLib.Order memory o = orderBook[tokenB][price]
            .nodes[orderId]
            .order;
        require(msg.sender == o.seller, "Seller does not match the caller.");

        withdraw(tokenB, o.amount);

        LinkedListLib.deleteNode(orderBook[tokenB][price], orderId);
        OPVSetLib._remove(_buyOrders, msg.sender, orderId);
        _subVolume(buyOB, priceIdx, o.amount);

        return true;
    }

    function getAllBuyOrders(uint32 price)
        public
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
        public
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

    // OB functions
    function getPVobs() public view returns (PVnode[] memory, PVnode[] memory) {
        return (sellOB, buyOB);
    }

    function initPVnode(uint32 price) external returns (uint256) {
        if (
            orderBook[tokenA][price].tail == "" &&
            orderBook[tokenB][price].tail == ""
        ) {
            orderBook[tokenA][price].tail = "1"; // placeholder
            sellOB.push(PVnode(price, 0));
            buyOB.push(PVnode(price, 0));
            return buyOB.length - 1;
        }
        revert("Price already exist in orderbook.");
    }

    function getIndexOfPrice(uint32 price) public view returns (uint256) {
        for (uint256 i = 0; i < sellOB.length; i++) {
            if (sellOB[i].price == price) {
                return i;
            }
        }
        revert("Price is not in the array.");
        // TODO in front-end
        // run this everytime before making new order
        // if this function returns an error, initiate initPVnode(price)
    }

    function _addVolume(
        PVnode[] storage ob,
        uint256 index,
        uint256 changeAmount
    ) private returns (bool) {
        ob[index].volume += changeAmount;
        return true;
    }

    function _subVolume(
        PVnode[] storage ob,
        uint256 index,
        uint256 changeAmount
    ) private returns (bool) {
        ob[index].volume -= changeAmount;
        return true;
    }
    // OB functions end here

    // move PV functions to a new library

    // write factory
    // check paper examples
}

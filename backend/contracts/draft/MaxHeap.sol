// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract MaxHeap {
    struct Node {
        uint32 price;
    }

    Node[] public sellOrderbook;

    function getNode(uint32 _price) public view returns (Node memory) {
        for (uint32 i = 0; i < sellOrderbook.length; i++) {
            if (sellOrderbook[i].price == _price) {
                return sellOrderbook[i];
            }
        }
    }

    function top() public view returns (Node memory) {
        return sellOrderbook[0];
    }

    // test
    function getLength() public view returns (uint256) {
        return sellOrderbook.length;
    }

    function insert(Node memory n) public returns (bool) {
        sellOrderbook.push(n);
        // if heap is empty
        if (sellOrderbook.length == 1) {
            return true;
        }
        uint256 i = sellOrderbook.length;
        for (i; i > 0 && n.price > sellOrderbook[i / 2].price; i = i / 2) {
            sellOrderbook[i] = sellOrderbook[i / 2]; // i have to be located or else it's not possible to define new allocaiton w/ dynamic arrays
        }
        sellOrderbook[i] = n;
        return true;
    }

    function test() public view returns (uint256) {
        return uint256(1) / 2;
    }
}

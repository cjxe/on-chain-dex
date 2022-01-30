// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract LinkedList {
    struct Order {
        address seller;
        uint256 amount;
    }

    struct Node {
        bytes32 next;
        Order order;
    }

    mapping(bytes32 => Node) private nodes;
    uint256 private length;
    bytes32 private head;
    bytes32 private prevNodeId;

    constructor(address _seller, uint256 _amount) {
        Order memory o = Order(_seller, _amount);
        Node memory n = Node(head, o);

        bytes32 id = keccak256(
            abi.encodePacked(_seller, _amount, length, block.timestamp)
        );

        nodes[id] = n;
        head = id;
        prevNodeId = id;
        length = 1;
    }

    function getNode(bytes32 _id) public view returns (Node memory) {
        return nodes[_id];
        // Q: Why "getter func" instead of `public`?
        // A: https://ethereum.stackexchange.com/questions/67137/why-creating-a-private-variable-and-a-getter-instead-of-just-creating-a-public-v
    }

    function getLength() public view returns (uint256) {
        return length;
    }

    function addNode(address _seller, uint256 _amount)
        public
        returns (bytes32)
    {
        Order memory o = Order(_seller, _amount);
        Node memory n = Node(0, o);

        bytes32 id = keccak256(
            abi.encodePacked(_seller, _amount, length, block.timestamp)
        );

        nodes[id] = n;
        nodes[prevNodeId].next = id;
        prevNodeId = id;
        length += 1;
        return id;
    }

    function popHead() private returns (bool) {
        bytes32 currHead = head;

        head = nodes[currHead].next;

        // delete's don't work for mappings so have to be set to 0
        // deleting is not necessary but we get partial refund
        delete nodes[currHead];
        return true;
    }

    function deleteNode(bytes32 _id) public returns (bool) {
        if (head == _id) {
            require(
                nodes[_id].order.seller == msg.sender,
                "Unauthorised to delete this order."
            );
            popHead();
            return true;
        }

        bytes32 curr = nodes[head].next;
        bytes32 prev = head;

        // skipping node at index=0 (cuz its the head)
        for (uint256 i = 1; i < length; i++) {
            if (curr == _id) {
                require(
                    nodes[_id].order.seller == msg.sender,
                    "Unauthorised to delete this order."
                ); // test this
                nodes[prev].next = nodes[curr].next;
                delete nodes[curr];
                return true;
            }
            prev = curr;
            curr = nodes[prev].next;
        }
        revert("Order ID not found.");
    }
}

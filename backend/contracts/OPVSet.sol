// SPDX-License-Identifier: MIT
// inspired by: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/structs/EnumerableSet.sol
pragma solidity ^0.8.11;

library OPVSetLib {
    struct OPVnode {
        bytes32 _orderId;
        uint32 _price;
        uint256 _volume;
    }

    struct OPVset {
        mapping(address => OPVnode[]) _orders;
        mapping(bytes32 => uint256) _indexes;
    }

    function _contains(OPVset storage set, bytes32 orderId)
        internal
        view
        returns (bool)
    {
        // 0 is a sentinel value
        return set._indexes[orderId] != 0;
    }

    function _at(
        OPVset storage set,
        address userAddress,
        uint256 index
    ) internal view returns (OPVnode memory) {
        return set._orders[userAddress][index];
    }

    function _add(
        OPVset storage set,
        address userAddress,
        bytes32 orderId,
        uint32 price,
        uint256 volume
    ) internal returns (bool) {
        if (!_contains(set, orderId)) {
            set._orders[userAddress].push(OPVnode(orderId, price, volume));
            set._indexes[orderId] = set._orders[userAddress].length;
            // The value is stored at length-1, but we add 1 to all indexes
            // and use 0 as a sentinel value
            return true;
        } else {
            return false;
        }
    }

    function _remove(
        OPVset storage set,
        address userAddress,
        bytes32 orderId
    ) internal returns (bool) {
        uint256 orderIdIndex = set._indexes[orderId];

        if (orderIdIndex != 0) {
            uint256 toDeleteIndex = orderIdIndex - 1;
            uint256 lastIndex = set._orders[userAddress].length - 1;

            if (lastIndex != toDeleteIndex) {
                OPVnode memory lastOPVnode = set._orders[userAddress][
                    lastIndex
                ];

                // Move the last value to the index where the value to delete is
                set._orders[userAddress][toDeleteIndex] = lastOPVnode;
                // Update the index for the moved value
                set._indexes[lastOPVnode._orderId] = orderIdIndex; // Replace lastvalue's index to valueIndex
            }

            // Delete the slot where the moved value was stored
            set._orders[userAddress].pop();

            // Delete the index for the deleted slot
            delete set._indexes[orderId];

            return true;
        } else {
            return false;
        }
    }

    function _addVolume(
        OPVset storage set,
        address userAddress,
        bytes32 orderId,
        uint256 volume
    ) internal returns (bool) {
        uint256 orderIdIndex = set._indexes[orderId];

        if (orderIdIndex != 0) {
            set._orders[userAddress][orderIdIndex - 1]._volume += volume;
            return true;
        } else {
            return false;
        }
    }

    function _subVolume(
        OPVset storage set,
        address userAddress,
        bytes32 orderId,
        uint256 volume
    ) internal returns (bool) {
        uint256 orderIdIndex = set._indexes[orderId];

        if (orderIdIndex != 0) {
            set._orders[userAddress][orderIdIndex - 1]._volume -= volume;
            return true;
        } else {
            return false;
        }
    }
}

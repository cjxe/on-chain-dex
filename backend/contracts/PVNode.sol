// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

library PVNodeLib {
    // price-volume node
    struct PVnode {
        uint32 price;
        uint256 volume;
    }

    function _addVolume(
        PVnode[] storage ob,
        uint256 index,
        uint256 changeAmount
    ) internal returns (bool) {
        ob[index].volume += changeAmount;
        return true;
    }

    function _subVolume(
        PVnode[] storage ob,
        uint256 index,
        uint256 changeAmount
    ) internal returns (bool) {
        ob[index].volume -= changeAmount;
        return true;
    }
}

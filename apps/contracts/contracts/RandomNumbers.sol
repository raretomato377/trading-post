// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract RandomNumbers {
    uint16 public constant NUMBER_ONE = 7482;
    uint16 public constant NUMBER_TWO = 3619;
    uint16 public constant NUMBER_THREE = 5834;
    uint16 public constant NUMBER_FOUR = 9271;

    function getNumbers() public pure returns (uint16, uint16, uint16, uint16) {
        return (NUMBER_ONE, NUMBER_TWO, NUMBER_THREE, NUMBER_FOUR);
    }

    function getAllNumbers() public pure returns (uint16[4] memory) {
        return [NUMBER_ONE, NUMBER_TWO, NUMBER_THREE, NUMBER_FOUR];
    }
}

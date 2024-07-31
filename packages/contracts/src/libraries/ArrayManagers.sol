// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

library ArrayManagers {
    // takes empty positions out of a bytes32 memory array;
    function trimBytes32Array(bytes32[] memory arrayToTrim) public view returns (bytes32[] memory trimmedArray) {
        uint256 numberOfNonZeroPositions;

        for (uint256 i; i < arrayToTrim.length; i++) {
            if (arrayToTrim[i] != bytes32(0)) numberOfNonZeroPositions++;
        }

        if (numberOfNonZeroPositions != 0) {
            trimmedArray = new bytes32[](numberOfNonZeroPositions);
            uint256 written;
            for (uint256 i; i < arrayToTrim.length;) {
                if (arrayToTrim[i] != bytes32(0)) {
                    trimmedArray[written] = arrayToTrim[i];
                    written++;
                }
                if (written == numberOfNonZeroPositions) break;

                {
                    i++;
                }
            }
        }
    }

    // takes empty positions out of a uint256 memory array;
    function trimUint256Array(uint256[] memory arrayToTrim) public view returns (uint256[] memory trimmedArray) {
        uint256 numberOfNonZeroPositions;

        for (uint256 i; i < arrayToTrim.length; i++) {
            if (arrayToTrim[i] != uint256(0)) numberOfNonZeroPositions++;
        }

        if (numberOfNonZeroPositions != 0) {
            trimmedArray = new uint256[](numberOfNonZeroPositions);
            uint256 written;
            for (uint256 i; i < arrayToTrim.length;) {
                if (arrayToTrim[i] != uint256(0)) {
                    trimmedArray[written] = arrayToTrim[i];
                    written++;
                }
                if (written == numberOfNonZeroPositions) break;

                {
                    i++;
                }
            }
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/// @notice Library for creating chunks of integers.

library LibChunks {
  function get4Chunks(uint256 number) public pure returns (uint64[] memory) {
    uint64[] memory chunks = new uint64[](4);
    for (uint256 i; i < 4; i++) {
      chunks[i] = uint64(number >> (i * 64));
    }
    return chunks;
  }

  function get8Chunks(uint256 number) public pure returns (uint32[] memory) {
    uint32[] memory chunks = new uint32[](8);
    for (uint256 i; i < 8; i++) {
      chunks[i] = uint32(number >> (i * 32));
    }
    return chunks;
  }

  function get16Chunks(uint256 number) public pure returns (uint16[] memory) {
    uint16[] memory chunks = new uint16[](16);
    for (uint256 i; i < 16; i++) {
      chunks[i] = uint16(number >> (i * 16));
    }
    return chunks;
  }
}

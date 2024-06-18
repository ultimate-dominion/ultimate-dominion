// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { RandomNumbers } from "@codegen/index.sol";
import { CharacterStats } from "@codegen/index.sol";
import { RngRequestType } from "@codegen/common.sol";
import { UltimateDominionConfig } from "../codegen/index.sol";
import { LibChunks } from "../libraries/LibChunks.sol";
import { IEntropyConsumer } from "@pythnetwork/IEntropyConsumer.sol";
import { IEntropy } from "@pythnetwork/IEntropy.sol";
import "forge-std/console2.sol";

contract RngSystem is System, IEntropyConsumer {
  using LibChunks for uint256;

  event RNGFulfilled(bytes32 randomNumber);

  function _entropy() internal view returns (IEntropy entropy) {
    entropy = IEntropy(UltimateDominionConfig.getEntropy());
  }

  function getEntropy() internal view override returns (address) {
    return UltimateDominionConfig.getEntropy();
  }

  function getFee() public view returns (uint128) {
    return _entropy().getFee(_provider());
  }

  function _provider() internal view returns (address provider) {
    provider = UltimateDominionConfig.getPythProvider();
  }

  function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data) public payable {
    uint128 requestFee = _entropy().getFee(_provider());
    // check if the user has sent enough fees
    // if (_msgValue() < requestFee) revert('not enough fees');

    // NOTE: required for testing, since callback is coming before data is stored
    /////////////// TODO: remove or comment out for mainnet deployment //////
    if (block.chainid == 31337) {
      (, bytes memory returnData) = address(_entropy()).staticcall(
        abi.encodeWithSelector(IEntropy.request.selector, _provider(), userRandomNumber, false)
      );
      uint64 _sequenceNumber = abi.decode(returnData, (uint64));
      RandomNumbers.setArbitraryData(_sequenceNumber, data);
      RandomNumbers.setRequestType(_sequenceNumber, requestType);
    }
    /////////////////////////////////////////

    // pay the fees and request a random number from entropy
    uint64 sequenceNumber = _entropy().requestWithCallback{ value: requestFee }(_provider(), userRandomNumber);
    // RandomNumbers.set(sequenceNumber, requestType, data);
    RandomNumbers.setArbitraryData(sequenceNumber, data);
    RandomNumbers.setRequestType(sequenceNumber, requestType);
  }

  function entropyCallback(
    uint64 sequenceNumber,
    // If your app uses multiple providers, you can use this argument
    // to distinguish which one is calling the app back. This app only
    // uses one provider so this argument is not used.
    address /*_providerAddress*/,
    bytes32 randomNumber
  ) internal override {
    _storeFullfilment(sequenceNumber, uint256(randomNumber));
    emit RNGFulfilled(randomNumber);
  }

  function _storeFullfilment(uint64 sequenceNumber, uint256 randomNumber) internal {
    RngRequestType requestType = RandomNumbers.getRequestType(sequenceNumber);
    bytes memory _data = RandomNumbers.getArbitraryData(sequenceNumber);

    if (uint8(requestType) == uint8(0)) {
      uint256 characterId = abi.decode(_data, (uint256));
      _storeCharacterStats(randomNumber, characterId);
    }
  }

  function _storeCharacterStats(uint256 randomNumber, uint256 characterId) internal {
    uint64[] memory chunks = randomNumber.get4Chunks();
    CharacterStats.setStrength(characterId, (uint256((uint256(chunks[0]) % uint256(9)) + 1)));
    CharacterStats.setAgility(characterId, (uint256((uint256(chunks[1]) % uint256(9)) + 1)));
    CharacterStats.setIntelligence(characterId, (uint256((uint256(chunks[2]) % uint256(9)) + 1)));
    CharacterStats.setHitPoints(characterId, (uint256((uint256(chunks[3]) % uint256(9)) + 1)));
  }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {RandomNumbers} from "@codegen/index.sol";
import {Characters, Stats, UltimateDominionConfig, StatsData} from "@codegen/index.sol";
import {Classes, RngRequestType} from "@codegen/common.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {CombatMove} from "@interfaces/Structs.sol";
import {IEntropyConsumer} from "@pythnetwork/IEntropyConsumer.sol";
import {IWorld, ICombatSystem} from "@world/IWorld.sol";
import {IEntropy} from "@pythnetwork/IEntropy.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
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

    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data)
        public
        payable
        returns (uint64 sequenceNumber)
    {
        uint128 requestFee = _entropy().getFee(_provider());
        // check if the user has sent enough fees
        // if (_msgValue() < requestFee) revert('not enough fees');

        // NOTE: required for testing, since callback is coming before data is stored
        /////////////// TODO: remove for mainnet deployment //////
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
        sequenceNumber = _entropy().requestWithCallback{value: requestFee}(_provider(), userRandomNumber);
        // RandomNumbers.set(sequenceNumber, requestType, data);
        RandomNumbers.setArbitraryData(sequenceNumber, data);
        RandomNumbers.setRequestType(sequenceNumber, requestType);
    }

    function entropyCallback(
        uint64 sequenceNumber,
        // If your app uses multiple providers, you can use this argument
        // to distinguish which one is calling the app back. This app only
        // uses one provider so this argument is not used.
        address, /*_providerAddress*/
        bytes32 randomNumber
    ) internal override {
        _storeFullfilment(sequenceNumber, uint256(randomNumber));
        emit RNGFulfilled(randomNumber);
    }

    function _storeFullfilment(uint64 sequenceNumber, uint256 randomNumber) internal {
        RngRequestType requestType = RandomNumbers.getRequestType(sequenceNumber);
        bytes memory _data = RandomNumbers.getArbitraryData(sequenceNumber);

        if (uint8(requestType) == uint8(0)) {
            bytes32 characterId = abi.decode(_data, (bytes32));
            _storeStats(randomNumber, characterId);
        }
        if (uint8(requestType) == uint8(1)) {
            (bytes32 encounterId, CombatMove[] memory moves) = abi.decode(_data, (bytes32, CombatMove[]));
            _executeCombat(randomNumber, encounterId, moves);
        }
    }

    function _executeCombat(uint256 randomNumber, bytes32 encounterId, Action[] memory moves) internal {
        SystemSwitch.call(abi.encodeCall(ICombatSystem.UD__executeCombat, (randomNumber, encounterId, moves)));
    }

    function _storeStats(uint256 randomNumber, bytes32 characterId) internal {
        uint64[] memory chunks = randomNumber.get4Chunks();

        Classes characterClass = Stats.getClass(characterId);

        StatsData memory stats;

        stats.class = characterClass;

        stats.strength = (chunks[0] % 8) + 3; // Range [3, 10]
        stats.agility = (chunks[1] % 8) + 3; // Range [3, 10]

        // Calculate intelligence to ensure total is 19
        stats.intelligence = 19 - stats.strength - stats.agility;

        // Ensure intelligence is within the range [3, 10]
        if (stats.intelligence < 3) {
            uint256 deficit = 3 - stats.intelligence;
            stats.intelligence = 3;

            if (stats.strength > stats.agility) {
                stats.strength -= deficit;
            } else {
                stats.agility -= deficit;
            }
        } else if (stats.intelligence > 10) {
            uint256 excess = stats.intelligence - 10;
            stats.intelligence = 10;

            if (stats.strength < stats.agility) {
                stats.strength += excess;
            } else {
                stats.agility += excess;
            }
        }

        // Class-based adjustments; should total to 21
        if (characterClass == Classes.Warrior) {
            stats.strength += 2;
            stats.baseHitPoints = uint256(10);
        } else if (characterClass == Classes.Rogue) {
            stats.agility += 2;
            stats.baseHitPoints = uint256(6);
        } else if (characterClass == Classes.Mage) {
            stats.intelligence += 2;
            stats.baseHitPoints = uint256(8);
        }

        Stats.set(characterId, stats);
    }
}

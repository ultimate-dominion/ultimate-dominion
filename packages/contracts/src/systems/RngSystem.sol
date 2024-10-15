// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {
    RandomNumbers,
    RandomNumbersData,
    Counters,
    Stats,
    UltimateDominionConfig,
    StatsData,
    RngLogs,
    RngLogsData,
    CombatEncounter
} from "@codegen/index.sol";
import {Math} from "@libraries/Math.sol";
import {Classes, RngRequestType, EncounterType} from "@codegen/common.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import {Action} from "@interfaces/Structs.sol";
import {IWorld, IPvESystem, IPvPSystem, IWorldActionSystem} from "@world/IWorld.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import "forge-std/console.sol";

contract RngSystem is System {
    using LibChunks for uint256;

    event RNGFulfilled(bytes32 randomNumber);

    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data)
        public
        payable
        returns (uint64 sequenceNumber)
    {
        RandomNumbersData memory randomNumberData;
        randomNumberData.arbitraryData = data;
        randomNumberData.requestType = requestType;

        //prevrando entropy
        sequenceNumber = uint64(_incrementCounter(1));

        RngLogsData memory rngLog = RngLogsData({
            sequenceNumber: sequenceNumber,
            requestType: requestType,
            randomNumber: 0,
            userRandomNumber: userRandomNumber,
            data: data
        });

        RngLogs.set(sequenceNumber, rngLog);

        uint256 rng;
        uint256 timesCalled;
        if (block.chainid == 31337) {
            rng = uint256(keccak256(abi.encode((block.timestamp + timesCalled + 1234567890) ** 8)));
            timesCalled++;
        } else {
            rng = uint256(keccak256(abi.encode(block.prevrandao, userRandomNumber, _msgSender())));
        }

        RandomNumbers.set(sequenceNumber, randomNumberData);
        // this is included so that in the future we can add VRNG if it is needed
        entropyCallback(sequenceNumber, bytes32(rng));
    }

    function entropyCallback(uint64 sequenceNumber, bytes32 randomNumber) internal {
        _fullfillEntropy(sequenceNumber, uint256(randomNumber));
        emit RNGFulfilled(randomNumber);
    }

    function _fullfillEntropy(uint64 sequenceNumber, uint256 randomNumber) internal {
        RngRequestType requestType = RandomNumbers.getRequestType(sequenceNumber);
        bytes memory _data = RandomNumbers.getArbitraryData(sequenceNumber);

        RngLogs.setRandomNumber(_getCounter(1), randomNumber);

        if (requestType == RngRequestType.CharacterStats) {
            bytes32 characterId = abi.decode(_data, (bytes32));
            _storeStats(randomNumber, characterId);
        } else if (requestType == RngRequestType.Combat) {
            (bytes32 encounterId, Action[] memory moves) = abi.decode(_data, (bytes32, Action[]));
            require(moves.length > 0, "RNG: Invalid moves");
            EncounterType encounterType = CombatEncounter.getEncounterType(encounterId);
            if (encounterType == EncounterType.PvE) {
                _executePvECombat(randomNumber, encounterId, moves);
            } else if (encounterType == EncounterType.PvP) {
                _executePvPCombat(randomNumber, encounterId, moves);
            } else {
                revert("RNG: Unrecognized Combat Type");
            }
        } else if (requestType == RngRequestType.World) {
            (bytes32 encounterId, Action[] memory moves) = abi.decode(_data, (bytes32, Action[]));
            _executeWorldActions(randomNumber, encounterId, moves);
        } else {
            revert("RNG: Unrecognized request type");
        }
    }

    function _executePvECombat(uint256 randomNumber, bytes32 encounterId, Action[] memory moves) internal {
        SystemSwitch.call(abi.encodeCall(IPvESystem.UD__executePvECombat, (randomNumber, encounterId, moves)));
    }

    function _executePvPCombat(uint256 randomNumber, bytes32 encounterId, Action[] memory moves) internal {
        SystemSwitch.call(abi.encodeCall(IPvPSystem.UD__executePvPCombat, (randomNumber, encounterId, moves)));
    }
    // to execute a non combat action just pass in the entityID of the acting entity instead of an encounter id;

    function _executeWorldActions(uint256 randomNumber, bytes32 entityId, Action[] memory moves) internal {
        SystemSwitch.call(
            abi.encodeCall(IWorldActionSystem.UD__executeWorldRngActions, (randomNumber, entityId, moves))
        );
    }

    function _storeStats(uint256 randomNumber, bytes32 characterId) internal {
        uint64[] memory chunks = randomNumber.get4Chunks();

        Classes characterClass = Stats.getClass(characterId);

        StatsData memory stats;

        stats.class = characterClass;

        stats.strength = int256(Math.absolute(int256(int64(chunks[0]))) % 8 + 3); // Range [3, 10]
        stats.agility = int256(Math.absolute(int256(int64(chunks[1]))) % 8 + 3); // Range [3, 10]

        // Calculate intelligence to ensure total is 19
        stats.intelligence = int256(19 - stats.strength - stats.agility);

        // Ensure intelligence is within the range [3, 10]
        if (stats.intelligence < 3) {
            int256 deficit = int256(3 - stats.intelligence);
            stats.intelligence = int256(3);

            if (stats.strength > stats.agility) {
                stats.strength -= deficit;
            } else {
                stats.agility -= deficit;
            }
        } else if (stats.intelligence > 10) {
            int256 excess = int256(stats.intelligence - 10);
            stats.intelligence = int256(10);

            if (stats.strength < stats.agility) {
                stats.strength += int256(excess);
            } else {
                stats.agility += int256(excess);
            }
        }

        // Class-based adjustments; should total to 21
        if (characterClass == Classes.Warrior) {
            stats.strength += 2;
            stats.maxHp = int256(10);
        } else if (characterClass == Classes.Rogue) {
            stats.agility += 2;
            stats.maxHp = int256(8);
        } else if (characterClass == Classes.Mage) {
            stats.intelligence += 2;
            stats.maxHp = int256(9);
        }

        Stats.set(characterId, stats);
    }

    function _getCounter(uint256 counterNumber) internal view returns (uint256 _counter) {
        _counter = Counters.get(address(this), counterNumber);
    }

    function _incrementCounter(uint256 counterNumber) internal returns (uint256 _counter) {
        _counter = Counters.get(address(this), counterNumber) + 1;
        Counters.set(address(this), counterNumber, _counter);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        virtual
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }
}

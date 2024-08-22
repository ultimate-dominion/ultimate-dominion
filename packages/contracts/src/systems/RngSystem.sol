// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Systems} from "@latticexyz/world/src/codegen/tables/Systems.sol";
import {
    RandomNumbers,
    RandomNumbersData,
    Characters,
    Counters,
    Stats,
    UltimateDominionConfig,
    StatsData,
    RngLogs,
    RngLogsData,
    CombatEncounter,
    RngNonces
} from "@codegen/index.sol";
import {Classes, RngRequestType, EncounterType} from "@codegen/common.sol";
import {LibChunks} from "../libraries/LibChunks.sol";
import "@libraries/StringAndUintConverter.sol" as StringAndUintConverter;
import {IAdapter} from "@interfaces/IAdapter.sol";
import {IRngSystem} from "@interfaces/IRngSystem.sol";
import {IGasEstimator} from "@interfaces/IGasEstimator.sol";
import {Action} from "@interfaces/Structs.sol";
import {_RANDOMNESS_PLACEHOLDER, _MAX_GAS_LIMIT} from "../../constants.sol";
import {IWorld, IPvESystem, IPvPSystem} from "@world/IWorld.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {_requireAccess, _characterSystemId, _encounterSystemId} from "../utils.sol";
import "forge-std/console2.sol";

contract RngSystem is System, IRngSystem {
    using LibChunks for uint256;

    event RNGFulfilled(uint256 randomNumber);

    modifier onlySystem() {
        address characterSystemAddr = Systems.getSystem(_characterSystemId("UD"));
        address encounterSystemAddr = Systems.getSystem(_encounterSystemId("UD"));
        require(_msgSender() == encounterSystemAddr || _msgSender() == characterSystemAddr, "RNG: INVALID CALLER");
        _;
    }

    function _randcast() internal view returns (IAdapter randcast) {
        randcast = IAdapter(getRandcastAdapter());
    }

    function getRandcastAdapter() internal view override returns (address) {
        return UltimateDominionConfig.getRandcastAdapter();
    }

    function getGasEstimator() internal view override returns (address) {
        return UltimateDominionConfig.getGasEstimator();
    }

    function subscriptionId() public view returns (uint64) {
        return UltimateDominionConfig.getSubscriptionId();
    }

    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data)
        external
        payable
        override
        onlySystem
        returns (bytes32 _requestId)
    {
        RandomNumbersData memory randomNumberData;
        randomNumberData.arbitraryData = data;
        randomNumberData.requestType = requestType;

        _requestId = _nextRequestId(subscriptionId());
        // set the data in advance so we can estimate gas
        RandomNumbers.set(_requestId, randomNumberData);

        uint32 callbackGas = requestType == RngRequestType.CharacterStats ? 300_000 : 3_000_000; //estimateCallbackGas(_requestId); // hardcode gas for end turn + 20%  which is the highes gas cost callback // 2339696; //
        // uint256 requestFee =      estimateFee(_requestId);
        bytes memory randcastParams;
        IAdapter.RandomnessRequestParams memory randomnessParams = IAdapter.RandomnessRequestParams({
            requestType: IAdapter.RequestType.Randomness,
            params: randcastParams,
            subId: subscriptionId(),
            seed: uint256(userRandomNumber),
            requestConfirmations: uint16(1),
            callbackGasLimit: callbackGas,
            callbackMaxGasPrice: tx.gasprice * 3
        });

        console2.log("CALLBACK GAS", callbackGas);

        // pay the fees and request a random number from arpa
        bytes32 rcRequestId = _randcast().requestRandomness(randomnessParams);

        require(rcRequestId == _requestId, "mismatch request ids");

        _incrementNonce(subscriptionId());

        RngLogsData memory rngLog = RngLogsData({
            subscriptionId: subscriptionId(),
            adapter: getRandcastAdapter(),
            fee: 0,
            requestType: requestType,
            randomNumber: 0,
            userRandomNumber: userRandomNumber,
            data: data
        });

        RngLogs.set(_requestId, rngLog);
    }

    function estimateFee(bytes32 requestId) public override returns (uint256 _fee) {
        IAdapter.Subscription memory sub = _getSubscription(subscriptionId());
        if (sub.freeRequestCount == 0) {
            _fee = _randcast().estimatePaymentAmountInETH(estimateCallbackGas(requestId), 550000, 0, tx.gasprice * 3, 3);
        }
    }

    function fundSubscription() public payable override {
        _randcast().fundSubscription{value: _msgValue()}(subscriptionId());
    }

    function _calculateTierFee(uint64 reqCount, uint256 lastRequestTimestamp, uint64 reqCountInCurrentPeriod)
        internal
        view
        returns (uint32 tierFee)
    {
        // Use the new struct here.
        IAdapter.FeeConfig memory feeConfig = _getFlatFeeConfig();
        uint64 reqCountCalc;
        if (feeConfig.isFlatFeePromotionEnabledPermanently) {
            reqCountCalc = reqCount;
        } else if (
            feeConfig
                //solhint-disable-next-line not-rely-on-time
                .flatFeePromotionStartTimestamp <= block.timestamp
            //solhint-disable-next-line not-rely-on-time
            && block.timestamp <= feeConfig.flatFeePromotionEndTimestamp
        ) {
            if (lastRequestTimestamp < feeConfig.flatFeePromotionStartTimestamp) {
                reqCountCalc = 1;
            } else {
                reqCountCalc = reqCountInCurrentPeriod + 1;
            }
        }
        return _randcast().estimateFeeTier(reqCountCalc) * feeConfig.flatFeePromotionGlobalPercentage / 100;
    }

    function _getFlatFeeConfig() internal view returns (IAdapter.FeeConfig memory feeConfig) {
        {
            (, bytes memory point) =
            // solhint-disable-next-line avoid-low-level-calls
             address(_randcast()).staticcall(abi.encodeWithSelector(IAdapter.getFlatFeeConfig.selector));
            uint16 flatFeePromotionGlobalPercentage;
            bool isFlatFeePromotionEnabledPermanently;
            uint256 flatFeePromotionStartTimestamp;
            uint256 flatFeePromotionEndTimestamp;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                flatFeePromotionGlobalPercentage := mload(add(point, 320))
                isFlatFeePromotionEnabledPermanently := mload(add(point, 352))
                flatFeePromotionStartTimestamp := mload(add(point, 384))
                flatFeePromotionEndTimestamp := mload(add(point, 416))
            }
            feeConfig = IAdapter.FeeConfig(
                flatFeePromotionGlobalPercentage,
                isFlatFeePromotionEnabledPermanently,
                flatFeePromotionStartTimestamp,
                flatFeePromotionEndTimestamp
            );
        }
    }

    function _getSubscription(uint64 subId) internal view returns (IAdapter.Subscription memory sub) {
        (
            ,
            ,
            sub.balance,
            sub.inflightCost,
            sub.reqCount,
            sub.freeRequestCount,
            ,
            sub.reqCountInCurrentPeriod,
            sub.lastRequestTimestamp
        ) = _randcast().getSubscription(subId);
    }

    function estimateCallbackGas(bytes32 requestId) public returns (uint32 _callbackGas) {
        _callbackGas = _dryRunCallbackToEstimateGas(IAdapter.RequestType.Randomness, "", requestId) + 100_000;
    }

    function createSubscription() external virtual override returns (uint64 _subscriptionId) {
        _requireAccess(address(this), _msgSender());
        _subscriptionId = _randcast().createSubscription();
        UltimateDominionConfig.setSubscriptionId(_subscriptionId);
    }

    function _dryRunCallbackToEstimateGas(
        IAdapter.RequestType randcastRequestType,
        bytes memory params,
        bytes32 requestId
    ) internal returns (uint32) {
        // // This should be identical to adapter generated requestId.
        // bytes32 requestId = _nextRequestId(subscriptionId());

        // Prepares the message call of callback function according to request type
        bytes memory data;
        if (randcastRequestType == IAdapter.RequestType.Randomness) {
            data = abi.encodeWithSignature("rawFulfillRandomness(bytes32,uint256)", requestId, _RANDOMNESS_PLACEHOLDER);
            // } else if (randcastRequestType == IAdapter.RequestType.RandomWords) {
            //     uint32 numWords = abi.decode(params, (uint32));
            //     uint256[] memory randomWords = new uint256[](numWords);
            //     for (uint256 i = 0; i < numWords; i++) {
            //         randomWords[i] = uint256(keccak256(abi.encode(_RANDOMNESS_PLACEHOLDER, i)));
            //     }
            //     data = abi.encodeWithSelector(this.rawFulfillRandomWords.selector, requestId, randomWords);
            // } else if (randcastRequestType == IAdapter.RequestType.Shuffling) {
            //     uint32 upper = abi.decode(params, (uint32));
            //     uint256[] memory arr = new uint256[](upper);
            //     for (uint256 k = 0; k < upper; k++) {
            //         arr[k] = k;
            //     }
            //     data = abi.encodeWithSelector(this.rawFulfillShuffledArray.selector, requestId, arr);
        } else {
            revert("Unrecognized request type");
        }

        // We don't want message call for estimating gas to take effect, therefore success should be false,
        // and result should be the reverted reason, which in fact is gas used we encoded to string.

        (bool success, bytes memory result) =
        // solhint-disable-next-line avoid-low-level-calls
         getGasEstimator().call(abi.encodeWithSelector(IGasEstimator.requiredTxGas.selector, address(this), 0, data));

        // This will be 0 if message call for callback fails,
        // we pass this message to tell user that callback implementation need to be checked.
        uint256 gasUsed = _parseGasUsed(result);

        if (gasUsed > _MAX_GAS_LIMIT) {
            revert("GasLimitTooBig");
        }

        require(!success && gasUsed != 0, "fulfillRandomness dry-run failed");

        return uint32(gasUsed);
    }

    function _makeRandcastInputSeed(uint256 userSeed, uint64 subId, address requester, uint256 nonce)
        internal
        view
        returns (uint256)
    {
        return uint256(keccak256(abi.encode(block.chainid, userSeed, subId, requester, nonce)));
    }

    function _nextRequestId(uint64 subId) internal returns (bytes32) {
        if (block.chainid == 31337) {
            return keccak256(abi.encodePacked(block.timestamp, "test"));
        }
        subId = subId == 0 ? subscriptionId() : subId;
        if (subId == 0) {
            revert("NoSubscriptionBound");
        }
        uint256 rawSeed = _makeRandcastInputSeed(0, subId, address(this), getNonce(subId));
        return _makeRequestId(rawSeed);
    }

    function _makeRequestId(uint256 inputSeed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(inputSeed));
    }

    function getNonce(uint64 subId) public returns (uint256) {
        return RngNonces.getNonce(subId);
    }

    function _incrementNonce(uint64 subId) internal returns (uint256) {
        uint256 currentNonce = RngNonces.getNonce(subId);
        uint256 newNonce = currentNonce + 1;
        RngNonces.setNonce(subId, newNonce);
        return newNonce;
    }

    /**
     * @notice Parses the gas used from the revert msg
     * @param _returnData the return data of requiredTxGas
     */
    function _parseGasUsed(bytes memory _returnData) internal pure returns (uint256) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return 0; //"Transaction reverted silently";

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return StringAndUintConverter.stringToUint(abi.decode(_returnData, (string))); // All that remains is the revert string
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomNumber) internal override {
        _fullfillEntropy(requestId, randomNumber);
        emit RNGFulfilled(randomNumber);
    }

    function _fullfillEntropy(bytes32 requestId, uint256 randomNumber) internal {
        RngRequestType requestType = RandomNumbers.getRequestType(requestId);

        bytes memory _data = RandomNumbers.getArbitraryData(requestId);

        RngLogs.setRandomNumber(requestId, randomNumber);

        if (uint8(requestType) == uint8(0)) {
            bytes32 characterId = abi.decode(_data, (bytes32));
            _storeStats(randomNumber, characterId);
        } else if (uint8(requestType) == uint8(1)) {
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
            stats.baseHp = uint256(10);
        } else if (characterClass == Classes.Rogue) {
            stats.agility += 2;
            stats.baseHp = uint256(6);
        } else if (characterClass == Classes.Mage) {
            stats.intelligence += 2;
            stats.baseHp = uint256(8);
        }

        Stats.set(characterId, stats);
    }

    function _getCounter(uint256 counterNumber) internal returns (uint256 _counter) {
        _counter = Counters.get(address(this), counterNumber);
    }

    function _incrementCounter(uint256 counterNumber) internal returns (uint256 _counter) {
        _counter = Counters.get(address(this), counterNumber) + 1;
        Counters.set(address(this), counterNumber, _counter);
    }
}

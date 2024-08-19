// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
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
import {Action} from "@interfaces/Structs.sol";
import {_RANDOMNESS_PLACEHOLDER, _MAX_GAS_LIMIT} from "../../constants.sol";
import {IWorld, IPvESystem, IPvPSystem} from "@world/IWorld.sol";
import {SystemSwitch} from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import {_requireAccess} from "../utils.sol";
import "forge-std/console2.sol";

contract RngSystem is System, IRngSystem {
    using LibChunks for uint256;

    event RNGFulfilled(uint256 randomNumber);

    function _randcast() internal view returns (IAdapter randcast) {
        randcast = IAdapter(getRandcastAdapter());
    }

    function getRandcastAdapter() internal view override returns (address) {
        return UltimateDominionConfig.getRandcastAdapter();
    }

    function subscriptionId() public view returns (uint64) {
        return _randcast().getCurrentSubId();
    }

    function getRng(bytes32 userRandomNumber, RngRequestType requestType, bytes memory data)
        external
        payable
        override
        returns (bytes32 _requestId)
    {
        RandomNumbersData memory randomNumberData;
        randomNumberData.arbitraryData = data;
        randomNumberData.requestType = requestType;

        uint32 callbackGas = estimateCallbackGas();
        uint256 requestFee = estimateFee();

        IAdapter.RandomnessRequestParams memory randomnessParams = IAdapter.RandomnessRequestParams({
            requestType: IAdapter.RequestType.Randomness,
            params: "",
            subId: subscriptionId(),
            seed: uint256(userRandomNumber),
            requestConfirmations: uint16(1),
            callbackGasLimit: callbackGas,
            callbackMaxGasPrice: tx.gasprice * 3
        });
        // NOTE: required for testing, since callback is coming before data is stored
        /////////////// TODO: remove for mainnet deployment //////
        if (block.chainid == 31337) {
            // (, bytes memory returnData) = address(_randcast()).staticcall(
            //     abi.encodeWithSelector(IAdapter.requestRandomness.selector, randomnessParams)
            // );
            _requestId = keccak256(abi.encodePacked(block.timestamp, "test")); //abi.decode(returnData, (bytes32));

            RandomNumbers.set(_requestId, randomNumberData);
        }
        // pay the fees and request a random number from arpa
        _requestId = _randcast().requestRandomness(randomnessParams);

        RngLogsData memory rngLog = RngLogsData({
            subscriptionId: subscriptionId(),
            adapter: getRandcastAdapter(),
            fee: requestFee,
            requestType: requestType,
            randomNumber: 0,
            userRandomNumber: userRandomNumber,
            data: data
        });

        RngLogs.set(_requestId, rngLog);

        uint256 rng;
        uint256 timesCalled;
        if (block.chainid == 31337) {
            rng = uint256(keccak256(abi.encode((block.timestamp + timesCalled + 1234567) ** 8)));
            timesCalled++;
        } else {
            rng = uint256(keccak256(abi.encode(block.prevrandao, userRandomNumber)));
        }

        RandomNumbers.set(_requestId, randomNumberData);
    }

    function estimateFee() public override returns (uint256 _fee) {
        IAdapter.Subscription memory sub = _getSubscription(subscriptionId());
        if (sub.freeRequestCount == 0) {
            _fee = _randcast().estimatePaymentAmountInETH(estimateCallbackGas(), 550000, 0, tx.gasprice * 3, 3);
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

    function estimateCallbackGas() public pure returns (uint32 _callbackGas) {
        _callbackGas = 200000; //_dryRunCallbackToEstimateGas(IAdapter.RequestType.Randomness, "") + 30_000;
    }

    function createSubscription() external virtual override returns (uint64 _subscriptionId) {
        _requireAccess(address(this), _msgSender());
        _subscriptionId = _randcast().createSubscription();
        UltimateDominionConfig.setSubscriptionId(_subscriptionId);
    }

    function _dryRunCallbackToEstimateGas(IAdapter.RequestType randcastRequestType, bytes memory params)
        internal
        returns (uint32)
    {
        // This should be identical to adapter generated requestId.
        bytes32 requestId = _nextRequestId(subscriptionId());
        // Prepares the message call of callback function according to request type
        bytes memory data;
        if (randcastRequestType == IAdapter.RequestType.Randomness) {
            data = abi.encodeWithSignature("_fulfillRandomness(bytes32,uint256)", requestId, _RANDOMNESS_PLACEHOLDER);
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
        bool success;
        (bytes memory result) = SystemSwitch.call(abi.encodeCall(this.requiredTxGas, (address(this), 0, data)));
        // if call returns a result sucess is true
        if (result.length != 0) {
            success = true;
        }
        // (bool success, bytes memory result) =
        // // solhint-disable-next-line avoid-low-level-calls
        //  address(this).call(abi.encodeWithSelector(this.requiredTxGas.selector, address(this), 0, data));

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
        subId = subId == 0 ? _randcast().getLastSubscription(address(this)) : subId;
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
        uint256 currentNonce = RngNonces.getNonce(subId);
        uint256 newNonce = currentNonce + 1;
        RngNonces.setNonce(subId, newNonce);
        return newNonce;
    }

    /**
     * @notice Estimates gas used by actually calling that function then reverting with the gas used as string
     * @param to Destination address
     * @param value Ether value
     * @param data Data payload
     */
    function requiredTxGas(address to, uint256 value, bytes calldata data) external returns (uint256) {
        uint256 startGas = gasleft();
        // We don't provide an error message here, as we use it to return the estimate
        // solhint-disable-next-line reason-string
        require(_executeCall(to, value, data, gasleft()));
        uint256 requiredGas = startGas - gasleft();
        string memory s = StringAndUintConverter.uintToString(requiredGas);
        // Convert response to string and return via error message
        revert(s);
    }

    function _executeCall(address to, uint256 value, bytes memory data, uint256 txGas)
        internal
        returns (bool success)
    {
        // solhint-disable-next-line no-inline-assembly
        // assembly {
        //     success := call(txGas, to, value, add(data, 0x20), mload(data), 0, 0)
        // }
        (bytes memory result) = SystemSwitch.call(data);
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

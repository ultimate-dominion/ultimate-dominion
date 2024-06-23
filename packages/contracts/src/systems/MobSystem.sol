// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {RandomNumbers} from "@codegen/index.sol";
import {RngRequestType, MobType, Alignment} from "@codegen/common.sol";
import {Counters} from "@tables/Counters.sol";
import {MonsterStats} from "@interfaces/Structs.sol";
import {_requireOwner} from "../utils.sol";
import {UltimateDominionConfig} from "@codegen/index.sol";

contract MobSystem is System {
    function createMob(MobType mobType, bytes memory mobStats, string memory mobMetadataUri)
        public
        returns (uint256 mobId)
    {
        _requireOwner(address(this), _msgSender());
        uint256 mobId = _incrementMobId();
    }

    function _incrementMobId() internal returns (uint256) {
        uint256 mobId = Counters.getCounter(address(this)) + 1;
        Counters.setCounter(address(this), (mobId));
        return mobId;
    }
}

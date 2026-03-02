// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Admin, WeaponScaling, ClassMultipliers} from "@codegen/index.sol";
import {NotAdmin} from "../Errors.sol";

/**
 * @title AdminTuningSystem
 * @notice Admin functions for combat tuning (split from AdminSystem for contract size)
 */
contract AdminTuningSystem is System {
    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function adminSetWeaponScaling(uint256 itemId, bool usesAgi) public onlyAdmin {
        WeaponScaling.set(itemId, usesAgi);
    }

    function adminSetClassMultipliers(
        bytes32 characterId, uint256 physical, uint256 spell,
        uint256 healing, uint256 critDmg, uint256 maxHp
    ) public onlyAdmin {
        ClassMultipliers.set(characterId, physical, spell, healing, critDmg, maxHp);
    }
}

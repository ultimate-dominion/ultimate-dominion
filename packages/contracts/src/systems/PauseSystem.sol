// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {Admin, Paused} from "@codegen/index.sol";
import {NotAdmin} from "../Errors.sol";

contract PauseSystem is System {
    event GamePaused(address indexed admin);
    event GameUnpaused(address indexed admin);

    modifier onlyAdmin() {
        if (!Admin.get(_msgSender())) revert NotAdmin();
        _;
    }

    function pause() public onlyAdmin {
        Paused.set(true);
        emit GamePaused(_msgSender());
    }

    function unpause() public onlyAdmin {
        Paused.set(false);
        emit GameUnpaused(_msgSender());
    }

    function isPaused() public view returns (bool) {
        return Paused.get();
    }
}

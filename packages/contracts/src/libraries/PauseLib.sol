// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {Paused} from "@codegen/index.sol";
import {GamePaused} from "../Errors.sol";

library PauseLib {
    function requireNotPaused() internal view {
        if (Paused.get()) revert GamePaused();
    }
}

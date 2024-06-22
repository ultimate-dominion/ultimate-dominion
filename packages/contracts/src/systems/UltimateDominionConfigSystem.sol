// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import {System} from "@latticexyz/world/src/System.sol";
import {UltimateDominionConfig} from "../codegen/index.sol";

contract UltimateDominionConfigSystem is System {
    function getCharacterToken() public view returns (address _characterToken) {
        _characterToken = UltimateDominionConfig.getCharacterToken();
    }

    function getGoldToken() public view returns (address _goldToken) {
        _goldToken = UltimateDominionConfig.getGoldToken();
    }

    function getEntropy() public view returns (address _entropy) {
        _entropy = UltimateDominionConfig.getEntropy();
    }

    function getPythProvider() public view returns (address _provider) {
        _provider = UltimateDominionConfig.getPythProvider();
    }

    function getItemsContract() public view returns (address _erc1155) {
        _erc1155 = UltimateDominionConfig.getItems();
    }
}

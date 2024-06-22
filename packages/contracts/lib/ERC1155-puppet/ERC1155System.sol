// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ResourceId} from "@latticexyz/store/src/ResourceId.sol";
import {System} from "@latticexyz/world/src/System.sol";
import {WorldResourceIdInstance} from "@latticexyz/world/src/WorldResourceId.sol";
import {SystemRegistry} from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";

import {AccessControlLib} from "@latticexyz/world-modules/src/utils/AccessControlLib.sol";
import {PuppetMaster} from "@latticexyz/world-modules/src/modules/puppet/PuppetMaster.sol";
import {toTopic} from "@latticexyz/world-modules/src/modules/puppet/utils.sol";

import {IERC1155Receiver} from "./IERC1155Receiver.sol";
import {IERC1155} from "./IERC1155.sol";
import {IERC1155MetadataURI} from "./IERC1155MetadataURI.sol";

import {ERC1155MetadataURI} from "./tables/ERC1155MetadataURI.sol";
import {ERC1155URIStorage} from "./tables/ERC1155URIStorage.sol";
import {OperatorApproval} from "./tables/OperatorApproval.sol";
import {Owners} from "./tables/Owners.sol";
import {TotalSupply} from "./tables/TotalSupply.sol";
import {ERC1155Utils} from "./libraries/utils/ERC1155Utils.sol";

import {
    _metadataTableId,
    _erc1155URIStorageTableId,
    _totalSupplyTableId,
    _operatorApprovalTableId,
    _ownersTableId
} from "./utils.sol";

import {LibString} from "./libraries/LibString.sol";
import "forge-std/console2.sol";

contract ERC1155System is IERC1155MetadataURI, System, PuppetMaster {
    using WorldResourceIdInstance for ResourceId;
    using LibString for uint256;

    /**
     * @dev See {IERC1155-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC1155-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual returns (bool) {
        return OperatorApproval.getApproved(_operatorApprovalTableId(_namespace()), owner, operator);
    }

    /**
     * @dev See {IERC1155-transferFrom}.
     */
    function transferFrom(address from, address to, uint256 tokenId, uint256 value) public virtual {
        if (to == address(0)) revert ERC1155InvalidReceiver(to);
        // (from != 0). Therefore, it is not needed to verify that the return value is not 0 here.
        _transfer(from, to, tokenId, value);
    }

    /**
     * @dev See {IERC1155-safeTransferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, uint256 value, bytes memory data)
        public
        virtual
    {
        _safeTransferFrom(from, to, tokenId, value, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external virtual {
        if (to == address(0)) revert ERC1155InvalidReceiver(to);
        for (uint256 i; i < ids.length; i++) {
            _safeTransferFrom(from, to, ids[i], values[i], data);
        }
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * Requirements:
     *
     * - caller must own the namespace
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function mint(address to, uint256 tokenId, uint256 value, bytes memory data) public virtual {
        _requireOwner();
        if (to == address(0)) revert ERC1155InvalidReceiver(to);
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(tokenId, value);
        _update(address(0), to, ids, values);
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    // function _mint(address to, uint256 tokenId, uint256 value, bytes memory data) internal {
    //   _requireOwner();
    //   if(to == address(0))revert ERC1155InvalidReceiver(to);
    //     (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(tokenId, value);
    //     _update(address(0), to, ids, values);
    // }

    /**
     * @dev Mints `tokenId`, transfers it to `to` and checks for `to` acceptance.
     *
     * Requirements:
     *
     * - caller must own the namespace
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeMint(address to, uint256 tokenId, uint256 value, bytes memory data) public virtual {
        mint(to, tokenId, value, data);
        _checkOnERC1155Received(address(0), to, tokenId, value, data);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     * - caller must own the namespace
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function burn(uint256 tokenId, uint256 value) public {
        _burn(_msgSender(), tokenId, value);
    }

    /**
     * @dev See {IERC1155-balanceOf}.
     */
    function balanceOf(address owner, uint256 id) public view virtual returns (uint256) {
        return Owners.getBalance(_ownersTableId(_namespace()), owner, id);
    }

    /**
     * @dev See {IERC1155-balanceOfBatch}.
     *
     * Requirements:
     *
     * - `accounts` and `ids` must have the same length.
     */
    function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
        public
        view
        virtual
        returns (uint256[] memory)
    {
        if (accounts.length != ids.length) {
            revert ERC1155InvalidArrayLength(ids.length, accounts.length);
        }

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    /**
     * @dev See {IERC1155MetadataURI-uri}.
     *
     * This implementation returns the same URI for *all* token types. It relies
     * on the token type ID substitution mechanism
     * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the ERC].
     *
     * Clients calling this function must replace the `\{id\}` substring with the
     * actual token type ID.
     */
    function uri(uint256 tokenId) public view returns (string memory) {
        string memory baseURI = ERC1155MetadataURI.getUri(_metadataTableId(_namespace()));
        string memory tokenURI = ERC1155URIStorage.getUri(_erc1155URIStorageTableId(_namespace()), tokenId);

        // If token URI is set, concatenate base URI and tokenURI (via string.concat).
        return bytes(tokenURI).length > 0 ? string.concat(baseURI, tokenURI) : baseURI;
    }

    function _setTokenUri(bytes14 namespace, uint256 tokenId, string memory uri) internal {
        _requireOwner();
        ERC1155URIStorage.setUri(_erc1155URIStorageTableId(namespace), tokenId, uri);
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `owner`'s tokens, or `tokenId` in
     * particular (ignoring whether it is owned by `owner`).
     *
     * WARNING: This function assumes that `owner` is the actual owner of `tokenId` and does not verify this
     * assumption.
     */
    function _isAuthorized(address owner, address spender) internal view virtual returns (bool) {
        return spender != address(0) && (owner == spender || isApprovedForAll(owner, spender));
    }

    /**
     * @dev Unsafe write access to the balances, used by extensions that 'mint' tokens using an {ownerOf} override.
     *
     * NOTE: the value is limited to type(uint128).max. This protect against _balance overflow. It is unrealistic that
     * a uint256 would ever overflow from increments when these increments are bounded to uint128 values.
     *
     * WARNING: Increasing an account's balance using this function tends to be paired with an override of the
     * {_ownerOf} function to resolve the ownership of the corresponding tokens so that balances and ownership
     * remain consistent with one another.
     */
    function _setAccountBalance(address account, uint256 tokenId, int256 delta) internal returns (uint256 balance) {
        if (delta < 0) {
            balance = uint256(balanceOf(account, tokenId) - uint256(-delta));
        } else {
            balance = uint256(balanceOf(account, tokenId) + uint256(delta));
        }
        Owners.setBalance(_ownersTableId(_namespace()), account, tokenId, balance);
    }

    function _setTotalSupply(uint256 tokenId, int256 delta) internal returns (uint256 supply) {
        uint256 totalSupply = TotalSupply.getTotalSupply(_totalSupplyTableId(_namespace()), tokenId);
        if (delta < 0) {
            supply = totalSupply - uint256(-delta);
        } else {
            supply = totalSupply + uint256(delta);
        }
        TotalSupply.setTotalSupply(_totalSupplyTableId(_namespace()), tokenId, supply);
    }

    /**
     * @dev Transfers `tokenId` from its current owner to `to`, or alternatively mints (or burns) if the current owner
     * (or `to`) is the zero address. Returns the owner of the `tokenId` before the update.
     *
     * The `auth` argument is optional. If the value passed is non 0, then this function will check that
     * `auth` is either the owner of the token, or approved to operate on the token (by the owner).
     *
     * Emits a {Transfer} event.
     *
     * NOTE: If overriding this function in a way that tracks balances, see also {_increaseBalance}.
     */
    function _update(address from, address to, uint256[] memory tokenIds, uint256[] memory _values)
        internal
        virtual
        returns (address)
    {
        uint256 len = tokenIds.length;
        if (len != _values.length) revert ERC1155InvalidArrayLength(len, _values.length);
        if (_msgSender() != from && from != address(0)) {
            if (!_isAuthorized(from, _msgSender())) revert ERC1155MissingApprovalForAll(_msgSender(), from);
        }

        // check if both to and from are address(0)
        if (from == address(0) && to == address(0)) revert ERC1155NonexistentToken(10);
        uint256 fromBalance;
        uint256 tokenId;
        uint256 _value;
        for (uint256 i; i < len; i++) {
            tokenId = tokenIds[i];
            _value = _values[i];

            if (from == address(0)) {
                _requireOwner();
                // Overflow check required: The rest of the code assumes that totalSupply never overflows
                _setTotalSupply(tokenId, int256(_value));
            } else {
                if (TotalSupply.getTotalSupply(_totalSupplyTableId(_namespace()), tokenId) == 0) {
                    revert ERC1155NonexistentToken(tokenId);
                }
                fromBalance = balanceOf(from, tokenId);
                if (fromBalance < _value) {
                    revert ERC1155InsufficientBalance(from, fromBalance, _value, tokenId);
                }
            }

            // Perform (optional) operator check
            if (to != address(0)) {
                unchecked {
                    _setAccountBalance(to, tokenId, int256(_value));
                }
            }

            // Execute the update
            if (from != address(0)) {
                unchecked {
                    _setAccountBalance(from, tokenId, -int256(_value));
                }
            }
        }

        if (len == 1) {
            // Emit Transfer event on puppet
            puppet().log(
                TransferSingle.selector,
                toTopic(_msgSender()),
                toTopic(from),
                toTopic(to),
                abi.encode(tokenIds[0], _values[0])
            );
        } else {
            puppet().log(
                TransferBatch.selector, toTopic(_msgSender()), toTopic(from), toTopic(to), abi.encode(tokenIds, _values)
            );
        }
        return from;
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     * This is an internal function that does not check if the sender is authorized to operate on the token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(address account, uint256 tokenId, uint256 value) internal {
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(tokenId, value);

        _update(account, address(0), ids, values);
        _setTotalSupply(tokenId, -int256(value));
    }

    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(address from, address to, uint256 tokenId, uint256 value) internal {
        if (to == address(0)) {
            revert ERC1155InvalidReceiver(address(0));
        }
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(tokenId, value);
        _update(from, to, ids, values);
    }

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking that contract recipients
     * are aware of the ERC1155 standard to prevent tokens from being forever locked.
     *
     * `data` is additional data, it has no specified format and it is sent in call to `to`.
     *
     * This internal function is like {safeTransferFrom} in the sense that it invokes
     * {IERC1155Receiver-onERC1155Received} on the receiver, and can be used to e.g.
     * implement alternative mechanisms to perform token transfer, such as signature-based.
     *
     * Requirements:
     *
     * - `tokenId` token must exist and be owned by `from`.
     * - `to` cannot be the zero address.
     * - `from` cannot be the zero address.
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeTransfer(address from, address to, uint256 tokenId, uint256 value) internal {
        _safeTransfer(from, to, tokenId, value, "");
    }

    /**
     * @dev Transfers a `value` tokens of token type `id` from `from` to `to`.
     *
     * Emits a {TransferSingle} event.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `from` must have a balance of tokens of type `id` of at least `value` amount.
     * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
     * acceptance magic value.
     */
    function _safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data) internal {
        if (to == address(0)) {
            revert ERC1155InvalidReceiver(address(0));
        }
        if (from == address(0)) {
            revert ERC1155InvalidSender(address(0));
        }
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(id, value);
        _updateWithAcceptanceCheck(from, to, ids, values, data);
    }

    /**
     * @dev Version of {_update} that performs the token acceptance check by calling
     * {IERC1155Receiver-onERC1155Received} or {IERC1155Receiver-onERC1155BatchReceived} on the receiver address if it
     * contains code (eg. is a smart contract at the moment of execution).
     *
     * IMPORTANT: Overriding this function is discouraged because it poses a reentrancy risk from the receiver. So any
     * update to the contract state after this function would break the check-effect-interaction pattern. Consider
     * overriding {_update} instead.
     */
    function _updateWithAcceptanceCheck(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) internal virtual {
        // todo create _update that takes an array of ids and values
        _update(from, to, ids, values);
        if (to != address(0)) {
            address operator = _msgSender();
            if (ids.length == 1) {
                uint256 id = ids[0];
                uint256 value = values[0];
                ERC1155Utils.checkOnERC1155Received(operator, from, to, id, value, data);
            } else {
                ERC1155Utils.checkOnERC1155BatchReceived(operator, from, to, ids, values, data);
            }
        }
    }

    /**
     * @dev Creates an array in memory with only one value for each of the elements provided.
     */
    function _asSingletonArrays(uint256 element1, uint256 element2)
        private
        pure
        returns (uint256[] memory array1, uint256[] memory array2)
    {
        /// @solidity memory-safe-assembly
        assembly {
            // Load the free memory pointer
            array1 := mload(0x40)
            // Set array length to 1
            mstore(array1, 1)
            // Store the single element at the next word after the length (where content starts)
            mstore(add(array1, 0x20), element1)

            // Repeat for next array locating it right after the first array
            array2 := add(array1, 0x40)
            mstore(array2, 1)
            mstore(add(array2, 0x20), element2)

            // Update the free memory pointer by pointing after the second array
            mstore(0x40, add(array2, 0x40))
        }
    }

    /**
     * @dev Same as {xref-ERC1155-_safeTransfer-address-address-uint256-}[`_safeTransfer`], with an additional `data` parameter which is
     * forwarded in {IERC1155Receiver-onERC1155Received} to contract recipients.
     */
    function _safeTransfer(address from, address to, uint256 tokenId, uint256 value, bytes memory data)
        internal
        virtual
    {
        (uint256[] memory ids, uint256[] memory values) = _asSingletonArrays(tokenId, value);
        _updateWithAcceptanceCheck(_msgSender(), to, ids, values, data);
    }

    /**
     * @dev Approve `operator` to operate on all of `owner` tokens
     *
     * Requirements:
     * - operator can't be the address zero.
     *
     * Emits an {ApprovalForAll} event.
     */
    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        if (operator == address(0)) {
            revert ERC1155InvalidOperator(operator);
        }
        OperatorApproval.set(_operatorApprovalTableId(_namespace()), owner, operator, approved);

        // Emit ApprovalForAll event on puppet
        puppet().log(ApprovalForAll.selector, toTopic(owner), toTopic(operator), abi.encode(approved));
    }

    /**
     * @dev Private function to invoke {IERC1155Receiver-onERC1155Received} on a target address. This will revert if the
     * recipient doesn't accept the token transfer. The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param value the amount of a token being sent
     * @param data bytes optional data to send along with the call
     */
    function _checkOnERC1155Received(address from, address to, uint256 tokenId, uint256 value, bytes memory data)
        private
    {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155Received(_msgSender(), from, tokenId, value, data) returns (bytes4 retval)
            {
                if (retval != IERC1155Receiver.onERC1155Received.selector) {
                    revert ERC1155InvalidReceiver(to);
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert ERC1155InvalidReceiver(to);
                } else {
                    /// @solidity memory-safe-assembly
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        }
    }

    function onERC1155Received(
        address, /* to **/
        address, /* from **/
        uint256, /* tokenId **/
        uint256, /* value **/
        bytes calldata /* data **/
    ) external returns (bytes4 retval) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address, /* to **/
        address, /* from **/
        uint256[] calldata, /* tokenIds **/
        uint256[] calldata, /* values **/
        bytes calldata /* data **/
    ) external returns (bytes4 retval) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function _namespace() internal view returns (bytes14 namespace) {
        ResourceId systemId = SystemRegistry.get(address(this));
        return systemId.getNamespace();
    }

    function _requireOwner() internal view {
        AccessControlLib.requireOwner(SystemRegistry.get(address(this)), _msgSender());
    }
}

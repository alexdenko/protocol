// SPDX-License-Identifier: GPL-3.0

/*
    This file is part of the Enzyme Protocol.

    (c) Enzyme Council <council@enzyme.finance>

    For the full license information, please view the LICENSE
    file that was distributed with this source code.
*/

import "../../../core/fund/external-positions/IExternalPosition.sol";
import "../../../core/fund/external-positions/CompoundDebtPositionLib.sol";
import "../../../infrastructure/price-feeds/derivatives/feeds/CompoundPriceFeed.sol";
import "../../../infrastructure/price-feeds/derivatives/IDerivativePriceFeed.sol";
import "../../../infrastructure/price-feeds/primitives/IPrimitivePriceFeed.sol";
import "./IExternalPositionParser.sol";

pragma solidity 0.6.12;

/// @title CompoundDebtPositionParser
/// @author Enzyme Council <security@enzyme.finance>
/// @notice Parser for Compound Debt Positions
contract CompoundDebtPositionParser is IExternalPositionParser {
    using AddressArrayLib for address[];

    address private immutable COMPOUND_PRICE_FEED;
    address private immutable DERIVATIVE_PRICE_FEED;
    address private immutable PRIMITIVE_PRICE_FEED;

    constructor(
        address _compoundPriceFeed,
        address _derivativePriceFeed,
        address _primitivePriceFeed
    ) public {
        COMPOUND_PRICE_FEED = _compoundPriceFeed;
        DERIVATIVE_PRICE_FEED = _derivativePriceFeed;
        PRIMITIVE_PRICE_FEED = _primitivePriceFeed;
    }

    /// @notice Parses the assets to send and receive for the callOnExternalPosition
    /// @param _actionId The _actionId for the callOnExternalPosition
    /// @param _encodedActionArgs The encoded parameters for the callOnExternalPosition
    /// @return assetsToTransfer_ The assets to be transfered from the Vault
    /// @return amountsToTransfer_ The amounts to be transfered from the Vault
    /// @return assetsToReceive_ The assets to be received at the Vault
    function parseAssetsForAction(uint256 _actionId, bytes memory _encodedActionArgs)
        external
        override
        returns (
            address[] memory assetsToTransfer_,
            uint256[] memory amountsToTransfer_,
            address[] memory assetsToReceive_
        )
    {
        (
            address[] memory assets,
            uint256[] memory amounts,
            bytes memory data
        ) = __decodeEncodedActionArgs(_encodedActionArgs);

        __validateActionData(_actionId, assets, data);

        if (
            _actionId == uint256(ICompoundDebtPosition.ExternalPositionActions.AddCollateral) ||
            _actionId == uint256(ICompoundDebtPosition.ExternalPositionActions.RepayBorrow)
        ) {
            assetsToTransfer_ = assets;
            amountsToTransfer_ = amounts;
        } else if (
            _actionId == uint256(ICompoundDebtPosition.ExternalPositionActions.Borrow) ||
            _actionId == uint256(ICompoundDebtPosition.ExternalPositionActions.RemoveCollateral)
        ) {
            assetsToReceive_ = assets;
        }

        return (assetsToTransfer_, amountsToTransfer_, assetsToReceive_);
    }

    /// @notice Parse and validate input argumens to be used at the `init` function
    /// @param _vaultProxy Address of the VaultProxy that owns the ExternalPosition
    /// @return initArgs_ Arguments that will be passed as an argument to the ExternalPosition's `init` function
    function parseInitArgs(address _vaultProxy, bytes memory)
        external
        override
        returns (bytes memory initArgs_)
    {
        return abi.encode(_vaultProxy);
    }

    // PRIVATE FUNCTIONS

    /// @dev Helper to decode action args
    function __decodeEncodedActionArgs(bytes memory _encodeActionArgs)
        private
        pure
        returns (
            address[] memory assets_,
            uint256[] memory amounts_,
            bytes memory data_
        )
    {
        (assets_, amounts_, data_) = abi.decode(_encodeActionArgs, (address[], uint256[], bytes));

        return (assets_, amounts_, data_);
    }

    /// @dev Helper to check if an asset is supported
    function __isSupportedAsset(address _asset) private view returns (bool isSupported_) {
        return
            IPrimitivePriceFeed(getPrimitivePriceFeed()).isSupportedAsset(_asset) ||
            IDerivativePriceFeed(getDerivativePriceFeed()).isSupportedAsset(_asset);
    }

    /// @dev Runs validations before running a callOnExternalPosition.
    function __validateActionData(
        uint256 _actionId,
        address[] memory _assets,
        bytes memory _data
    ) private view {
        // Borrow and RepayBorrow actions make use of cTokens, that also need to be validated
        if (_actionId == uint256(ICompoundDebtPosition.ExternalPositionActions.Borrow)) {
            for (uint256 i; i < _assets.length; i++) {
                require(__isSupportedAsset(_assets[i]), "__validateActionData: Unsupported asset");
            }
            __validateCTokens(abi.decode(_data, (address[])), _assets);
        } else if (
            _actionId == uint256(ICompoundDebtPosition.ExternalPositionActions.RepayBorrow)
        ) {
            __validateCTokens(abi.decode(_data, (address[])), _assets);
        }
    }

    /// @dev Validates a set of cTokens and the underlying tokens
    function __validateCTokens(address[] memory _cTokens, address[] memory _tokens) private view {
        require(
            _cTokens.length == _tokens.length,
            "__validateCTokens: Unequal assets and cTokens length"
        );

        for (uint256 i; i < _cTokens.length; i++) {
            // No need to assert from an address(0) tokenFromCToken since assets[i] cannot be '0' at this point.
            require(
                CompoundPriceFeed(getCompoundPriceFeed()).getTokenFromCToken(_cTokens[i]) ==
                    _tokens[i],
                "__validateCTokens: Bad token cToken pair"
            );
        }
    }

    ///////////////////
    // STATE GETTERS //
    ///////////////////

    /// @notice Gets the `COMPOUND_PRICE_FEED` variable
    /// @return compoundPriceFeed_ The `COMPOUND_PRICE_FEED` variable value
    function getCompoundPriceFeed() public view returns (address compoundPriceFeed_) {
        return COMPOUND_PRICE_FEED;
    }

    /// @notice Gets the `DERIVATIVE_PRICE_FEED` variable
    /// @return derivativePriceFeed_ The `DERIVATIVE_PRICE_FEED` variable value
    function getDerivativePriceFeed() public view returns (address derivativePriceFeed_) {
        return DERIVATIVE_PRICE_FEED;
    }

    /// @notice Gets the `PRIMITIVE_PRICE_FEED` variable
    /// @return primitivePriceFeed_ The `PRIMITIVE_PRICE_FEED` variable value
    function getPrimitivePriceFeed() public view returns (address primitivePriceFeed_) {
        return PRIMITIVE_PRICE_FEED;
    }
}
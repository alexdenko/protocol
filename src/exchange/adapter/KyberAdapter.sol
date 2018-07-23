pragma solidity ^0.4.21;

import "./ExchangeAdapterInterface.sol";
import "../thirdparty/kyber/KyberNetworkProxy.sol";
import "../../Fund.sol";
import "../../dependencies/DBC.sol";
import "../../assets/Asset.sol";
import "../../assets/WETH9.sol";
import "../../dependencies/math.sol";

contract KyberAdapter is ExchangeAdapterInterface, DBC, DSMath {

    address public constant ETH_TOKEN_ADDRESS = 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;

    // NON-CONSTANT METHODS

    // Responsibilities of makeOrder are:
    // - check price recent
    // - check risk management passes
    // - approve funds to be traded (if necessary)
    // - make order on the exchange
    // - check order was made (if possible)
    // - place asset in ownedAssets if not already tracked
    /// @notice Makes an order on the selected exchange
    /// @dev These orders are not expected to settle immediately
    /// @param targetExchange Address of the exchange
    /// @param orderAddresses [2] Order maker asset
    /// @param orderAddresses [3] Order taker asset
    /// @param orderValues [0] Maker token quantity
    /// @param orderValues [1] Taker token quantity
    function makeOrder(
        address targetExchange,
        address[5] orderAddresses,
        uint[8] orderValues,
        bytes32 identifier,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
    {
        require(Fund(address(this)).owner() == msg.sender);
        require(!Fund(address(this)).isShutDown());

        address nativeAsset = Fund(address(this)).NATIVE_ASSET();
        address makerAsset = orderAddresses[2];
        address takerAsset = orderAddresses[3];
        uint makerQuantity = orderValues[0];
        uint takerQuantity = orderValues[1];
        uint minRate = 0;
        uint actualReceiveQuantity;

        if (takerQuantity != 0) {
            minRate = calcMinRate(
                  makerAsset,
                  takerAsset,
                  makerQuantity,
                  takerQuantity
              );
        }

        if (makerAsset == nativeAsset) {
            actualReceiveQuantity = swapNativeAssetToToken(targetExchange, nativeAsset, makerQuantity, takerAsset, minRate);
        }
        else if (takerAsset == nativeAsset) {
            actualReceiveQuantity = swapTokenToNativeAsset(targetExchange, makerAsset, makerQuantity, nativeAsset, minRate);
        }

        require(makeOrderPermitted(makerQuantity, makerAsset, actualReceiveQuantity, takerAsset));
        require(
            Fund(address(this)).isInAssetList(takerAsset) ||
            Fund(address(this)).getOwnedAssetsLength() < Fund(address(this)).MAX_FUND_ASSETS()
        );

        Fund(address(this)).addAssetToOwnedAssets(takerAsset);
        Fund(address(this)).orderUpdateHook(
            targetExchange,
            bytes32(0),
            Fund.UpdateType.make,
            [address(makerAsset), address(takerAsset)],
            [makerQuantity, actualReceiveQuantity, actualReceiveQuantity]
        );
    }

    /// @dev Dummy function; not implemented on exchange
    function takeOrder(
        address targetExchange,
        address[5] orderAddresses,
        uint[8] orderValues,
        bytes32 identifier,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) {
        revert();
    }

    // responsibilities of cancelOrder are:
    // - check sender is this contract or owner, or that order expired
    // - remove order from tracking array
    // - cancel order on exchange
    /// @notice Cancels orders that were not expected to settle immediately
    /// @param targetExchange Address of the exchange
    /// @param orderAddresses [2] Order maker asset
    /// @param identifier Order ID on the exchange
    function cancelOrder(
        address targetExchange,
        address[5] orderAddresses,
        uint[8] orderValues,
        bytes32 identifier,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
    {
        revert();
    }

    // VIEW FUNCTIONS

    function getOrder(
        address targetExchange,
        uint id
    )
        view
        returns (
            address makerAsset, address takerAsset,
            uint makerQuantity, uint takerQuantity
        )
    {
        revert();
    }

    // INTERNAL FUNCTIONS

    function swapNativeAssetToToken(
        address targetExchange,
        address nativeAsset,
        uint makerQuantity,
        address takerAsset,
        uint minRate
    )
        internal
        returns (uint receivedAmount)
    {
        WETH9(nativeAsset).withdraw(makerQuantity);
        if (minRate == 0) (, minRate) = KyberNetworkProxy(targetExchange).getExpectedRate(ERC20(ETH_TOKEN_ADDRESS), ERC20(takerAsset), makerQuantity);
        receivedAmount = KyberNetworkProxy(targetExchange).swapEtherToToken.value(makerQuantity)(ERC20(takerAsset), minRate);
    }

    function swapTokenToNativeAsset(
        address targetExchange,
        address makerAsset,
        uint makerQuantity,
        address nativeAsset,
        uint minRate
    )
        internal
        returns (uint receivedAmount)
    {
        if (minRate == 0) (, minRate) = KyberNetworkProxy(targetExchange).getExpectedRate(ERC20(makerAsset), ERC20(ETH_TOKEN_ADDRESS), makerQuantity);
        ERC20(makerAsset).approve(targetExchange, makerQuantity);
        receivedAmount = KyberNetworkProxy(targetExchange).swapTokenToEther(ERC20(makerAsset), makerQuantity, minRate);
        WETH9(nativeAsset).deposit.value(receivedAmount)();
    }

    function swapTokenToToken(
        address targetExchange,
        address makerAsset,
        uint makerQuantity,
        address takerAsset,
        uint minRate
    )
        internal
        returns (uint receivedAmount)
    {

        if (minRate == 0) (, minRate) = KyberNetworkProxy(targetExchange).getExpectedRate(ERC20(makerAsset), ERC20(takerAsset), makerQuantity);
        ERC20(makerAsset).approve(targetExchange, makerQuantity);
        receivedAmount = KyberNetworkProxy(targetExchange).swapTokenToToken(ERC20(makerAsset), makerQuantity, ERC20(takerAsset), minRate);
    }

    function calcMinRate(
        address makerAsset,
        address takerAsset,
        uint makerQuantity,
        uint takerQuantity
    )
        internal
        view
        returns (uint minRate)
    {
        var (pricefeed, , ,) = Fund(address(this)).modules();
        minRate = pricefeed.getOrderPriceInfo(
            makerAsset,
            takerAsset,
            makerQuantity,
            takerQuantity
        );
    }

    /// @dev needed to avoid stack too deep error
    function makeOrderPermitted(
        uint makerQuantity,
        address makerAsset,
        uint takerQuantity,
        address takerAsset
    )
        internal
        view
        returns (bool)
    {
        require(takerAsset != address(this) && makerAsset != address(this));
        var (pricefeed, , riskmgmt) = Fund(address(this)).modules();
        require(pricefeed.existsPriceOnAssetPair(makerAsset, takerAsset));
        var (isRecent, referencePrice, ) = pricefeed.getReferencePriceInfo(makerAsset, takerAsset);
        require(isRecent);
        uint orderPrice = pricefeed.getOrderPriceInfo(
            makerAsset,
            takerAsset,
            makerQuantity,
            takerQuantity
        );
        return(
            riskmgmt.isMakePermitted(
                orderPrice,
                referencePrice,
                makerAsset,
                takerAsset,
                makerQuantity,
                takerQuantity
            )
        );
    }
}

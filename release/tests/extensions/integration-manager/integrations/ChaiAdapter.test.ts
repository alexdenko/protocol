import { EthereumTestnetProvider } from '@crestproject/crestproject';
import { assertEvent } from '@melonproject/utils';
import { utils } from 'ethers';
import { defaultTestDeployment } from '../../../../';
import {
  assetTransferArgs,
  chaiLend,
  chaiLendArgs,
  chaiRedeem,
  chaiRedeemArgs,
  createNewFund,
  getAssetBalances,
  lendSelector,
  redeemSelector,
  spendAssetsHandleTypes,
} from '../../../utils';

async function snapshot(provider: EthereumTestnetProvider) {
  const { accounts, deployment, config } = await defaultTestDeployment(
    provider,
  );

  const [fundOwner, ...remainingAccounts] = accounts;
  const { comptrollerProxy, vaultProxy } = await createNewFund({
    signer: config.deployer,
    fundOwner,
    fundDeployer: deployment.fundDeployer,
    denominationAsset: deployment.tokens.weth,
  });

  return {
    accounts: remainingAccounts,
    deployment,
    config,
    fund: {
      comptrollerProxy,
      fundOwner,
      vaultProxy,
    },
  };
}

describe('constructor', () => {
  it('sets state vars', async () => {
    const {
      deployment: { chaiAdapter, integrationManager },
      config: {
        integratees: {
          chai,
          makerDao: { dai },
        },
      },
    } = await provider.snapshot(snapshot);

    const getChaiCall = chaiAdapter.getChai();
    await expect(getChaiCall).resolves.toBe(chai);

    const getDaiCall = chaiAdapter.getDai();
    await expect(getDaiCall).resolves.toBe(dai);

    const getIntegrationManagerCall = chaiAdapter.getIntegrationManager();
    await expect(getIntegrationManagerCall).resolves.toBe(
      integrationManager.address,
    );
  });
});

describe('parseAssetsForMethod', () => {
  it('does not allow a bad selector', async () => {
    const {
      deployment: { chaiAdapter },
    } = await provider.snapshot(snapshot);

    const args = await chaiLendArgs({
      outgoingDaiAmount: 1,
      expectedIncomingChaiAmount: 1,
    });
    const badSelectorParseAssetsCall = chaiAdapter.parseAssetsForMethod(
      utils.randomBytes(4),
      args,
    );
    await expect(badSelectorParseAssetsCall).rejects.toBeRevertedWith(
      '_selector invalid',
    );

    const goodSelectorParseAssetsCall = chaiAdapter.parseAssetsForMethod(
      lendSelector,
      args,
    );
    await expect(goodSelectorParseAssetsCall).resolves.toBeTruthy();
  });

  it('generates expected output for lending', async () => {
    const {
      deployment: { chaiAdapter },
      config: {
        integratees: {
          chai,
          makerDao: { dai },
        },
      },
    } = await provider.snapshot(snapshot);

    const incomingAsset = chai;
    const incomingAmount = utils.parseEther('1');
    const outgoingAsset = dai;
    const outgoingAmount = utils.parseEther('1');

    const args = await chaiLendArgs({
      outgoingDaiAmount: incomingAmount,
      expectedIncomingChaiAmount: outgoingAmount,
    });
    const selector = lendSelector;

    const {
      spendAssetsHandleType_,
      incomingAssets_,
      spendAssets_,
      spendAssetAmounts_,
      minIncomingAssetAmounts_,
    } = await chaiAdapter.parseAssetsForMethod(selector, args);

    expect({
      spendAssetsHandleType_,
      incomingAssets_,
      spendAssets_,
      spendAssetAmounts_,
      minIncomingAssetAmounts_,
    }).toMatchObject({
      spendAssetsHandleType_: spendAssetsHandleTypes.Transfer,
      incomingAssets_: [incomingAsset],
      spendAssets_: [outgoingAsset],
      spendAssetAmounts_: [outgoingAmount],
      minIncomingAssetAmounts_: [incomingAmount],
    });
  });

  it('generates expected output for redeeming', async () => {
    const {
      deployment: { chaiAdapter },
      config: {
        integratees: {
          chai,
          makerDao: { dai },
        },
      },
    } = await provider.snapshot(snapshot);

    const incomingAsset = dai;
    const incomingAmount = utils.parseEther('1');
    const outgoingAsset = chai;
    const outgoingAmount = utils.parseEther('1');

    const args = await chaiRedeemArgs({
      outgoingChaiAmount: outgoingAmount,
      expectedIncomingDaiAmount: incomingAmount,
    });
    const selector = redeemSelector;

    const {
      spendAssetsHandleType_,
      incomingAssets_,
      spendAssets_,
      spendAssetAmounts_,
      minIncomingAssetAmounts_,
    } = await chaiAdapter.parseAssetsForMethod(selector, args);

    expect({
      spendAssetsHandleType_,
      incomingAssets_,
      spendAssets_,
      spendAssetAmounts_,
      minIncomingAssetAmounts_,
    }).toMatchObject({
      spendAssetsHandleType_: spendAssetsHandleTypes.Transfer,
      incomingAssets_: [incomingAsset],
      spendAssets_: [outgoingAsset],
      spendAssetAmounts_: [outgoingAmount],
      minIncomingAssetAmounts_: [incomingAmount],
    });
  });
});

describe('lend', () => {
  it('can only be called via the IntegrationManager', async () => {
    const {
      deployment: { chaiAdapter },
      fund: { vaultProxy },
    } = await provider.snapshot(snapshot);

    const lendArgs = await chaiLendArgs({
      outgoingDaiAmount: 1,
      expectedIncomingChaiAmount: 1,
    });
    const transferArgs = await assetTransferArgs({
      adapter: chaiAdapter,
      selector: lendSelector,
      encodedCallArgs: lendArgs,
    });

    const badLendTx = chaiAdapter.lend(vaultProxy, lendArgs, transferArgs);
    await expect(badLendTx).rejects.toBeRevertedWith(
      'Only the IntegrationManager can call this function',
    );
  });

  it('works as expected when called by a fund', async () => {
    const {
      deployment: {
        chaiAdapter,
        chaiIntegratee: chai,
        integrationManager,
        tokens: { dai },
      },
      fund: { comptrollerProxy, fundOwner, vaultProxy },
    } = await provider.snapshot(snapshot);
    const daiAmount = utils.parseEther('1');
    const minChaiAmount = daiAmount; // Mock rate is 1:1

    // Seed fund vault with enough DAI for tx
    await dai.transfer(vaultProxy, daiAmount);

    const [preTxChaiBalance, preTxDaiBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [chai, dai],
    });

    const lendTx = chaiLend({
      comptrollerProxy,
      vaultProxy,
      integrationManager,
      fundOwner,
      chaiAdapter,
      dai,
      daiAmount,
      minChaiAmount,
    });

    const [postTxChaiBalance, postTxDaiBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [chai, dai],
    });

    const expectedChaiAmount = daiAmount;
    expect(postTxChaiBalance).toEqBigNumber(
      preTxChaiBalance.add(expectedChaiAmount),
    );
    expect(postTxDaiBalance).toEqBigNumber(preTxDaiBalance.sub(daiAmount));

    const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent(
      'CallOnIntegrationExecutedForFund',
    );
    await assertEvent(lendTx, CallOnIntegrationExecutedForFundEvent, {
      comptrollerProxy: comptrollerProxy.address,
      vaultProxy: vaultProxy.address,
      caller: await fundOwner.getAddress(),
      adapter: chaiAdapter.address,
      incomingAssets: [chai.address],
      incomingAssetAmounts: [minChaiAmount],
      outgoingAssets: [dai.address],
      outgoingAssetAmounts: [daiAmount],
    });
  });

  it('reverts if the incoming asset amount is too low', async () => {
    const {
      deployment: {
        chaiAdapter,
        integrationManager,
        tokens: { dai },
      },
      fund: { comptrollerProxy, fundOwner, vaultProxy },
    } = await provider.snapshot(snapshot);
    const daiAmount = utils.parseEther('1');
    const minChaiAmount = utils.parseEther('2'); // Expect to receive twice as much as the current rate.

    const lendTx = chaiLend({
      comptrollerProxy,
      vaultProxy,
      integrationManager,
      fundOwner,
      chaiAdapter,
      dai,
      daiAmount,
      minChaiAmount,
      seedFund: true,
    });
    await expect(lendTx).rejects.toBeRevertedWith(
      'received incoming asset less than expected',
    );
  });
});

describe('redeem', () => {
  it('can only be called via the IntegrationManager', async () => {
    const {
      deployment: { chaiAdapter },
      fund: { vaultProxy },
    } = await provider.snapshot(snapshot);

    const redeemArgs = await chaiRedeemArgs({
      outgoingChaiAmount: utils.parseEther('1'),
      expectedIncomingDaiAmount: utils.parseEther('1'),
    });
    const transferArgs = await assetTransferArgs({
      adapter: chaiAdapter,
      selector: redeemSelector,
      encodedCallArgs: redeemArgs,
    });

    const redeemTx = chaiAdapter.redeem(vaultProxy, redeemArgs, transferArgs);
    await expect(redeemTx).rejects.toBeRevertedWith(
      'Only the IntegrationManager can call this function',
    );
  });

  it('works as expected when called by a fund', async () => {
    const {
      deployment: {
        chaiAdapter,
        chaiIntegratee: chai,
        integrationManager,
        tokens: { dai },
      },
      fund: { comptrollerProxy, fundOwner, vaultProxy },
    } = await provider.snapshot(snapshot);
    const chaiAmount = utils.parseEther('1');
    const minDaiAmount = chaiAmount; // Mock rate is 1:1

    // Seed fund vault with enough CHAI for tx
    await chai.transfer(vaultProxy, chaiAmount);

    const [preTxChaiBalance, preTxDaiBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [chai, dai],
    });

    const redeemTx = chaiRedeem({
      comptrollerProxy,
      vaultProxy,
      integrationManager,
      fundOwner,
      chaiAdapter,
      chai,
      chaiAmount,
      minDaiAmount,
    });

    const [postTxChaiBalance, postTxDaiBalance] = await getAssetBalances({
      account: vaultProxy,
      assets: [chai, dai],
    });

    const expectedDaiAmount = chaiAmount;
    expect(postTxChaiBalance).toEqBigNumber(preTxChaiBalance.sub(chaiAmount));
    expect(postTxDaiBalance).toEqBigNumber(
      preTxDaiBalance.add(expectedDaiAmount),
    );

    const CallOnIntegrationExecutedForFundEvent = integrationManager.abi.getEvent(
      'CallOnIntegrationExecutedForFund',
    );
    await assertEvent(redeemTx, CallOnIntegrationExecutedForFundEvent, {
      comptrollerProxy: comptrollerProxy.address,
      vaultProxy: vaultProxy.address,
      caller: await fundOwner.getAddress(),
      adapter: chaiAdapter.address,
      incomingAssets: [dai.address],
      incomingAssetAmounts: [minDaiAmount],
      outgoingAssets: [chai.address],
      outgoingAssetAmounts: [chaiAmount],
    });
  });

  it('reverts if the incoming asset amount is too low', async () => {
    const {
      deployment: { chaiAdapter, chaiIntegratee: chai, integrationManager },
      fund: { comptrollerProxy, fundOwner, vaultProxy },
    } = await provider.snapshot(snapshot);
    const chaiAmount = utils.parseEther('1');
    const minDaiAmount = utils.parseEther('2'); // Expect to receive twice as much as the current rate.

    const redeemTx = chaiRedeem({
      comptrollerProxy,
      vaultProxy,
      integrationManager,
      fundOwner,
      chaiAdapter,
      chai,
      chaiAmount,
      minDaiAmount,
      seedFund: true,
    });
    await expect(redeemTx).rejects.toBeRevertedWith(
      'received incoming asset less than expected',
    );
  });
});
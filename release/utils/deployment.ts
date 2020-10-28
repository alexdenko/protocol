import { AddressLike } from '@crestproject/crestproject';
import { describeDeployment } from '@melonproject/utils';
import { BigNumberish, BytesLike, Signer } from 'ethers';
import { BuySharesPriceFeedTolerance } from '../codegen/BuySharesPriceFeedTolerance';
import {
  AdapterBlacklist,
  AdapterWhitelist,
  AggregatedDerivativePriceFeed,
  AssetBlacklist,
  AssetWhitelist,
  ChaiAdapter,
  ChainlinkPriceFeed,
  ChaiPriceFeed,
  ComptrollerLib,
  Engine,
  EngineAdapter,
  EntranceRateFee,
  FeeManager,
  FundCalculator,
  FundDeployer,
  FundLifecycleLib,
  IntegrationManager,
  InvestorWhitelist,
  KyberAdapter,
  ManagementFee,
  MaxConcentration,
  PerformanceFee,
  PermissionedVaultActionLib,
  PolicyManager,
  TrackedAssetsAdapter,
  ValueInterpreter,
  VaultLib,
  ZeroExV2Adapter,
} from './contracts';

export interface ReleaseDeploymentConfig {
  deployer: Signer;
  dispatcher: AddressLike;
  mgm: AddressLike;
  weth: AddressLike;
  mln: AddressLike;
  registeredVaultCalls: {
    contracts: AddressLike[];
    selectors: BytesLike[];
  };
  engine: {
    thawDelay: BigNumberish;
  };
  integrationManager: {
    trackedAssetsLimit: BigNumberish;
  };
  chainlink: {
    ethUsdAggregator: AddressLike;
    staleRateThreshold: BigNumberish;
    primitives: AddressLike[];
    aggregators: AddressLike[];
    rateAssets: BigNumberish[];
  };
  integratees: {
    chai: AddressLike;
    kyber: AddressLike;
    makerDao: {
      dai: AddressLike;
      pot: AddressLike;
    };
    uniswapV2: {
      factory: AddressLike;
    };
    zeroExV2: {
      exchange: AddressLike;
      erc20Proxy: AddressLike;
    };
  };
}

export interface ReleaseDeploymentOutput {
  // Core
  comptrollerLib: Promise<ComptrollerLib>;
  fundDeployer: Promise<FundDeployer>;
  fundLifecycleLib: Promise<FundLifecycleLib>;
  permissionedVaultActionLib: Promise<PermissionedVaultActionLib>;
  vaultLib: Promise<VaultLib>;
  // Shared Infrastructure
  engine: Promise<Engine>;
  valueInterpreter: Promise<ValueInterpreter>;
  // Extensions
  feeManager: Promise<FeeManager>;
  integrationManager: Promise<IntegrationManager>;
  policyManager: Promise<PolicyManager>;
  // Price feeds
  chainlinkPriceFeed: Promise<ChainlinkPriceFeed>;
  // Derivative price feeds
  aggregatedDerivativePriceFeed: Promise<AggregatedDerivativePriceFeed>;
  chaiPriceFeed: Promise<ChaiPriceFeed>;
  // Integration adapters
  chaiAdapter: Promise<ChaiAdapter>;
  engineAdapter: Promise<EngineAdapter>;
  kyberAdapter: Promise<KyberAdapter>;
  trackedAssetsAdapter: Promise<TrackedAssetsAdapter>;
  zeroExV2Adapter: Promise<ZeroExV2Adapter>;
  // Fees
  entranceRateFee: Promise<EntranceRateFee>;
  managementFee: Promise<ManagementFee>;
  performanceFee: Promise<PerformanceFee>;
  // Policies
  adapterBlacklist: Promise<AdapterBlacklist>;
  adapterWhitelist: Promise<AdapterWhitelist>;
  assetBlacklist: Promise<AssetBlacklist>;
  assetWhitelist: Promise<AssetWhitelist>;
  maxConcentration: Promise<MaxConcentration>;
  investorWhitelist: Promise<InvestorWhitelist>;
  // Peripheral
  fundCalculator: Promise<FundCalculator>;
}

export const deployRelease = describeDeployment<
  ReleaseDeploymentConfig,
  ReleaseDeploymentOutput
>({
  // Core
  async comptrollerLib(config, deployment) {
    const comptrollerLib = await ComptrollerLib.deploy(
      config.deployer,
      await deployment.fundDeployer,
      await deployment.valueInterpreter,
      await deployment.feeManager,
      await deployment.integrationManager,
      await deployment.policyManager,
      await deployment.fundLifecycleLib,
      await deployment.permissionedVaultActionLib,
      await deployment.engine,
    );

    const fundDeployer = await deployment.fundDeployer;
    await fundDeployer.setComptrollerLib(comptrollerLib);

    return comptrollerLib;
  },
  async fundDeployer(config, deployment) {
    return FundDeployer.deploy(
      config.deployer,
      config.dispatcher,
      await deployment.engine,
      await deployment.vaultLib,
      config.registeredVaultCalls.contracts,
      config.registeredVaultCalls.selectors,
    );
  },
  async fundLifecycleLib(config, deployment) {
    return FundLifecycleLib.deploy(
      config.deployer,
      await deployment.fundDeployer,
      await deployment.chainlinkPriceFeed,
      await deployment.feeManager,
      await deployment.integrationManager,
      await deployment.policyManager,
    );
  },
  async permissionedVaultActionLib(config, deployment) {
    return PermissionedVaultActionLib.deploy(
      config.deployer,
      await deployment.feeManager,
      await deployment.integrationManager,
    );
  },
  async vaultLib(config) {
    return VaultLib.deploy(config.deployer);
  },
  // Shared Infrastructure
  async engine(config, deployment) {
    return Engine.deploy(
      config.deployer,
      config.dispatcher,
      config.mgm,
      config.mln,
      config.weth,
      await deployment.valueInterpreter,
      config.engine.thawDelay,
    );
  },
  async valueInterpreter(config, deployment) {
    return ValueInterpreter.deploy(
      config.deployer,
      await deployment.chainlinkPriceFeed,
      await deployment.aggregatedDerivativePriceFeed,
    );
  },
  // Extensions
  async feeManager(config, deployment) {
    return await FeeManager.deploy(
      config.deployer,
      await deployment.fundDeployer,
    );
  },
  async integrationManager(config, deployment) {
    return IntegrationManager.deploy(
      config.deployer,
      await deployment.fundDeployer,
      await deployment.policyManager,
      await deployment.valueInterpreter,
      config.integrationManager.trackedAssetsLimit,
    );
  },
  async policyManager(config, deployment) {
    return PolicyManager.deploy(config.deployer, await deployment.fundDeployer);
  },
  // Price feeds
  async chainlinkPriceFeed(config) {
    return ChainlinkPriceFeed.deploy(
      config.deployer,
      config.dispatcher,
      config.weth,
      config.chainlink.ethUsdAggregator,
      config.chainlink.staleRateThreshold,
      config.chainlink.primitives,
      config.chainlink.aggregators,
      config.chainlink.rateAssets,
    );
  },
  // Derivative price feeds
  async aggregatedDerivativePriceFeed(config, deployment) {
    return AggregatedDerivativePriceFeed.deploy(
      config.deployer,
      config.dispatcher,
      [config.integratees.chai],
      [await deployment.chaiPriceFeed],
    );
  },
  async chaiPriceFeed(config) {
    return ChaiPriceFeed.deploy(
      config.deployer,
      config.integratees.chai,
      config.integratees.makerDao.dai,
      config.integratees.makerDao.pot,
    );
  },
  // Adapters
  async chaiAdapter(config, deployment) {
    return ChaiAdapter.deploy(
      config.deployer,
      await deployment.integrationManager,
      config.integratees.chai,
      config.integratees.makerDao.dai,
    );
  },
  async engineAdapter(config, deployment) {
    return EngineAdapter.deploy(
      config.deployer,
      await deployment.integrationManager,
      await deployment.engine,
      config.mln,
      config.weth,
    );
  },
  async kyberAdapter(config, deployment) {
    return KyberAdapter.deploy(
      config.deployer,
      await deployment.integrationManager,
      config.integratees.kyber,
      config.weth,
    );
  },
  async trackedAssetsAdapter(config, deployment) {
    return TrackedAssetsAdapter.deploy(
      config.deployer,
      await deployment.integrationManager,
    );
  },
  async zeroExV2Adapter(config, deployment) {
    return ZeroExV2Adapter.deploy(
      config.deployer,
      await deployment.integrationManager,
      config.integratees.zeroExV2.exchange,
      await deployment.fundDeployer,
    );
  },
  // Fees
  async entranceRateFee(config, deployment) {
    return EntranceRateFee.deploy(config.deployer, await deployment.feeManager);
  },
  async managementFee(config, deployment) {
    return ManagementFee.deploy(config.deployer, await deployment.feeManager);
  },
  async performanceFee(config, deployment) {
    return PerformanceFee.deploy(config.deployer, await deployment.feeManager);
  },
  // Policies
  async adapterBlacklist(config, deployment) {
    return AdapterBlacklist.deploy(
      config.deployer,
      await deployment.policyManager,
    );
  },
  async adapterWhitelist(config, deployment) {
    return AdapterWhitelist.deploy(
      config.deployer,
      await deployment.policyManager,
    );
  },
  async assetBlacklist(config, deployment) {
    return AssetBlacklist.deploy(
      config.deployer,
      await deployment.policyManager,
    );
  },
  async assetWhitelist(config, deployment) {
    return AssetWhitelist.deploy(
      config.deployer,
      await deployment.policyManager,
    );
  },
  async buySharesPriceFeedTolerance(config, deployment) {
    return BuySharesPriceFeedTolerance.deploy(
      config.deployer,
      await deployment.policyManager,
      config.integratees.uniswapV2.factory,
      await deployment.valueInterpreter,
      config.weth,
    );
  },
  async maxConcentration(config, deployment) {
    return MaxConcentration.deploy(
      config.deployer,
      await deployment.policyManager,
      await deployment.valueInterpreter,
    );
  },
  async investorWhitelist(config, deployment) {
    return InvestorWhitelist.deploy(
      config.deployer,
      await deployment.policyManager,
    );
  },
  // Peripheral
  async fundCalculator(config, deployment) {
    return FundCalculator.deploy(config.deployer, await deployment.feeManager);
  },
  // Post-deployment config
  async postDeployment(_config, deployment) {
    // Register adapters
    const adapters = [
      await deployment.chaiAdapter,
      await deployment.engineAdapter,
      await deployment.kyberAdapter,
      await deployment.trackedAssetsAdapter,
      await deployment.zeroExV2Adapter,
    ];

    const integrationManager = await deployment.integrationManager;
    await integrationManager.registerAdapters(adapters);

    // Register ether takers on engine
    const engineAdapter = await deployment.engineAdapter;
    const engine = await deployment.engine;
    await engine.addEtherTakers([engineAdapter]);

    // Register fees
    const fees = [
      await deployment.entranceRateFee,
      await deployment.managementFee,
      await deployment.performanceFee,
    ];

    const feeManager = await deployment.feeManager;
    await feeManager.registerFees(fees);

    // Register policies
    const policies = [
      await deployment.adapterBlacklist,
      await deployment.adapterWhitelist,
      await deployment.assetBlacklist,
      await deployment.assetWhitelist,
      await deployment.maxConcentration,
      await deployment.investorWhitelist,
    ];

    const policyManager = await deployment.policyManager;
    await policyManager.registerPolicies(policies);
  },
});
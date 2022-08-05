import 'dotenv/config';
import '@enzymefinance/hardhat/plugin';
import './tasks/verify';

import { utils } from 'ethers';
import type { HardhatUserConfig } from 'hardhat/types';

function node(networkName: string) {
  const fallback = 'http://localhost:8545';
  const uppercase = networkName.toUpperCase();

  return process.env[`ETHEREUM_NODE_${uppercase}`] || process.env.ETHEREUM_NODE || fallback;
}

function accounts(networkName: string) {
  const uppercase = networkName.toUpperCase();
  const accounts = process.env[`ETHEREUM_ACCOUNTS_${uppercase}`] || process.env.ETHEREUM_ACCOUNTS || '';

  return accounts
    .split(',')
    .map((account) => account.trim())
    .filter(Boolean);
}

const mnemonic = 'test test test test test test test test test test test junk';

const config: HardhatUserConfig = {
  codeGenerator: {
    abi: {
      path: './packages/protocol/artifacts',
    },
    bytecode: {
      path: './packages/protocol/artifacts',
    },
    clear: true,
    enabled: true,
    include: [
      // Explicitly allow inclusion of core release interfaces.
      'IExternalPosition',
      'IExternalPositionParser',
      'IExternalPositionProxy',
      'IDerivativePriceFeed',
      'IExtension',
      'IIntegrationAdapter',
      'IFee',
      'IMigrationHookHandler',
      'IPolicy',
      'IPrimitivePriceFeed',

      'ITestCERC20',
      'ITestChainlinkAggregator',
      'ITestCompoundComptroller',
      'ITestConvexBaseRewardPool',
      'ITestConvexBooster',
      'ITestConvexCrvDepositor',
      'ITestConvexCvxLocker',
      'ITestConvexVlCvxExtraRewardDistribution',
      'ITestCurveAddressProvider',
      'ITestCurveLiquidityPool',
      'ITestCurveRegistry',
      'ITestCurveSwaps',
      'ITestIdleTokenV4',
      'ITestLiquityHintHelper',
      'ITestLiquitySortedTroves',
      'ITestLiquityTroveManager',
      'ITestGoldfinchConfig',
      'ITestGoldfinchSeniorPool',
      'ITestGsnForwarder',
      'ITestGsnRelayHub',
      'ITestMapleGlobals',
      'ITestMaplePool',
      'ITestSnapshotDelegateRegistry',
      'ITestSolvV2ConvertibleMarket',
      'ITestSolvV2ConvertiblePool',
      'ITestSolvV2ConvertibleVoucher',
      'ITestSolvV2InitialConvertibleOfferingMarket',
      'ITestSolvV2PriceOracleManager',
      'ITestSolvV2ManualPriceOracle',
      'ITestStandardToken',
      'ITestStethToken',
      'ITestSynthetixExchanger',
      'ITestTheGraphEpochManager',
      'ITestTheGraphStaking',
      'ITestUniswapV2Pair',
      'ITestUniswapV2Router',
      'ITestUniswapV3NonFungibleTokenManager',
      'ITestVotiumMultiMerkleStash',
      'ITestWETH',
      'ITestYearnVaultV2',
    ],
    options: {
      ignoreContractsWithoutAbi: true,
      ignoreContractsWithoutBytecode: true,
    },
    typescript: {
      path: './packages/protocol/src/codegen',
    },
  },
  contractSizer: {
    disambiguatePaths: false,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: utils.parseUnits('1', 36).toString(),
        count: 10,
        mnemonic,
      },
      blockGasLimit: 12450000,
      chainId: 1,
      forking: {
        blockNumber: 14770000, // May 13, 2022
        url: node('mainnet'),
      },
      gasPrice: 0, // TODO: Consider removing this again.
      initialBaseFeePerGas: 0,
    },
    mainnet: {
      accounts: accounts('mainnet'),
      url: node('mainnet'),
    },
    matic: {
      accounts: accounts('matic'),
      url: node('matic'),
    },
    testnet: {
      accounts: accounts('testnet'),
      url: node('testnet'),
    },
  },
  paths: {
    deploy: 'deploy/scripts',
  },
  solidity: {
    compilers: [
      {
        settings: {
          optimizer: {
            details: {
              yul: false,
            },
            enabled: true,
            runs: 200,
          },
        },
        version: '0.7.6',
      },
      {
        settings: {
          optimizer: {
            details: {
              yul: false,
            },
            enabled: true,
            runs: 200,
          },
        },
        version: '0.6.12',
      },
    ],
  },
};

export default config;

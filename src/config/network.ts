// We automatically create/update .env.local with the deployed package ID after deployment.
export const CONTRACT_PACKAGE_ID_NOT_DEFINED = '0xNOTDEFINED'
export const LOCALNET_CONTRACT_PACKAGE_ID =
  import.meta.env.VITE_LOCALNET_CONTRACT_PACKAGE_ID ||
  '0xa298e9c426fd132887db5e8eb9297c74ce88cdb318fa4b7d22045b447ea0dc3e' // Using testnet contract as fallback
export const DEVNET_CONTRACT_PACKAGE_ID =
  import.meta.env.VITE_DEVNET_CONTRACT_PACKAGE_ID ||
  CONTRACT_PACKAGE_ID_NOT_DEFINED
export const TESTNET_CONTRACT_PACKAGE_ID =
  import.meta.env.VITE_TESTNET_CONTRACT_PACKAGE_ID ||
  '0x4fc02416d8a5e280bd5d640435378fdb2ec786748dbb1d52884da4784d5fa2ec' // Updated card contract with recipient support
export const MAINNET_CONTRACT_PACKAGE_ID =
  import.meta.env.VITE_MAINNET_CONTRACT_PACKAGE_ID ||
  CONTRACT_PACKAGE_ID_NOT_DEFINED

export const LOCALNET_EXPLORER_URL = 'http://localhost:9001'
export const DEVNET_EXPLORER_URL = 'https://devnet.suivision.xyz'
export const TESTNET_EXPLORER_URL = 'https://testnet.suivision.xyz'
export const MAINNET_EXPLORER_URL = 'https://suivision.xyz'

export const CONTRACT_PACKAGE_VARIABLE_NAME = 'contractPackageId'
export const EXPLORER_URL_VARIABLE_NAME = 'explorerUrl'

export const NETWORKS_WITH_FAUCET = ['localnet', 'devnet', 'testnet']

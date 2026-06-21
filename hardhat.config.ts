import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Chave do validador Besu fornecida pelo ambiente local
const BESU_SIGNER_KEY = process.env.BESU_SIGNER_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Rede interna de testes Hardhat (chainId 31337)
    hardhat: {
      chainId: 31337,
    },
    // Hardhat node local externo (npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Hyperledger Besu local via Docker (besu/docker-compose.yml)
    besu: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: BESU_SIGNER_KEY ? [BESU_SIGNER_KEY] : [],
      gas: "auto",
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;

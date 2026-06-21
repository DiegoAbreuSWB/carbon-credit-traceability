import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`\n🚀 Deploy em rede: ${network.name}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Saldo:    ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const Factory = await ethers.getContractFactory("CarbonCreditRegistry");
  console.log("   Implantando CarbonCreditRegistry...");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log(`\n✅ Contrato implantado: ${contractAddress}`);

  // Grava .env.local do frontend automaticamente
  const envPath = path.resolve(__dirname, "../frontend/.env.local");
  const envContent = [
    `# Gerado automaticamente por scripts/deploy.ts em ${new Date().toISOString()}`,
    `# Rede: ${network.name}`,
    `VITE_MODE=blockchain`,
    `VITE_CONTRACT_ADDRESS=${contractAddress}`,
    `VITE_NETWORK_NAME=${network.name}`,
    `VITE_CHAIN_ID=${network.config.chainId ?? 31337}`,
    "",
  ].join("\n");

  fs.writeFileSync(envPath, envContent, "utf8");
  console.log(`\n📝 frontend/.env.local atualizado com endereço do contrato.`);
  console.log(`   Execute: cd frontend && npm run dev`);
  console.log(`\n   Contas de teste disponíveis no Hardhat (primeiras 3):`);

  const signers = await ethers.getSigners();
  for (let i = 0; i < 3; i++) {
    console.log(`     [${i}] ${signers[i].address}`);
  }
  console.log(`\n   Adicione uma dessas contas à MetaMask com o private key do Hardhat.`);
  console.log(`   Rede MetaMask: http://127.0.0.1:8545 | chainId: ${network.config.chainId ?? 31337}\n`);

  // Grava endereço em artifacts para uso interno
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const deploymentInfo = {
    network: network.name,
    contractAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    chainId: network.config.chainId ?? 31337,
  };
  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2),
    "utf8"
  );
  console.log(`📋 Deployment salvo em deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

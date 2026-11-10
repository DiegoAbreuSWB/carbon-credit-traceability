import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonCreditRegistry__factory } from "../typechain-types";
import * as path from "path";
import { pathToFileURL } from "url";

describe("Real frontend blockchain service", function () {
  this.timeout(60000);
  let server: any;
  let service: any;
  let registry: any;
  let owner: any, validator: any, buyer: any;
  const previousEnv = { ...process.env };
  let previousWindow: any;
  before(async () => {
    [owner, validator, buyer] = await ethers.getSigners();
    registry = await new CarbonCreditRegistry__factory(owner).deploy();
    await registry.waitForDeployment();
    process.env.VITE_MODE = "blockchain";
    process.env.VITE_CONTRACT_ADDRESS = await registry.getAddress();
    previousWindow = (globalThis as any).window;
    (globalThis as any).window = { ethereum: { request: async ({ method, params }: any) => {
      const { network } = await import("hardhat");
      if (method === "eth_requestAccounts") method = "eth_accounts";
      return network.provider.request({ method, params });
    } } };
    const nativeImport = new Function("s", "return import(s)");
    const vite = await nativeImport(pathToFileURL(path.resolve("frontend/node_modules/vite/dist/node/index.js")).href);
    server = await vite.createServer({ root: path.resolve("frontend"), configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
    service = await server.ssrLoadModule("/src/services/blockchainService.ts");
  });
  after(async () => {
    if (server) await server.close();
    (globalThis as any).window = previousWindow;
    for (const key of ["VITE_MODE", "VITE_CONTRACT_ADDRESS"]) {
      if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key];
    }
  });
  it("reads and writes using the actual service, including audit and dashboard", async () => {
    expect(service.isMockMode()).to.equal(false);
    const hash = await service.issueCredit({ areaName: "Integration", location: "Local", geoCoordinates: "0,0", co2Tonnes: 100 });
    expect(hash).to.match(/^0x[0-9a-f]{64}$/i);
    const credit = await service.getCreditById("0");
    expect(credit).to.include({ id: "0", areaName: "Integration", co2Tonnes: 100, status: "Created" });
    expect(credit.owner).to.equal(owner.address);
    await service.validateCredit("0");
    await service.transferCredit("0", buyer.address);
    expect((await service.getCreditById("0")).owner).to.equal(buyer.address);
    await (await registry.connect(buyer).retireCredit(0)).wait();
    expect((await service.getCreditById("0")).status).to.equal("Retired");
    const events = await service.getEventsByCredit("0");
    expect(events.map((e: any) => e.eventType)).to.deep.equal(["CreditIssued", "CreditValidated", "CreditTransferred", "CreditRetired"]);
    expect((await service.getAuditLog()).length).to.equal(4);
    const stats = service.getDashboardStats(await service.getAllCredits());
    expect(stats).to.include({ totalCredits: 1, retired: 1, totalCO2: 100 });
    expect((await service.getNetworkInfo()).chainId).to.equal(31337);
    expect(await service.getCreditById("999")).to.equal(null);
  });
  it("rejects unsafe input rather than rounding uint256 silently", async () => {
    try {
      await service.issueCredit({ areaName: "Unsafe", location: "L", geoCoordinates: "0,0", co2Tonnes: Number.MAX_SAFE_INTEGER + 1 });
      expect.fail("Unsafe input accepted");
    } catch (error: any) { expect(error.message).to.include("faixa segura"); }
    await (await registry.issueCredit("Large", "L", "0,0", 9007199254740993n)).wait();
    try { await service.getCreditById("1"); expect.fail("Unsafe result accepted"); }
    catch (error: any) { expect(error.message).to.include("inteiros seguros"); }
  });
  it("propagates provider failures instead of reporting a missing credit", async () => {
    const original = (globalThis as any).window.ethereum;
    (globalThis as any).window.ethereum = { request: async ({ method }: any) => { if (method === "eth_chainId") return "0x7a69"; throw new Error("integration-provider-unavailable"); } };
    let caught: unknown;
    try { await service.getCreditById("0"); }
    catch (error) { caught = error; }
    finally { (globalThis as any).window.ethereum = original; }
    expect(caught).to.be.instanceOf(Error);
  });
});

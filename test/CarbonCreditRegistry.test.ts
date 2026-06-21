import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonCreditRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CarbonCreditRegistry", function () {
  let registry: CarbonCreditRegistry;
  let owner: SignerWithAddress;
  let validator: SignerWithAddress;
  let buyer: SignerWithAddress;
  let other: SignerWithAddress;

  // Dados fictícios de crédito de carbono
  const AREA_NAME = "Reserva Florestal Amazônia Simulada";
  const LOCATION = "Manaus, AM";
  const GEO = "-3.1190,-60.0217";
  const CO2 = 1000n;

  beforeEach(async function () {
    [owner, validator, buyer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CarbonCreditRegistry");
    registry = (await Factory.deploy()) as CarbonCreditRegistry;
  });

  // ---------------------------------------------------------------------------
  // 1. Emissão de crédito
  // ---------------------------------------------------------------------------
  describe("issueCredit", function () {
    it("deve emitir um crédito com dados corretos", async function () {
      const tx = await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      await tx.wait();

      const credit = await registry.getCredit(0);
      expect(credit.id).to.equal(0n);
      expect(credit.areaName).to.equal(AREA_NAME);
      expect(credit.location).to.equal(LOCATION);
      expect(credit.geoCoordinates).to.equal(GEO);
      expect(credit.co2Tonnes).to.equal(CO2);
      expect(credit.issuer).to.equal(owner.address);
      expect(credit.owner).to.equal(owner.address);
      expect(credit.status).to.equal(0); // Created
    });

    it("deve emitir o evento CreditIssued", async function () {
      await expect(registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2))
        .to.emit(registry, "CreditIssued")
        .withArgs(0n, owner.address, AREA_NAME, CO2, await getTimestamp());
    });

    it("deve incrementar o total de créditos", async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      await registry.connect(owner).issueCredit("Área 2", LOCATION, GEO, 500n);
      expect(await registry.getTotalCredits()).to.equal(2n);
    });

    it("deve rejeitar emissão com nome vazio", async function () {
      await expect(
        registry.connect(owner).issueCredit("", LOCATION, GEO, CO2)
      ).to.be.revertedWith("CCR: nome da area obrigatorio");
    });

    it("deve rejeitar emissão com CO2 zero", async function () {
      await expect(
        registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, 0n)
      ).to.be.revertedWith("CCR: quantidade de CO2 deve ser positiva");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Validação de crédito
  // ---------------------------------------------------------------------------
  describe("validateCredit", function () {
    beforeEach(async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
    });

    it("deve validar um crédito no estado Created", async function () {
      await registry.connect(validator).validateCredit(0);
      const credit = await registry.getCredit(0);
      expect(credit.status).to.equal(1); // Validated
      expect(credit.validator).to.equal(validator.address);
    });

    it("deve emitir o evento CreditValidated", async function () {
      await expect(registry.connect(validator).validateCredit(0))
        .to.emit(registry, "CreditValidated")
        .withArgs(0n, validator.address, await getTimestamp());
    });

    it("deve rejeitar validação de crédito já validado", async function () {
      await registry.connect(validator).validateCredit(0);
      await expect(
        registry.connect(validator).validateCredit(0)
      ).to.be.revertedWith("CCR: apenas creditos no estado Created podem ser validados");
    });

    it("deve rejeitar validação de crédito rejeitado", async function () {
      await registry.connect(validator).rejectCredit(0, "Dados inválidos");
      await expect(
        registry.connect(validator).validateCredit(0)
      ).to.be.revertedWith("CCR: apenas creditos no estado Created podem ser validados");
    });

    it("deve rejeitar validação de crédito inexistente", async function () {
      await expect(registry.connect(validator).validateCredit(999))
        .to.be.revertedWith("CCR: credito inexistente");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Rejeição de crédito
  // ---------------------------------------------------------------------------
  describe("rejectCredit", function () {
    beforeEach(async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
    });

    it("deve rejeitar um crédito no estado Created", async function () {
      await registry.connect(validator).rejectCredit(0, "Documentação insuficiente");
      const credit = await registry.getCredit(0);
      expect(credit.status).to.equal(4); // Rejected
    });

    it("deve emitir o evento CreditRejected", async function () {
      const reason = "Documentação insuficiente";
      await expect(registry.connect(validator).rejectCredit(0, reason))
        .to.emit(registry, "CreditRejected")
        .withArgs(0n, validator.address, reason, await getTimestamp());
    });

    it("deve rejeitar operação de rejeição em crédito já validado", async function () {
      await registry.connect(validator).validateCredit(0);
      await expect(
        registry.connect(validator).rejectCredit(0, "tarde demais")
      ).to.be.revertedWith("CCR: apenas creditos no estado Created podem ser rejeitados");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Transferência de crédito
  // ---------------------------------------------------------------------------
  describe("transferCredit", function () {
    beforeEach(async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      await registry.connect(validator).validateCredit(0);
    });

    it("deve transferir um crédito validado", async function () {
      await registry.connect(owner).transferCredit(0, buyer.address);
      const credit = await registry.getCredit(0);
      expect(credit.owner).to.equal(buyer.address);
      expect(credit.status).to.equal(2); // Transferred
    });

    it("deve emitir o evento CreditTransferred", async function () {
      await expect(registry.connect(owner).transferCredit(0, buyer.address))
        .to.emit(registry, "CreditTransferred")
        .withArgs(0n, owner.address, buyer.address, await getTimestamp());
    });

    it("deve rejeitar transferência por usuário não autorizado", async function () {
      await expect(
        registry.connect(other).transferCredit(0, buyer.address)
      ).to.be.revertedWith("CCR: nao e o proprietario");
    });

    it("deve rejeitar transferência de crédito não validado", async function () {
      await registry.connect(owner).issueCredit("Área 2", LOCATION, GEO, 500n);
      // creditId 1 está em estado Created
      await expect(
        registry.connect(owner).transferCredit(1, buyer.address)
      ).to.be.revertedWith("CCR: apenas creditos validados ou transferidos podem ser transferidos");
    });

    it("deve rejeitar transferência de crédito aposentado", async function () {
      await registry.connect(owner).retireCredit(0);
      await expect(
        registry.connect(owner).transferCredit(0, buyer.address)
      ).to.be.revertedWith("CCR: credito aposentado nao pode ser transferido");
    });

    it("deve rejeitar transferência para endereço zero", async function () {
      await expect(
        registry.connect(owner).transferCredit(0, ethers.ZeroAddress)
      ).to.be.revertedWith("CCR: destinatario invalido");
    });

    it("deve permitir retransferência após transferência anterior", async function () {
      await registry.connect(owner).transferCredit(0, buyer.address);
      await registry.connect(buyer).transferCredit(0, other.address);
      const credit = await registry.getCredit(0);
      expect(credit.owner).to.equal(other.address);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Aposentadoria de crédito
  // ---------------------------------------------------------------------------
  describe("retireCredit", function () {
    beforeEach(async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      await registry.connect(validator).validateCredit(0);
    });

    it("deve aposentar um crédito validado", async function () {
      await registry.connect(owner).retireCredit(0);
      const credit = await registry.getCredit(0);
      expect(credit.status).to.equal(3); // Retired
    });

    it("deve emitir o evento CreditRetired", async function () {
      await expect(registry.connect(owner).retireCredit(0))
        .to.emit(registry, "CreditRetired")
        .withArgs(0n, owner.address, await getTimestamp());
    });

    it("deve rejeitar aposentadoria por usuário não autorizado", async function () {
      await expect(
        registry.connect(other).retireCredit(0)
      ).to.be.revertedWith("CCR: nao e o proprietario");
    });

    it("deve rejeitar aposentadoria de crédito não validado (Created)", async function () {
      await registry.connect(owner).issueCredit("Área 2", LOCATION, GEO, 500n);
      await expect(
        registry.connect(owner).retireCredit(1)
      ).to.be.revertedWith("CCR: apenas creditos validados ou transferidos podem ser aposentados");
    });

    it("deve rejeitar transferência de crédito já aposentado", async function () {
      await registry.connect(owner).retireCredit(0);
      await expect(
        registry.connect(owner).transferCredit(0, buyer.address)
      ).to.be.revertedWith("CCR: credito aposentado nao pode ser transferido");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Log de auditoria e eventos
  // ---------------------------------------------------------------------------
  describe("Auditoria e eventos", function () {
    it("deve registrar eventos no log de auditoria após emissão", async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      const log = await registry.getAuditLog();
      expect(log.length).to.equal(1);
      expect(log[0].eventType).to.equal("CreditIssued");
      expect(log[0].creditId).to.equal(0n);
    });

    it("deve registrar múltiplos eventos para o mesmo crédito", async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      await registry.connect(validator).validateCredit(0);
      await registry.connect(owner).transferCredit(0, buyer.address);
      await registry.connect(buyer).retireCredit(0);

      const events = await registry.getCreditEvents(0);
      expect(events.length).to.equal(4);
      expect(events[0].eventType).to.equal("CreditIssued");
      expect(events[1].eventType).to.equal("CreditValidated");
      expect(events[2].eventType).to.equal("CreditTransferred");
      expect(events[3].eventType).to.equal("CreditRetired");
    });

    it("deve retornar array vazio para crédito inexistente em getCreditIds", async function () {
      const ids = await registry.getCreditIds();
      expect(ids.length).to.equal(0);
    });

    it("deve retornar IDs corretos após múltiplas emissões", async function () {
      await registry.connect(owner).issueCredit(AREA_NAME, LOCATION, GEO, CO2);
      await registry.connect(owner).issueCredit("Área 2", LOCATION, GEO, 500n);
      const ids = await registry.getCreditIds();
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(0n);
      expect(ids[1]).to.equal(1n);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: timestamp aproximado do próximo bloco
// ---------------------------------------------------------------------------
async function getTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock("latest");
  return (block?.timestamp ?? 0) + 1;
}

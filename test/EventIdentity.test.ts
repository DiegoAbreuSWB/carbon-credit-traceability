import { expect } from "chai";
import { eventIdentity, compareEventPosition } from "../scripts/experiments/event-identity";

describe("Event identity and ordering", () => {
  const log = { txHash: "0xABC", blockNumber: 10, transactionIndex: 1, logIndex: 2 };
  it("preserves two logs from the same transaction", () => {
    const keys = [log, { ...log, logIndex: 3 }].map(eventIdentity);
    expect(new Set(keys).size).to.equal(2);
  });
  it("detects the same log fetched twice, including hash casing", () => {
    const keys = [log, { ...log, txHash: "0xabc" }].map(eventIdentity);
    expect(new Set(keys).size).to.equal(1);
  });
  it("distinguishes equal log indices in different transactions", () => {
    expect(eventIdentity(log)).not.to.equal(eventIdentity({ ...log, txHash: "0xDEF" }));
  });
  it("orders by block, then transaction, then log", () => {
    const expected = [
      { ...log, blockNumber: 9, transactionIndex: 5, logIndex: 9 },
      { ...log, transactionIndex: 0, logIndex: 9 },
      log,
      { ...log, logIndex: 3 },
    ];
    expect([...expected].reverse().sort(compareEventPosition)).to.deep.equal(expected);
  });
});

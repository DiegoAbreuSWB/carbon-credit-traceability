export interface EventPosition {
  txHash: string;
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
}
export function eventIdentity(event: Pick<EventPosition, "txHash" | "logIndex">): string {
  return `${event.txHash.toLowerCase()}:${event.logIndex}`;
}
export function compareEventPosition(a: EventPosition, b: EventPosition): number {
  return a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex;
}

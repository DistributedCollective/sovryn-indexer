export type LiquidityChanges = {
  id: string;
  transactionHash: string;
  callIndex: number;
  user: string;
  pool: {
    base: string;
    quote: string;
    poolIdx: string;
  };
  block: string;
  time: string;
  positionType: 'concentrated' | 'ambient'; // Adjust based on your actual types
  changeType: 'burn' | 'mint'; // Adjust based on your actual types
  bidTick: number;
  askTick: number;
  isBid: boolean;
  liq: string;
  baseFlow: string;
  quoteFlow: string;
  pivotTime: string | null;
};

export type LiquidityChangesResponse = {
  liquidityChanges: LiquidityChanges[];
};

export type LiquidityPosition = {
  id: string;
  base: string;
  quote: string;
  positionType: string;
  liq: string;
  baseFlow: string;
  quoteFlow: string;
};

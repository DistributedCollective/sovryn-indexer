declare namespace Express {
  interface Locals {
    user: string;
    address: string;
    network: import('~/loader/networks/chain-config').Chain;
  }
}

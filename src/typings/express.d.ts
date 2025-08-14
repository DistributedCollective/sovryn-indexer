declare global {
  declare module 'express' {
    type Chain = import('loader/networks/chain-config').Chain;
    export interface Locals {
      user: string;
      address: string;
      network: Chain;
    }
  }
}

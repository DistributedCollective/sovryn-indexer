# Identifiers

This doc describes deterministic identifiers in indexer database tables.
Deterministic identifiers are unique and consistent identifiers generated from the data itself, ensuring that the same input will always produce the same identifier. This is crucial for maintaining data integrity and enabling efficient data retrieval in the indexer.

## Generating Identifiers

Simply use the `encode.identity` (./src/utils/encode.ts) function with the appropriate parameters to generate a deterministic identifier.

## Generation rules by table

### Tokens

- Use chain ID and lowercase token address to generate the identifier.
- `encode.identity([chainId, tokenAddress.toLowerCase()])`

### Pools

#### Ambient pools

- Use chain ID, PoolType.ambient, lowercase token addresses (base + quote) and pool index to generate the identifier.
- `encode.identity([chain.context.chainId, PoolType.ambient, pool.base.toLowerCase(), pool.quote.toLowerCase(), pool.poolIdx])`

#### Bancor pools

- Use chain ID, PoolType.bancor, lowercase token addresses (base + quote) and bancor pool type (version 1 or 2) to generate the identifier.
- `encode.identity([chain.context.chainId, PoolType.bancor, pool.token0.id.toLowerCase(), pool.token1.id.toLowerCase(), pool.type])`

import 'dotenv/config';
import { startApp } from 'app';
import { queryFromSubgraph } from 'loader/subgraph';
import { HttpClient } from 'utils/http-client';
import { logger } from 'utils/logger';
import { onShutdown } from 'utils/shutdown';

logger.info('Sovryn Indexer is starting...');

startApp();

onShutdown();

queryFromSubgraph(
  'https://subgraph.sovryn.app/subgraphs/name/DistributedCollective/sovryn-subgraph',
  `{
  tokens {
    symbolh
  }}`,
  0,
  0,
).then((data) => {
  logger.info({ data }, 'Subgraph query result:');
});

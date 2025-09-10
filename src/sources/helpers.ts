import { IngestionSourceMode } from '~/database/schema';
import { checkpoints } from '~/services/checkpoints';

export const isSourceInLiveMode = (key: string) =>
  checkpoints
    .get(key)
    .then((cp) => cp?.mode === IngestionSourceMode.live)
    .catch(() => false);

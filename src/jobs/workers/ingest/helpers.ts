import { SourceAdapter } from '~/domain/types';
import { sources } from '~/sources';

export const getAdapter = (key: string) => {
  const a = sources.find((s) => s.name === key);
  if (!a) throw new Error(`Unknown source ${key}`);
  return a;
};

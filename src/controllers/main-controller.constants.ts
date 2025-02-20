import { NearestType } from 'utils/date';

export const TIMEFRAMES = {
  '1m': 1,
  '5m': 5,
  '10m': 10,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '12h': 720,
  '1d': 1440,
  '3d': 4320,
  '1w': 10080,
  '30d': 43200, // 1 month
};

export const MAX_INTERVALS = {
  '1m': 1440, // 1 day
  '5m': 864, // 3 days
  '10m': 720, // 5 days
  '15m': 720, // 1 week
  '30m': 720, // 2 weeks
  '1h': 720, // 1 month
  '4h': 365, // 3 months
  '12h': 365, // 6 months
  '1d': 365,
  '3d': 122,
  '1w': 52,
  '30d': 12, // 1 year
};

export type Timeframe = keyof typeof TIMEFRAMES;

export const TIMEFRAME_ROUNDING: Record<Timeframe, NearestType> = {
  '1m': 'minute',
  '5m': 'minute',
  '10m': 'minute',
  '15m': 'minute',
  '30m': 'minute',
  '1h': 'hour',
  '4h': 'hour',
  '12h': 'hour',
  '1d': 'day',
  '3d': 'day',
  '1w': 'day',
  '30d': 'day',
};

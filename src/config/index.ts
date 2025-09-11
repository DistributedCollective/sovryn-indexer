import 'dotenv/config';
import convict from 'convict';
import convictFormatWithValidator from 'convict-format-with-validator';

convict.addFormats(convictFormatWithValidator);

const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 8000,
    env: 'PORT',
  },
  logLevel: {
    doc: 'The log level.',
    format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
    default: 'info',
    env: 'LOG_LEVEL',
  },
  dbLogLevel: {
    doc: 'The database log level.',
    format: ['warn', 'info', 'debug'],
    default: 'debug',
    env: 'DB_LOG_LEVEL',
  },
  networks: {
    doc: 'Path to the networks configuration file.',
    format: String,
    default: 'config/networks.json',
    env: 'NETWORKS',
    arg: 'networks',
  },
  databaseUrl: {
    doc: 'Postgresql database connection URL',
    format: String,
    default: 'postgresql://postgres:secret@127.0.0.1:5432/db',
    env: 'DATABASE_URL',
    sensitive: true,
  },
  redisCacheUrl: {
    doc: 'Redis cache connection URL',
    format: String,
    default: 'redis://127.0.0.1:6379/0',
    env: 'REDIS_CACHE_URL',
  },
  readOnly: {
    doc: 'Read-only mode',
    format: Boolean,
    default: false,
    env: 'READ_ONLY_MODE',
    arg: 'readOnly',
  },
  spawnWorkers: {
    doc: 'Spawn worker processes',
    format: Boolean,
    default: false,
    env: 'SPAWN_WORKERS',
    arg: 'spawnWorkers',
  },
  queueAccess: {
    doc: 'Queue access mode',
    format: Boolean,
    default: false,
    env: 'QUEUE_ACCESS',
    arg: 'queueAccess',
  },
});

config.validate({ allowed: 'strict' });

export default config.getProperties();

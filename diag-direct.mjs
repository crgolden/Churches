// Diagnostic: pino-elasticsearch as a direct destination stream (no pino.transport worker thread).
import pino from 'pino';
import pinoElasticsearch from 'pino-elasticsearch';

const streamToElastic = pinoElasticsearch({
  node: process.env.ElasticsearchNode,
  auth: { username: process.env.ElasticsearchUsername, password: process.env.ElasticsearchPassword },
  index: 'logs-dotnet-churches',
  esVersion: 8,
  opType: 'create',
  flushBytes: 1000,
});
streamToElastic.on('error', (e) => console.error('STREAM ERROR:', e));
streamToElastic.on('insertError', (e) => console.error('INSERT ERROR:', e.document, e));
streamToElastic.on('insert', (stats) => console.log('INSERTED:', JSON.stringify(stats)));
streamToElastic.on('unknown', (line, err) => console.error('UNKNOWN LINE:', line, err));

const logger = pino(
  {
    base: { 'service.name': 'diag-direct-stream' },
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ 'log.level': label }) },
  },
  streamToElastic,
);

logger.info('diag: direct pino-elasticsearch stream, no worker thread');
console.log('logger.info called; waiting up to 10s for bulk flush events...');
setTimeout(() => { console.log('done'); process.exit(0); }, 40000);

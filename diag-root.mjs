// Diagnostic: replicate logging.ts's exact pino config from the same directory context as the
// production bundle, with error listeners attached to surface what the transport worker swallows.
import pino from 'pino';

const esNode = process.env.ElasticsearchNode;
const esUsername = process.env.ElasticsearchUsername;
const esPassword = process.env.ElasticsearchPassword;

console.log('esNode set:', Boolean(esNode));

const targets = [{ target: 'pino/file', options: { destination: 1 } }];
if (esNode) {
  targets.push({
    target: 'pino-elasticsearch',
    options: {
      node: esNode,
      auth: esUsername && esPassword ? { username: esUsername, password: esPassword } : undefined,
      index: 'logs-dotnet-churches',
      esVersion: 8,
      op_type: 'create',
      flushBytes: 1000,
    },
  });
}

const transport = pino.transport({ targets });
transport.on('error', (err) => console.error('TRANSPORT ERROR:', err));

const logger = pino(
  {
    base: { 'service.name': 'diag-local' },
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ 'log.level': label }),
    },
  },
  transport,
);

logger.info('diag: exact logging.ts config from dist context');
console.log('logger.info called, waiting 8s for worker/flush...');
setTimeout(() => console.log('done waiting'), 8000);

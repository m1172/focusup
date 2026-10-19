import { buildApp } from './app.js';
import { readConfig } from './config.js';

const config = readConfig();
const app = await buildApp(config);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}
try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  app.log.error('Unable to start backend; check host and port.');
  process.exitCode = 1;
}

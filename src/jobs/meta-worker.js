import mongoose from 'mongoose';
import { configuration } from '../config/env.js';
import { connect } from '../config/database.js';
import { runOneSync } from '../modules/meta/meta.sync.js';
import { logger } from '../config/logger.js';

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
});

process.on('SIGTERM', () => {
  stopping = true;
});

try {
  const config = configuration();

  await connect(config.mongoUri);

  logger.info('Meta sync worker started');

  while (!stopping) {
    let worked = false;

    try {
      worked = await runOneSync(config);
    } catch (error) {
      logger.error(
        { errorType: error.name },
        'Meta worker pass failed'
      );
    }

    if (!worked) {
      for (
        let i = 0;
        i < 5 && !stopping;
        i++
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }
    }
  }
} catch (error) {
  logger.fatal(
    { errorType: error.name },
    'Meta worker startup failed: check MongoDB and Meta configuration'
  );

  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
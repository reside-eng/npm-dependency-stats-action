import * as core from '@actions/core';
import run from './run';

run().catch((err) => {
  core.error(err);
  process.exit(1);
});

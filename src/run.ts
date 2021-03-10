import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';
import getDependencyStats from './getDependencyStats';

/**
 *
 */
export default async function run(): Promise<void> {
  const depStats = await getDependencyStats();
  const outputFileConfig = core.getInput('output-file');
  if (outputFileConfig) {
    fs.writeFileSync(
      path.resolve(outputFileConfig),
      JSON.stringify(depStats, null, 2),
    );
  }
  core.setOutput('dependencies', depStats.dependencies);
  core.setOutput('counts', depStats.counts);
  core.setOutput('percents', depStats.percents);
}

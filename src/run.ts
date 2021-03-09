import * as core from '@actions/core';
import getDependencyStats from './getDependencyStats';

/**
 *
 */
export default async function run(): Promise<void> {
  const depStats = await getDependencyStats();
  core.setOutput('dependencies', depStats.dependencies);
  core.setOutput('counts', depStats.counts);
  core.setOutput('percents', depStats.percents);
}

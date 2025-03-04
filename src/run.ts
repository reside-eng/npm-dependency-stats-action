import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';
import {
  getDependencyStats,
  type GlobalStatsOutput,
} from './getDependencyStats';

/**
 * Run npm-dependency-stats action. All outputs are set
 * at this level
 */
export async function run(): Promise<void> {
  const isMonorepoInput = core.getInput('is-monorepo');

  // If package is a monorepo report on each subpackage
  if (isMonorepoInput === 'true') {
    const packageFolders = fs.readdirSync(`${process.cwd()}/packages`);
    const dependenciesByName: Record<
      string,
      GlobalStatsOutput['dependencies']
    > = {};
    const countsByName: Record<string, GlobalStatsOutput['counts']> = {};
    const percentsByName: Record<string, GlobalStatsOutput['percents']> = {};
    await Promise.allSettled(
      packageFolders.map(async (packageFolder) => {
        const pkgDepStats = await getDependencyStats();
        dependenciesByName[packageFolder] = pkgDepStats.dependencies;
        countsByName[packageFolder] = pkgDepStats.counts;
        percentsByName[packageFolder] = pkgDepStats.percents;
        const outputFileConfig = core.getInput('output-file');
        if (outputFileConfig) {
          fs.writeFileSync(
            path.resolve('dep-stats', packageFolder, outputFileConfig),
            JSON.stringify(pkgDepStats, null, 2),
          );
        }
      }),
    );
    core.setOutput('dependencies', dependenciesByName);
    core.setOutput('counts', countsByName);
    core.setOutput('percents', percentsByName);
  } else {
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
}

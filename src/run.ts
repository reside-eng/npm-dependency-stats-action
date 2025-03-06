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
  const outputFileConfig = core.getInput('output-file');
  core.debug(
    `Inputs: is-monorepo:${isMonorepoInput}, output-file:${outputFileConfig}`,
  );
  // If package is a monorepo report on each subpackage
  if (isMonorepoInput === 'true') {
    const packagesFolder = `${process.cwd()}/packages`;
    core.debug('Monorepo detected - getting deps stats for each package');
    if (!fs.existsSync(packagesFolder)) {
      core.error('Monorepo detected, but no packages folder found');
      return;
    }
    const packageFolders = fs.readdirSync(packagesFolder);
    const dependenciesByName: Record<
      string,
      GlobalStatsOutput['dependencies']
    > = {};
    const countsByName: Record<string, GlobalStatsOutput['counts']> = {};
    const percentsByName: Record<string, GlobalStatsOutput['percents']> = {};
    await Promise.all(
      packageFolders.map(async (packageFolder) => {
        core.debug(`Getting deps stats for ${packageFolder}`);
        try {
          const pkgDepStats = await getDependencyStats(
            `${packagesFolder}/${packageFolder}`,
          );
          dependenciesByName[packageFolder] = pkgDepStats.dependencies;
          countsByName[packageFolder] = pkgDepStats.counts;
          percentsByName[packageFolder] = pkgDepStats.percents;
          if (outputFileConfig) {
            const outputPath = path.resolve(
              'dep-stats',
              packageFolder,
              outputFileConfig,
            );
            core.debug(`Writing output to ${outputPath}`);
            fs.writeFileSync(outputPath, JSON.stringify(pkgDepStats, null, 2));
          }
        } catch (err) {
          const error = err as Error;
          core.error(
            `Error getting dependency stats for ${packageFolder}: ${error.message}`,
          );
        }
      }),
    );
    core.setOutput('dependencies', dependenciesByName);
    core.setOutput('counts', countsByName);
    core.setOutput('percents', percentsByName);
  } else {
    const depStats = await getDependencyStats();
    if (outputFileConfig) {
      const outputPath = path.resolve(outputFileConfig);
      core.debug(`Writing output to ${outputPath}`);
      fs.writeFileSync(outputPath, JSON.stringify(depStats, null, 2));
    }
    core.setOutput('dependencies', depStats.dependencies);
    core.setOutput('counts', depStats.counts);
    core.setOutput('percents', depStats.percents);
  }
}

import * as core from '@actions/core';
import semver from 'semver';
import path from 'path';
import { getNumberOfDependenciesByType } from './getNumberOfDependencies';
import { NpmOutdatedOutput, npmOutdatedByType } from './npmOutdated';

interface PackagesByOutVersion {
  major: NpmOutdatedOutput;
  minor: NpmOutdatedOutput;
  patch: NpmOutdatedOutput;
}

/**
 * Sort packages by their out of date version (major, minor, patch)
 * @param {Array} packages - List of package settings from yarn outdated
 * @returns Object of packages sorted by out of date version
 */
function groupPackagesByOutOfDateName(
  packages: NpmOutdatedOutput,
): PackagesByOutVersion {
  return Object.entries(packages).reduce(
    (acc, [packageName, packageInfo]) => {
      const { latest, current } = packageInfo;
      // Skip dependencies which have "exotic" version (can be caused by pointing to a github repo in package file)
      if (latest === 'exotic') {
        core.debug(
          `Skipping check of ${packageName} since it's latest version is "exotic" (i.e. not found in package registry)`,
        );
        return acc;
      }

      core.info(JSON.stringify("Debug 5.0.1"));

      const currentMajor = semver.major(current);
      const latestMajor = semver.major(latest);
      const currentMinor = semver.minor(current);
      const latestMinor = semver.minor(latest);

      core.info(JSON.stringify("Debug 5.0.2"));

      const preMajor = currentMajor === 0 || latestMajor === 0;
      const preMinor = preMajor && (currentMinor === 0 || latestMinor === 0);

      if (currentMajor !== latestMajor) {
        acc.major[packageName] = packageInfo;
      } else if (currentMinor !== latestMinor) {
        if (preMajor) {
          // If the major version number is zero (0.x.x), treat a change of the
          // minor version number as a major change.
          acc.major[packageName] = packageInfo;
        } else {
          acc.minor[packageName] = packageInfo;
        }
      } else if (semver.patch(current) !== semver.patch(latest)) {
        if (preMinor) {
          // If the major & minor version numbers are zero (0.0.x), treat a
          // change of the patch version number as a major change.
          acc.major[packageName] = packageInfo;
        } else if (preMajor) {
          // If the major version number is zero (0.x.x), treat a change of the
          // patch version number as a minor change.
          acc.minor[packageName] = packageInfo;
        } else {
          acc.patch[packageName] = packageInfo;
        }
      }
      core.info(JSON.stringify("Debug 5.0.3"));
      return acc;
    },
    {
      minor: {} as NpmOutdatedOutput,
      major: {} as NpmOutdatedOutput,
      patch: {} as NpmOutdatedOutput,
    } as PackagesByOutVersion,
  );
}

export interface StatsOutput {
  dependencies: {
    major: NpmOutdatedOutput;
    minor: NpmOutdatedOutput;
    patch: NpmOutdatedOutput;
  };
  counts: {
    total: number;
    upToDate: number;
    major: number;
    minor: number;
    patch: number;
  };
  percents: {
    upToDate: string;
    major: string;
    minor: string;
    patch: string;
  };
}

/**
 * @param numDeps - Total number of dependencies (of a specific type or all)
 * @param outdatedDependencies - List of outdated dependencies (of a specific type or all)
 * @param messagePrefix - Prefix to add to debug message
 * @returns Calculated dependency stats
 */
function calculate(
  numDeps: number,
  outdatedDependencies: NpmOutdatedOutput,
  messagePrefix: string,
) {
  core.info(JSON.stringify("Debug 5.0"));
  // Sort packages by if they are out by major/minor/patch
  const sorted = groupPackagesByOutOfDateName(outdatedDependencies);

  core.info(JSON.stringify("Debug 5.1"));

  // TODO: Add option to select just dev dependencies
  const majorsOutOfDate = Object.keys(sorted.major).length;
  const minorsOutOfDate = Object.keys(sorted.minor).length;
  const patchesOutOfDate = Object.keys(sorted.patch).length;
  const majorPercentOutOfDate = ((majorsOutOfDate / numDeps) * 100).toFixed(2);
  const minorPercentOutOfDate = ((minorsOutOfDate / numDeps) * 100).toFixed(2);
  const patchPercentOutOfDate = ((patchesOutOfDate / numDeps) * 100).toFixed(2);

  core.info(JSON.stringify("Debug 5.2"));

  const upToDatePercent = (
    ((numDeps - (majorsOutOfDate + minorsOutOfDate + patchesOutOfDate)) /
      numDeps) *
    100
  ).toFixed(2);

  core.info(JSON.stringify("Debug 5.3"));
  const messageLines = [
    messagePrefix,
    `up to date: ${
      numDeps - (majorsOutOfDate + minorsOutOfDate + patchesOutOfDate)
    }/${numDeps} (${upToDatePercent} %)`,
    `major behind: ${majorsOutOfDate}/${numDeps} (${majorPercentOutOfDate} %)`,
    `minor behind: ${minorsOutOfDate}/${numDeps} (${minorPercentOutOfDate} %)`,
    `patch behind: ${patchesOutOfDate}/${numDeps} (${patchPercentOutOfDate} %)`,
  ];
  core.info(JSON.stringify("Debug 5.4"));
  core.debug(messageLines.join('\n'));
  core.info(JSON.stringify("Debug 5.5"));
  // TODO: output total number of dependencies as well as dev/non-dev
  return {
    dependencies: {
      major: sorted.major,
      minor: sorted.minor,
      patch: sorted.patch,
    },
    counts: {
      total: numDeps,
      upToDate:
        numDeps - (majorsOutOfDate + minorsOutOfDate + patchesOutOfDate) || 0,
      major: majorsOutOfDate,
      minor: minorsOutOfDate,
      patch: patchesOutOfDate,
    },
    percents: {
      upToDate: upToDatePercent,
      major: majorPercentOutOfDate,
      minor: minorPercentOutOfDate,
      patch: patchPercentOutOfDate,
    },
  };
}

interface GlobalStatsOutput extends StatsOutput {
  byType: {
    devDependencies?: StatsOutput;
    dependencies?: StatsOutput;
  };
}

/**
 * Get stats about dependencies which are outdated by at least 1 major version
 * @returns Object containing stats about out of date packages
 */
export async function getDependencyStats(): Promise<GlobalStatsOutput> {
  const startWorkingDirectory = process.cwd();
  // seems the working directory should be absolute to work correctly
  // https://github.com/cypress-io/github-action/issues/211
  const workingDirectoryInput = core.getInput('working-directory');
  const workingDirectory = workingDirectoryInput
    ? path.resolve(workingDirectoryInput)
    : startWorkingDirectory;
  core.debug(`working directory ${workingDirectory}`);
  core.debug(`working directory ${workingDirectory}`);
  const {
    dependencies: dependenciesOutOfDate,
    devDependencies: devDependenciesOutOfDate,
  } = await npmOutdatedByType(workingDirectory);

  core.info(JSON.stringify("Debug 4"));

  // Get total number of dependencies based on type
  const { dependencies: numDeps, devDependencies: numDevDeps } =
    await getNumberOfDependenciesByType(workingDirectory);

  // TODO: Add ability to load renovate config here to override calculations
  // TODO: Only filter out @types/node if it matches node version (defined by package engines)
  const ignoredDevDeps = ['@types/node'];
  // Filter out any packages which should be ignored
  const filteredDevDeps = Object.fromEntries(
    Object.entries(devDependenciesOutOfDate || {}).filter(
      ([packageName]) => !ignoredDevDeps.includes(packageName.toLowerCase()),
    ),
  );

  core.info(JSON.stringify("Debug 5"));

  // Sort packages by if they are out by major/minor/patch
  const results = {
    dependencies: dependenciesOutOfDate
      ? calculate(numDeps, dependenciesOutOfDate, 'Dependencies')
      : undefined,
    devDependencies: filteredDevDeps
      ? calculate(numDevDeps, filteredDevDeps, 'Dev Dependencies')
      : undefined,
  };
  core.info(JSON.stringify("Debug 5.6"));
  if (core.getInput('log-results') === 'true') {
    core.info(JSON.stringify(results));
  }

  core.info(JSON.stringify("Debug 6"));

  return {
    ...calculate(
      (numDeps || 0) + (numDevDeps || 0),
      {
        ...dependenciesOutOfDate,
        ...devDependenciesOutOfDate,
      } as NpmOutdatedOutput,
      'All dependencies (including dev)',
    ),
    byType: results,
  };
}

import * as core from '@actions/core';
import yaml from 'js-yaml';
import fs from 'fs';
import semver from 'semver';
import path from 'path';
import {
  yarnOutdated,
  YarnDependencyInfoRow,
  yarnOutdatedByType,
} from './yarnOutdated';
import {
  getNumberOfDependencies,
  getNumberOfDependenciesByType,
} from './getNumberOfDependencies';

interface PackagesByOutVersion {
  major: YarnDependencyInfoRow[];
  minor: YarnDependencyInfoRow[];
  patch: YarnDependencyInfoRow[];
}

/**
 * Sort packages by their out of date version (major, minor, patch)
 *
 * @param {Array} packages - List of package settings from yarn outdated
 * @returns Object of packages sorted by out of date version
 */
function groupPackagesByOutOfDateName(
  packages: YarnDependencyInfoRow[],
): PackagesByOutVersion {
  return packages.reduce(
    (acc: PackagesByOutVersion, packageInfo: YarnDependencyInfoRow) => {
      // TODO: Support npm outdated format or convert to match this format
      const current = packageInfo[1];
      const latest = packageInfo[3];
      const packageName = packageInfo[0];

      // Skip dependencies which have "exotic" version (can be caused by pointing to a github repo in package file)
      if (latest === 'exotic') {
        core.debug(
          `Skipping check of ${packageName} since it's latest version is "exotic" (i.e. not found in package registry)`,
        );
        return acc;
      }

      const currentMajor = semver.major(current);
      const latestMajor = semver.major(latest);
      const currentMinor = semver.minor(current);
      const latestMinor = semver.minor(latest);

      const preMajor = currentMajor === 0 || latestMajor === 0;
      const preMinor = preMajor && (currentMinor === 0 || latestMinor === 0);

      if (currentMajor !== latestMajor) {
        acc.major.push(packageInfo);
      } else if (currentMinor !== latestMinor) {
        if (preMajor) {
          // If the major version number is zero (0.x.x), treat a change of the
          // minor version number as a major change.
          acc.major.push(packageInfo);
        } else {
          acc.minor.push(packageInfo);
        }
      } else if (semver.patch(current) !== semver.patch(latest)) {
        if (preMinor) {
          // If the major & minor version numbers are zero (0.0.x), treat a
          // change of the patch version number as a major change.
          acc.major.push(packageInfo);
        } else if (preMajor) {
          // If the major version number is zero (0.x.x), treat a change of the
          // patch version number as a minor change.
          acc.minor.push(packageInfo);
        } else {
          acc.patch.push(packageInfo);
        }
      }
      return acc;
    },
    {
      major: [],
      minor: [],
      patch: [],
    },
  );
}

interface DependabotIgnoreSetting {
  ['dependency-name']: string;
  versions?: string[];
}

interface DependabotUpdateSetting {
  ['package-ecosystem']?: string;
  directory?: string;
  schedule?: {
    interval?: string;
  };
  assignees?: string[];
  reviewers?: string[];
  ignore?: DependabotIgnoreSetting[];
}

interface DependabotConfig {
  version?: number;
  updates?: DependabotUpdateSetting[];
}

/**
 * @returns Dependabot config
 */
function loadDependabotConfig(): DependabotConfig {
  const configPath = `${process.cwd()}/.github/dependabot.yml`;
  if (!fs.existsSync(configPath)) {
    core.debug(
      '.github/dependabot.yml not found at repo base, skipping search for ignore',
    );
    return {};
  }
  core.debug('.github/dependabot.yml found, loading contents');
  try {
    const configFileBuff = fs.readFileSync(configPath);
    const configFile = yaml.load(configFileBuff.toString());
    if (
      !configFile ||
      typeof configFile === 'string' ||
      typeof configFile === 'number'
    ) {
      core.warning(
        '.github/dependabot.yml is not a valid yaml object, skipping check for ignore',
      );
      return {};
    }
    return configFile as DependabotConfig;
  } catch (error) {
    core.warning(
      'Error parsing .github/dependabot.yml, confirm it is valid yaml in order for ignore settings to be picked up',
    );
    return {};
  }
}

/**
 * @param cwdSetting - Current working directory setting
 * @returns List of dependencies to ignore from dependabot config
 */
async function loadIgnoreFromDependabotConfig(
  cwdSetting: string,
): Promise<string[]> {
  const dependabotConfig = loadDependabotConfig();
  core.debug(
    'Searching dependabot config for ignore settings which match current working directory',
  );
  // Look for settings which match the current path
  const settingsForPath = dependabotConfig?.updates?.find(
    (updateSetting: DependabotUpdateSetting) => {
      if (updateSetting?.['package-ecosystem'] === 'npm') {
        //  Trim leading and trailing slashes from directory setting and cwdSetting
        const directorySetting = updateSetting?.directory || '';
        const cleanDirectorySetting = directorySetting.replace(/^\/|\/$/g, '');
        return cwdSetting
          ? cleanDirectorySetting === cwdSetting?.replace(/^\/|\/$/g, '')
          : updateSetting?.directory === '/';
      }
      return false;
    },
  );
  if (!settingsForPath?.ignore) {
    return [];
  }
  return settingsForPath.ignore.map(
    (ignoreSetting: DependabotIgnoreSetting) =>
      ignoreSetting['dependency-name'],
  );
}

export interface StatsOutput {
  dependencies: {
    major: YarnDependencyInfoRow[];
    minor: YarnDependencyInfoRow[];
    patch: YarnDependencyInfoRow[];
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

interface StatsByDepType {
  devDependencies?: StatsOutput;
  dependencies?: StatsOutput;
}

/**
 * @param numDeps
 * @param outdatedDependencies
 * @param messagePrefix
 */
function calculate(
  numDeps: number,
  outdatedDependencies: YarnDependencyInfoRow[],
  messagePrefix: string,
) {
  // Sort packages by if they are out by major/minor/patch
  const sorted = groupPackagesByOutOfDateName(outdatedDependencies);
  // TODO: Add option to select just dev dependencies
  const majorsOutOfDate = sorted.major.length;
  const minorsOutOfDate = sorted.minor.length;
  const patchesOutOfDate = sorted.patch.length;
  const majorPercentOutOfDate = ((majorsOutOfDate / numDeps) * 100).toFixed(2);
  const minorPercentOutOfDate = ((minorsOutOfDate / numDeps) * 100).toFixed(2);
  const patchPercentOutOfDate = ((patchesOutOfDate / numDeps) * 100).toFixed(2);
  const upToDatePercent = (
    ((numDeps - (majorsOutOfDate + minorsOutOfDate + patchesOutOfDate)) /
      numDeps) *
    100
  ).toFixed(2);
  const messageLines = [
    messagePrefix,
    `up to date: ${
      numDeps - (majorsOutOfDate + minorsOutOfDate + patchesOutOfDate)
    }/${numDeps} (${upToDatePercent} %)`,
    `major behind: ${majorsOutOfDate}/${numDeps} (${majorPercentOutOfDate} %)`,
    `minor behind: ${minorsOutOfDate}/${numDeps} (${minorPercentOutOfDate} %)`,
    `patch behind: ${patchesOutOfDate}/${numDeps} (${patchPercentOutOfDate} %)`,
  ];
  core.debug(messageLines.join('\n'));
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
        numDeps - (majorsOutOfDate + minorsOutOfDate + patchesOutOfDate),
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

/**
 * Get stats about dependencies which are outdated by at least 1 major version
 *
 * @param workingDirectory
 * @param depFilter
 * @returns Object containing stats about out of date packages
 */
export async function getDependencyStatsByType(
  workingDirectory: string,
): Promise<StatsByDepType> {
  core.debug(`working directory ${workingDirectory}`);
  // Use yarn to list outdated packages and parse into JSON
  const {
    dependencies: dependenciesOutOfDate,
    devDependencies: devDependenciesOutOfDate,
  } = await yarnOutdatedByType(workingDirectory);
  const { dependencies: numDeps, devDependencies: numDevDeps } =
    await getNumberOfDependenciesByType(workingDirectory);

  // Get list of packages to ignore from dependabot config if it exists
  // TODO: Drop support for ignoring based on dependency config

  // Sort packages by if they are out by major/minor/patch
  return {
    dependencies: calculate(numDeps, dependenciesOutOfDate, 'Dependencies'),
    devDependencies: calculate(
      numDevDeps,
      devDependenciesOutOfDate,
      'Dev Dependencies',
    ),
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
 *
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
  // Use yarn to list outdated packages and parse into JSON
  const { body: outdatedDependencies } = await yarnOutdated(workingDirectory);

  // Get list of packages to ignore from dependabot config if it exists
  // TODO: Drop support for ignoring based on dependency config
  const ignoredPackages = await loadIgnoreFromDependabotConfig(
    workingDirectoryInput,
  );

  // Filter out any packages which should be ignored
  const filtered = outdatedDependencies.filter(
    ([packageName]) => !ignoredPackages.includes(packageName.toLowerCase()),
  );

  const numDeps = await getNumberOfDependencies(workingDirectory);
  // const { dependencies: numDeps, devDependencies: numDevDeps } = await getNumberOfDependenciesByType(workingDirectory);
  const { dependencies, devDependencies } = await getDependencyStatsByType(
    workingDirectory,
  );
  return {
    ...calculate(numDeps, filtered, 'All dependencies (including dev)'),
    byType: {
      devDependencies,
      dependencies,
    },
  };
}

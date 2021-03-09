import * as core from '@actions/core';
import yaml from 'js-yaml';
import fs from 'fs';
import semver from 'semver';
import path from 'path';
import yarnOutdated, { YarnDepdendencyInfoRow } from './yarnOutdated';

interface PackagesByOutVersion {
  major: YarnDepdendencyInfoRow[];
  minor: YarnDepdendencyInfoRow[];
  patch: YarnDepdendencyInfoRow[];
}

/**
 * Sort packages by their out of date version (major, minor, patch)
 *
 * @param {Array} packages - List of package settings from yarn outdated
 * @returns Object of packages sorted by out of date version
 */
function groupPackagesByOutOfDateName(
  packages: YarnDepdendencyInfoRow[],
): PackagesByOutVersion {
  return packages.reduce(
    (acc: PackagesByOutVersion, packageInfo: YarnDepdendencyInfoRow) => {
      // TODO: Support npm outdated format or convert to match this format
      const current = packageInfo[1];
      const latest = packageInfo[3];

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

/**
 * Load and parse a JSON file from the file system
 *
 * @param filePath - File path
 * @returns Parsed JSON file contents
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadJsonFile(filePath: string): Promise<any> {
  const fileBuff = await fs.promises.readFile(filePath);
  try {
    return JSON.parse(fileBuff.toString());
  } catch (err) {
    core.error(`Error loading json file "${filePath}"`);
    throw err;
  }
}

interface PackageFile {
  dependencies?: {
    [k: string]: string;
  };
  devDependencies?: {
    [k: string]: string;
  };
  version?: string;
}

/**
 * Get number of dependencies listed in package file
 *
 * @param {string} basePath - Base path of package.json
 * @returns Number of dependencies (both dev and prod dependencies)
 */
async function getNumberOfDependencies(basePath: string) {
  const pkgPath = `${basePath}/package.json`;
  if (!fs.existsSync(pkgPath)) {
    core.warning(`Package file does not exist at path ${basePath}`);
    return 0;
  }
  const pkgFile: PackageFile = await loadJsonFile(pkgPath);
  const numDevDependencies = Object.keys(pkgFile.devDependencies || {}).length;
  const numDependencies = Object.keys(pkgFile.dependencies || {}).length;
  return numDependencies + numDevDependencies;
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
    return configFile;
  } catch (error) {
    core.error('Error loading dependabot config from .github/dependabot.yml');
    throw error;
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
  try {
    // Look for settings which match the current path
    const settingsForPath = dependabotConfig?.updates?.find(
      (updateSetting: DependabotUpdateSetting) => {
        if (updateSetting?.['package-ecosystem'] === 'npm') {
          //  Trim leading and trailing slashes from directory setting and cwdSetting
          const cleanDirectorySetting = updateSetting?.directory?.replace(
            /^\/|\/$/g,
            '',
          );
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
  } catch (error) {
    core.error('Error parsing .github/dependabot.yml');
    throw error;
  }
}

export interface StatsOutput {
  dependencies: {
    major: YarnDepdendencyInfoRow[];
    minor: YarnDepdendencyInfoRow[];
    patch: YarnDepdendencyInfoRow[];
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
 * Get stats about dependencies which are outdated by at least 1 major version
 *
 * @returns Object containing stats about out of date packages
 */
export default async function getDepedencyStats(): Promise<StatsOutput> {
  const startWorkingDirectory = process.cwd();
  // seems the working directory should be absolute to work correctly
  // https://github.com/cypress-io/github-action/issues/211
  const workingDirectoryInput = core.getInput('working-directory');
  const workingDirectory = workingDirectoryInput
    ? path.resolve(workingDirectoryInput)
    : startWorkingDirectory;
  core.debug(`working directory ${workingDirectory}`);
  // Use yarn to list outdated packages and parse into JSON
  const dataBody = await yarnOutdated(workingDirectory);
  const ignoredPackages = await loadIgnoreFromDependabotConfig(
    workingDirectoryInput,
  );

  // Filter out any packages which should be ignored
  const filtered = dataBody.filter(
    ([packageName]) => !ignoredPackages.includes(packageName.toLowerCase()),
  );

  // Sort packages by if they are out by major/minor/patch
  const sorted = groupPackagesByOutOfDateName(filtered);
  // TODO: Add option to select just dev dependencies
  const majorsOutOfDate = sorted.major.length;
  const minorsOutOfDate = sorted.minor.length;
  const patchesOutOfDate = sorted.patch.length;
  const numDeps = await getNumberOfDependencies(workingDirectory);
  const percentOutOfDate = ((majorsOutOfDate / numDeps) * 100).toFixed(2);
  core.debug(
    `Major versions behind:\n\t${majorsOutOfDate} / ${numDeps}\n\t${percentOutOfDate} %`,
  );
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
      upToDate: ((majorsOutOfDate / numDeps) * 100).toFixed(2),
      major: percentOutOfDate,
      minor: ((minorsOutOfDate / numDeps) * 100).toFixed(2),
      patch: ((patchesOutOfDate / numDeps) * 100).toFixed(2),
    },
  };
}

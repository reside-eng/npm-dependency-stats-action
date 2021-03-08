import * as core from '@actions/core';
import exec from '@actions/exec';
import fs from 'fs';
import semver from 'semver';

type DepdendencyInfo = [string, string, string, string, string, string];

/**
 * Get output of yarn outdated command parsed as JSON
 * Item format: [packageName, current, wanted, latest, depTypeListName]
 * @param {String} basePath - Base path of package.json
 * @returns Output of outdated command in JSON format
 */
async function getOutdatedJson(basePath: string): Promise<DepdendencyInfo[]> {
  const args = ['outdated', '--json'];
  if (basePath) {
    args.push('--cwd');
    args.push(basePath);
  }
  try {
    let myOutput = '';
    let myError = '';

    const options: exec.ExecOptions = {
      listeners: {
        stdout: (data: Buffer) => {
          myOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          myError += data.toString();
        },
      },
    };

    await exec.exec('yarn', args, options);

    // Throw if stderr is triggered
    if (myError) {
      throw new Error(myError);
    }

    // Split to second line since output is in json-lines format
    const secondLineStr = myOutput.split('\n')[1];
    const output = JSON.parse(secondLineStr);
    return output?.data?.body;
  } catch (err) {
    core.error(`Error running yarn outdated command: ${err.message}`);
    throw err;
  }
}

/**
 * Load and parse a JSON file from the file system
 * @param {String} filePath - File path
 * @returns Parsed JSON file
 */
async function loadJsonFile(filePath: string): Promise<any> {
  const fileBuff = await fs.promises.readFile(filePath);
  try {
    return JSON.parse(fileBuff.toString());
  } catch (err) {
    core.error(`Error loading json file "${filePath}"`);
    throw err;
  }
}

interface PackagesByOutVersion {
  major: DepdendencyInfo[];
  minor: DepdendencyInfo[];
  patch: DepdendencyInfo[];
}

/**
 * Sort packages by their out of date version (major, minor, patch)
 * @param {Array} packages - List of package settings from yarn outdated
 * @returns Object of packages sorted by out of date version
 */
function sortPackages(packages: DepdendencyInfo[]): PackagesByOutVersion {
  return packages.reduce(
    (acc: PackagesByOutVersion, packageInfo: DepdendencyInfo) => {
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
 * Get number of dependencies listed in package file
 * @param {String} basePath - Base path of package.json
 * @returns Number of dependencies (both dev and prod dependencies)
 */
async function getNumberOfDependencies(basePath: string) {
  const pkgPath = `${basePath}/package.json`;
  if (!fs.existsSync(pkgPath)) {
    core.warning(`Package file does not exist at path ${basePath}`);
    return 0;
  }
  const pkgFile = await loadJsonFile(pkgPath);
  const numDevDependencies = Object.keys(pkgFile.devDependencies || {}).length;
  const numDependencies = Object.keys(pkgFile.dependencies || {}).length;
  return numDependencies + numDevDependencies;
}

// TODO: Load ignored packages/versions from dependabot.yml settings
const ignoredPackages = ['husky'];

interface StatsOutput {
  percent: string;
  majors: number;
}

/**
 * Get stats about dependencies which are outdated by at least 1 major version
 * @param {String} cwdPath - Current working directory
 * @returns Object containing stats about out of date packages
 */
async function getMajorOutdated(cwdPath: string): Promise<StatsOutput> {
  const basePath = cwdPath ? `${process.cwd()}/${cwdPath}` : process.cwd();
  // Use yarn to list outdated packages and parse into JSON
  const dataBody = await getOutdatedJson(basePath);
  // Filter out any packages which should be ignored
  const filtered = dataBody.filter(
    ([packageName]) => !ignoredPackages.includes(packageName.toLowerCase()),
  );
  // Sort packages by if they are out by major/minor/patch
  const sorted = sortPackages(filtered);
  // TODO: Add option to select just dev dependencies
  const majorsOutOfDate = sorted.major.length;
  const numDeps = await getNumberOfDependencies(basePath);
  const percentOutOfDate = ((majorsOutOfDate / numDeps) * 100).toFixed(2);
  core.debug(
    `Major versions behind:\n\t${majorsOutOfDate} / ${numDeps}\n\t${percentOutOfDate} %`,
  );
  return { percent: percentOutOfDate, majors: majorsOutOfDate };
}

async function run(): Promise<void> {
  const cwd = core.getInput('cwd');
  await getMajorOutdated(cwd);
}

run().catch((err) => {
  core.error(err);
  process.exit(1);
});

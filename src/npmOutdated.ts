import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { readFile } from 'fs/promises';

// eslint-disable-next-line no-shadow
enum DepTypes {
  devDependencies = 'devDependencies',
  dependencies = 'dependencies',
}

interface NpmOutdatedPackageOutput {
  current: string;
  latest: string;
  wanted: string;
  dependent: string;
  location: string;
}

interface NpmOutdatedOutput {
  [k: string]: NpmOutdatedPackageOutput;
}

/**
 * Get output of yarn outdated command parsed as JSON
 * Item format: [packageName, current, wanted, latest, depTypeListName]
 * @param basePath - Base path of package.json
 * @returns Output of outdated command in JSON format
 */
export async function npmOutdated(
  basePath: string,
): Promise<NpmOutdatedOutput> {
  const args = ['outdated', '--json'];
  if (basePath) {
    args.push('--prefix');
    args.push(basePath);
  }
  let outputData = '';
  let errorData = '';
  try {
    const options: exec.ExecOptions = {
      listeners: {
        stdout: (data: Buffer) => {
          outputData += data.toString();
        },
        stderr: (data: Buffer) => {
          errorData += data.toString();
        },
      },
    };

    await exec.exec('npm', args, options);

    // Handle errors thrown in outdated command
    if (errorData) {
      core.error(`npm outdated command emitted an error: ${errorData}`);
      throw new Error(errorData);
    }
    // If command doesn't throw, then there are no packages out of date
    return {};
  } catch (err) {
    try {
      core.debug(`Output of parsing npm outdated command: ${outputData}`);
      return JSON.parse(outputData);
    } catch (err2) {
      const { message } = err2 as Error;
      core.error(`Error parsing results of npm outdated command: ${message}`);
      throw err2;
    }
  }
}

interface NpmOutdatedByType {
  [DepTypes.devDependencies]: NpmOutdatedOutput;
  [DepTypes.dependencies]: NpmOutdatedOutput;
}

interface PkgFile {
  [DepTypes.devDependencies]: Record<string, string>;
  [DepTypes.devDependencies]: Record<string, string>;
}

/**
 * @param basePath - Base path of package.json
 * @returns Output of outdated command grouped by dependency type
 */
export async function npmOutdatedByType(
  basePath: string,
): Promise<NpmOutdatedByType> {
  const outOfDatePackages = await npmOutdated(basePath);
  const pkgFileBuf = await readFile(`${basePath}/package.json`);
  const pkgFile = JSON.parse(pkgFileBuf.toString()) as PkgFile;
  return Object.entries(outOfDatePackages).reduce(
    (acc, [depName, depInfo]) => {
      const depType = Object.keys(pkgFile?.devDependencies).includes(depName)
        ? DepTypes.devDependencies
        : DepTypes.dependencies;
      return {
        ...acc,
        [depType]: { ...acc[depType], [depName]: depInfo },
      };
    },
    {
      [DepTypes.dependencies]: {},
      [DepTypes.devDependencies]: {},
    } as NpmOutdatedByType,
  );
}

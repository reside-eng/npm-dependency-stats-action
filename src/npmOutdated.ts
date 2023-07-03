import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { readFileSync } from 'fs';

export type DepType = 'devDependencies' | 'dependencies';

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
  devDependencies: NpmOutdatedOutput;
  dependencies: NpmOutdatedOutput;
}

/**
 * @param basePath - Base path of package.json
 * @returns Output of outdated command grouped by dependency type
 */
export async function npmOutdatedByType(
  basePath: string,
): Promise<NpmOutdatedByType> {
  const outOfDatePackages = await npmOutdated(basePath);
  const pkgFileBuf = readFileSync(`${basePath}/package.json`);
  const pkgFile = JSON.parse(pkgFileBuf.toString()) as {
    devDependencies: Record<string, string>;
    dependencies: Record<string, string>;
  };
  return Object.entries(outOfDatePackages).reduce(
    (acc, [depName, depInfo]) => {
      const isDevDep = Object.keys(pkgFile?.devDependencies).includes(depName);
      acc[isDevDep ? 'devDependencies' : 'dependencies'].push(depInfo);
      return acc;
    },
    { dependencies: {}, devDependencies: {} } as NpmOutdatedByType,
  );
}

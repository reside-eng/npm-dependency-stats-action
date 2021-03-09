import * as core from '@actions/core';
import * as exec from '@actions/exec';

export type YarnDepdendencyInfoRow = [
  string,
  string,
  string,
  string,
  string,
  string,
];

/**
 * Get output of yarn outdated command parsed as JSON
 * Item format: [packageName, current, wanted, latest, depTypeListName]
 *
 * @param {string} basePath - Base path of package.json
 * @returns Output of outdated command in JSON format
 */
export default async function yarnOutdated(
  basePath: string,
): Promise<YarnDepdendencyInfoRow[]> {
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

    const exitCode = await exec.exec('yarn', args, options);
    // If command doesn't throw, then there are no packages out of date
    if (exitCode === 0 || !myError) {
      return [];
    }

    // Split to second line since output is in json-lines format
    const secondLineStr = myError.split('}\n')[1];
    const output = JSON.parse(secondLineStr);
    return output?.data?.body;
  } catch (err) {
    core.error(`Error running yarn outdated command: ${err.message}`);
    throw err;
  }
}

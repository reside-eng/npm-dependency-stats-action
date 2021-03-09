import * as core from '@actions/core';
import exec from '@actions/exec';

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

    await exec.exec('yarn', args, options);

    // Throw if stderr is triggered
    if (myError) {
      throw new Error(myError);
    }

    // Split to second line since output is in json-lines format
    const secondLineStr = myOutput.split('}\n')[1];
    const output = JSON.parse(secondLineStr);
    return output?.data?.body;
  } catch (err) {
    core.error(`Error running yarn outdated command: ${err.message}`);
    throw err;
  }
}

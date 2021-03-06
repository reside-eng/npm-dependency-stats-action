import * as core from '@actions/core';
import * as exec from '@actions/exec';

export type YarnDependencyInfoRow = [
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
): Promise<YarnDependencyInfoRow[]> {
  const args = ['outdated', '--json'];
  if (basePath) {
    args.push('--cwd');
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

    await exec.exec('yarn', args, options);

    // Handle errors thrown in outdated command
    if (errorData) {
      core.error(`Yarn outdated command emitted an error: ${errorData}`);
      throw new Error(errorData);
    }
    // If command doesn't throw, then there are no packages out of date
    return [];
  } catch (err) {
    try {
      // Output is in json-lines format - use Regex to handle different newline characters
      const outdatedDataStr =
        outputData.match(/{"type":"table"(.*}})/)?.[0] || '';
      core.debug(`Output of parsing yarn outdated command: ${outdatedDataStr}`);
      const outdatedData = JSON.parse(outdatedDataStr);
      return outdatedData?.data?.body || [];
    } catch (err2) {
      const { message } = err2 as Error;
      core.error(`Error parsing results of yarn outdated command: ${message}`);
      throw err2;
    }
  }
}

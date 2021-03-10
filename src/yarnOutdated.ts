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
  let myOutput = '';
  let myError = '';
  try {
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
    // If command doesn't throw, then there are no packages out of date
    return [];
  } catch (err) {
    try {
      // Output is in json-lines format - use Regex to handle different newline characters
      const outdatedDataStr =
        myError.match(/{"type":"table"(.*}})/)?.[0] || '{}';
      const outdatedData = JSON.parse(outdatedDataStr);
      return outdatedData?.data?.body;
    } catch (err2) {
      core.error(`Error running yarn outdated command: ${err2.message}`);
      throw err2;
    }
  }
}

import * as core from '@actions/core';
import fs from 'fs';

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
    core.error(`Error parsing json file "${filePath}"`);
    const { message } = err as Error;
    throw new Error(message);
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
 * @param basePath - Base path of package.json
 * @returns Number of dependencies (both dev and prod dependencies)
 */
export default async function getNumberOfDependencies(
  basePath: string,
): Promise<number> {
  const pkgPath = `${basePath}/package.json`;
  if (!fs.existsSync(pkgPath)) {
    core.warning(`Package file does not exist at path ${basePath}`);
    return 0;
  }
  const pkgFile: PackageFile = await loadJsonFile(pkgPath);
  const numDevDependencies = Object.keys(pkgFile?.devDependencies || {}).length;
  const numDependencies = Object.keys(pkgFile?.dependencies || {}).length;
  return numDependencies + numDevDependencies;
}

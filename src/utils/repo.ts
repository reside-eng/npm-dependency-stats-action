import * as core from '@actions/core';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

/**
 * Load and parse a JSON file from the file system
 * @param filePath - File path
 * @returns Parsed JSON file contents
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadJsonFile(filePath: string): Promise<any> {
  const fileBuff = await readFile(filePath);
  try {
    return JSON.parse(fileBuff.toString());
  } catch (err) {
    core.error(`Error parsing json file "${filePath}"`);
    const { message } = err as Error;
    throw new Error(message);
  }
}

export const DepTypes = {
  devDependencies: 'devDependencies',
  dependencies: 'dependencies',
} as const;

export type DepType = (typeof DepTypes)[keyof typeof DepTypes];

export interface PackageFile {
  [DepTypes.dependencies]?: Record<string, string>;
  [DepTypes.devDependencies]?: Record<string, string>;
  version?: string;
  engines?: {
    node?: string;
  };
}

/**
 * Get package file of repo
 * @param basePath - Base path of repo
 * @returns Repo package file
 */
export async function getRepoPackageFile(
  basePath: string,
): Promise<PackageFile> {
  const pkgPath = `${basePath}/package.json`;
  if (!existsSync(pkgPath)) {
    core.warning(`Package file does not exist at path ${basePath}`);
    return {};
  }
  return loadJsonFile(pkgPath);
}

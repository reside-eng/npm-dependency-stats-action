import * as core from '@actions/core';
import fs from 'fs';
import { getRepoPackageFile } from './utils/repo';

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
 * @deprecated Use getNumberOfDependenciesByType instead
 * @param basePath - Base path of package.json
 * @returns Number of dependencies (both dev and prod dependencies)
 */
export async function getNumberOfDependencies(
  basePath: string,
): Promise<number> {
  const pkgFile = await getRepoPackageFile(basePath);
  const numDevDependencies = Object.keys(pkgFile?.devDependencies || {}).length;
  const numDependencies = Object.keys(pkgFile?.dependencies || {}).length;
  return numDependencies + numDevDependencies;
}

interface NumberOfDependenciesByType {
  dependencies: number;
  devDependencies: number;
}

/**
 * @param basePath - Base path of package.json
 * @returns Number of dependencies (both dev and prod dependencies)
 */
export async function getNumberOfDependenciesByType(
  basePath: string,
): Promise<NumberOfDependenciesByType> {
  const pkgFile = await getRepoPackageFile(basePath);
  const numDevDependencies = Object.keys(pkgFile?.devDependencies || {}).length;
  const numDependencies = Object.keys(pkgFile?.dependencies || {}).length;
  return { dependencies: numDependencies, devDependencies: numDevDependencies };
}

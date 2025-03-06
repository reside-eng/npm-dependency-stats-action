import { DepTypes, getRepoPackageFile } from './utils/repo';

type NumberOfDependenciesByType = {
  [DepTypes.dependencies]: number;
  [DepTypes.devDependencies]: number;
};

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

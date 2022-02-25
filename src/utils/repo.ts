import * as core from '@actions/core';
import yaml from 'js-yaml';
import { existsSync, readFileSync, promises } from 'fs';

/**
 * Load and parse a JSON file from the file system
 *
 * @param filePath - File path
 * @returns Parsed JSON file contents
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadJsonFile(filePath: string): Promise<any> {
  const fileBuff = await promises.readFile(filePath);
  try {
    return JSON.parse(fileBuff.toString());
  } catch (err) {
    core.error(`Error parsing json file "${filePath}"`);
    const { message } = err as Error;
    throw new Error(message);
  }
}

export interface PackageFile {
  dependencies?: {
    [k: string]: string;
  };
  devDependencies?: {
    [k: string]: string;
  };
  version?: string;
  engines?: {
    node?: string;
  };
}

/**
 * @param basePath
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

interface DependabotIgnoreSetting {
  ['dependency-name']: string;
  versions?: string[];
}

interface DependabotUpdateSetting {
  ['package-ecosystem']?: string;
  directory?: string;
  schedule?: {
    interval?: string;
  };
  assignees?: string[];
  reviewers?: string[];
  ignore?: DependabotIgnoreSetting[];
}

interface DependabotConfig {
  version?: number;
  updates?: DependabotUpdateSetting[];
}

/**
 * @returns Dependabot config
 */
function loadDependabotConfig(): DependabotConfig {
  const configPath = `${process.cwd()}/.github/dependabot.yml`;
  if (!existsSync(configPath)) {
    core.debug(
      '.github/dependabot.yml not found at repo base, skipping search for ignore',
    );
    return {};
  }
  core.debug('.github/dependabot.yml found, loading contents');
  try {
    const configFileBuff = readFileSync(configPath);
    const configFile = yaml.load(configFileBuff.toString());
    if (
      !configFile ||
      typeof configFile === 'string' ||
      typeof configFile === 'number'
    ) {
      core.warning(
        '.github/dependabot.yml is not a valid yaml object, skipping check for ignore',
      );
      return {};
    }
    return configFile as DependabotConfig;
  } catch (error) {
    core.warning(
      'Error parsing .github/dependabot.yml, confirm it is valid yaml in order for ignore settings to be picked up',
    );
    return {};
  }
}

/**
 * @param cwdSetting - Current working directory setting
 * @returns List of dependencies to ignore from dependabot config
 */
export async function loadIgnoreFromDependabotConfig(
  cwdSetting: string,
): Promise<string[]> {
  const dependabotConfig = loadDependabotConfig();
  core.debug(
    'Searching dependabot config for ignore settings which match current working directory',
  );
  // Look for settings which match the current path
  const settingsForPath = dependabotConfig?.updates?.find(
    (updateSetting: DependabotUpdateSetting) => {
      if (updateSetting?.['package-ecosystem'] === 'npm') {
        //  Trim leading and trailing slashes from directory setting and cwdSetting
        const directorySetting = updateSetting?.directory || '';
        const cleanDirectorySetting = directorySetting.replace(/^\/|\/$/g, '');
        return cwdSetting
          ? cleanDirectorySetting === cwdSetting?.replace(/^\/|\/$/g, '')
          : updateSetting?.directory === '/';
      }
      return false;
    },
  );
  if (!settingsForPath?.ignore) {
    return [];
  }
  return settingsForPath.ignore.map(
    (ignoreSetting: DependabotIgnoreSetting) =>
      ignoreSetting['dependency-name'],
  );
}

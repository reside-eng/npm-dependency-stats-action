import * as core from '@actions/core';
import fs from 'fs';
import { getDependencyStats } from './getDependencyStats';
import { NpmOutdatedOutput } from './npmOutdated';

const mockCore = core as jest.Mocked<typeof core>;

interface MockObj {
  inputs: Record<string, string | undefined>;
  dependencies?: number;
  devDependencies?: number;
  outdatedDependencies?: NpmOutdatedOutput;
  outdatedDevDependencies?: NpmOutdatedOutput;
}
let mock: MockObj;

jest.mock('@actions/core');
jest.mock('./npmOutdated', () => ({
  __esModule: true,
  npmOutdatedByType: () =>
    Promise.resolve({
      dependencies: mock.outdatedDependencies,
      devDependencies: mock.outdatedDevDependencies,
    }),
}));
jest.mock('./getNumberOfDependencies', () => ({
  __esModule: true,
  getNumberOfDependenciesByType: () =>
    Promise.resolve({
      dependencies:
        mock.dependencies ||
        Object.keys(mock.outdatedDependencies || {}).length ||
        0,
      devDependencies:
        Object.keys(mock.outdatedDevDependencies || {}).length || 0,
    }),
}));

describe('getDependencyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCore.getInput.mockImplementation(
      (name: string): string => mock.inputs[name] || '',
    );

    mock = {
      // Default action inputs
      inputs: {},
      dependencies: 0,
      outdatedDependencies: {},
      outdatedDevDependencies: {},
    };
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  it('returns stats if all dependencies are up to date', async () => {
    mock.dependencies = 1;
    const result = await getDependencyStats();
    expect(result).toMatchObject({
      counts: {
        total: 1,
        upToDate: 1,
        major: 0,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '100.00',
        major: '0.00',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: {} as NpmOutdatedOutput,
        minor: {} as NpmOutdatedOutput,
        patch: {} as NpmOutdatedOutput,
      },
      byType: {
        dependencies: {
          dependencies: {
            major: {} as NpmOutdatedOutput,
            minor: {} as NpmOutdatedOutput,
            patch: {} as NpmOutdatedOutput,
          },
          counts: {
            total: 1,
            upToDate: 1,
            major: 0,
            minor: 0,
            patch: 0,
          },
          percents: {
            upToDate: '100.00',
            major: '0.00',
            minor: '0.00',
            patch: '0.00',
          },
        },
        devDependencies: {
          dependencies: {
            major: {} as NpmOutdatedOutput,
            minor: {} as NpmOutdatedOutput,
            patch: {} as NpmOutdatedOutput,
          },
          counts: {
            total: 0,
            upToDate: 0,
            major: 0,
            minor: 0,
            patch: 0,
          },
          percents: {
            upToDate: '100.00',
            major: '0.00',
            minor: '0.00',
            patch: '0.00',
          },
        },
      },
    });
  });

  it('returns stats about out of date major, minor, and patch versions', async () => {
    const majorDepName = 'some-major-dep';
    const minorDepName = 'some-minor-dep';
    const patchDepName = 'some-patch-dep';
    mock.outdatedDependencies = {
      [majorDepName]: {
        current: '1.0.0',
        wanted: '1.0.0',
        latest: '2.0.0',
        dependent: 'npm-dependency-stats-action',
        location: `/~/npm-dependency-stats-action/node_modules/${majorDepName}`,
      },
      [minorDepName]: {
        current: '1.0.0',
        wanted: '1.0.0',
        latest: '1.1.0',
        dependent: 'npm-dependency-stats-action',
        location: `/~/npm-dependency-stats-action/node_modules/${minorDepName}`,
      },
      [patchDepName]: {
        current: '1.0.0',
        wanted: '1.0.0',
        latest: '1.0.1',
        dependent: 'npm-dependency-stats-action',
        location: `/~/npm-dependency-stats-action/node_modules/${patchDepName}`,
      },
    };
    const result = await getDependencyStats();
    expect(result).toMatchObject({
      counts: {
        total: 3,
        upToDate: 0,
        major: 1,
        minor: 1,
        patch: 1,
      },
      percents: {
        major: '33.33',
        minor: '33.33',
        patch: '33.33',
        upToDate: '0.00',
      },
      dependencies: {
        major: { [majorDepName]: mock.outdatedDependencies[majorDepName] },
        minor: { [minorDepName]: mock.outdatedDependencies[minorDepName] },
        patch: { [patchDepName]: mock.outdatedDependencies[patchDepName] },
      },
    });
  });

  it('marks out of date minors for pre-v1.0.0 versions as out of date majors', async () => {
    const majorDepName = 'some-dep';
    mock.outdatedDependencies = {
      [majorDepName]: {
        current: '0.0.1',
        wanted: '0.1.0',
        latest: '0.1.0',
        dependent: 'npm-dependency-stats-action',
        location: `/~/npm-dependency-stats-action/node_modules/${majorDepName}`,
      },
    };
    const result = await getDependencyStats();
    expect(result).toMatchObject({
      counts: {
        total: 1,
        upToDate: 0,
        major: 1,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '0.00',
        major: '100.00',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: mock.outdatedDependencies,
        minor: {},
        patch: {},
      },
    });
  });

  it('handles dependencies not installed at the current level (monorepo)', async () => {
    const majorDepName = 'some-dep';
    mock.outdatedDependencies = {
      [majorDepName]: {
        wanted: '0.0.1',
        latest: '0.1.0',
        dependent: 'npm-dependency-stats-action',
      },
    };
    const result = await getDependencyStats();
    expect(result).toMatchObject({
      counts: {
        total: 1,
        upToDate: 0,
        major: 1,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '0.00',
        major: '100.00',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: mock.outdatedDependencies,
        minor: {},
        patch: {},
      },
    });
  });

  it('skips dependency if latest is exotic (i.e. pointing to a github repo in package file)', async () => {
    const majorDepName = 'some-dep';
    mock.outdatedDependencies = {
      [majorDepName]: {
        wanted: '0.0.1',
        latest: 'exotic',
        dependent: 'npm-dependency-stats-action',
      },
    };
    const result = await getDependencyStats();
    expect(mockCore.debug).toHaveBeenCalledWith(
      `Skipping check of ${majorDepName} since it's latest version is "exotic" (i.e. not found in package registry)`,
    );
    expect(result).toMatchObject({
      counts: {
        total: 1,
        upToDate: 1,
        major: 0,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '100.00',
        major: '0.00',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: {},
        minor: {},
        patch: {},
      },
    });
  });
});

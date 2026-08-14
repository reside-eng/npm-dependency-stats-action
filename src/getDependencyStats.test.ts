import fs from 'node:fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDependencyStats } from './getDependencyStats.js';
import type { NpmOutdatedOutput } from './npmOutdated.js';

interface MockObj {
  inputs: Record<string, string | undefined>;
  dependencies?: number;
  devDependencies?: number;
  outdatedDependencies?: NpmOutdatedOutput;
  outdatedDevDependencies?: NpmOutdatedOutput;
}
let mock: MockObj;

vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('./npmOutdated.js', () => ({
  npmOutdatedByType: () =>
    Promise.resolve({
      dependencies: mock.outdatedDependencies,
      devDependencies: mock.outdatedDevDependencies,
    }),
}));
vi.mock('./getNumberOfDependencies.js', () => ({
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

const mockCore = vi.mocked(core);
const mockExec = vi.mocked(exec);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get ISO date string for a number of days ago
 * @param days - Number of days ago
 * @returns ISO date string
 */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

/**
 * Mock npm view calls to return publish dates by package name
 * @param publishDatesByPackage - Map of package name to version publish dates
 */
function mockNpmViewTime(
  publishDatesByPackage: Record<string, Record<string, string>>,
): void {
  mockExec.exec.mockImplementation(
    (
      _commandLine: string,
      args?: string[] | undefined,
      options?: exec.ExecOptions | undefined,
    ) => {
      const packageName = args?.[1] as string;
      const publishDates = publishDatesByPackage[packageName];
      if (!publishDates) {
        return Promise.reject(new Error(`404 Not Found - ${packageName}`));
      }
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify(publishDates)));
      return Promise.resolve(0);
    },
  );
}

describe('getDependencyStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
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

  describe('with minimum-release-age set', () => {
    it('counts quarantined dependencies as up to date and reports them separately', async () => {
      mock.inputs['minimum-release-age'] = '14 days';
      const quarantinedDepName = 'some-quarantined-dep';
      const majorDepName = 'some-major-dep';
      mock.outdatedDependencies = {
        [quarantinedDepName]: {
          current: '1.0.0',
          wanted: '1.0.0',
          latest: '2.0.0',
          dependent: 'npm-dependency-stats-action',
        },
        [majorDepName]: {
          current: '1.0.0',
          wanted: '1.0.0',
          latest: '2.0.0',
          dependent: 'npm-dependency-stats-action',
        },
      };
      mockNpmViewTime({
        [quarantinedDepName]: {
          created: daysAgo(100),
          '1.0.0': daysAgo(100),
          '2.0.0': daysAgo(3),
        },
        [majorDepName]: {
          created: daysAgo(100),
          '1.0.0': daysAgo(100),
          '2.0.0': daysAgo(30),
        },
      });
      const result = await getDependencyStats();
      expect(result).toMatchObject({
        counts: {
          total: 2,
          upToDate: 1,
          major: 1,
          minor: 0,
          patch: 0,
          quarantined: 1,
        },
        percents: {
          upToDate: '50.00',
          major: '50.00',
          minor: '0.00',
          patch: '0.00',
        },
        dependencies: {
          major: { [majorDepName]: expect.any(Object) },
          minor: {},
          patch: {},
          quarantined: {
            [quarantinedDepName]: mock.outdatedDependencies[quarantinedDepName],
          },
        },
      });
    });

    it('classifies against the newest mature version when latest is quarantined', async () => {
      mock.inputs['minimum-release-age'] = '14 days';
      const depName = 'some-dep';
      mock.outdatedDependencies = {
        [depName]: {
          current: '1.0.0',
          wanted: '1.0.0',
          latest: '2.0.0',
          dependent: 'npm-dependency-stats-action',
        },
      };
      mockNpmViewTime({
        [depName]: {
          created: daysAgo(100),
          '1.0.0': daysAgo(100),
          '1.1.0': daysAgo(60),
          '2.0.0': daysAgo(3),
        },
      });
      const result = await getDependencyStats();
      expect(result).toMatchObject({
        counts: {
          total: 1,
          upToDate: 0,
          major: 0,
          minor: 1,
          patch: 0,
          quarantined: 0,
        },
        dependencies: {
          major: {},
          minor: {
            [depName]: {
              ...mock.outdatedDependencies[depName],
              latest: '1.1.0',
            },
          },
          patch: {},
          quarantined: {},
        },
      });
    });

    it('does not check publish dates when minimum-release-age is not set', async () => {
      mock.outdatedDependencies = {
        'some-dep': {
          current: '1.0.0',
          wanted: '1.0.0',
          latest: '2.0.0',
          dependent: 'npm-dependency-stats-action',
        },
      };
      const result = await getDependencyStats();
      expect(mockExec.exec).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        counts: {
          total: 1,
          upToDate: 0,
          major: 1,
          quarantined: 0,
        },
      });
    });
  });
});

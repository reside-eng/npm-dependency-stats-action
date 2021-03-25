import * as core from '@actions/core';
import fs from 'fs';
import yaml from 'js-yaml';
import getDependencyStats from './getDependencyStats';
import { YarnDepdendencyInfoRow } from './yarnOutdated';

const mockCore = core as jest.Mocked<typeof core>;

interface MockObj {
  inputs: Record<string, string | undefined>;
  outdated?: YarnDepdendencyInfoRow[];
}
let mock: MockObj;

jest.mock('@actions/core');
jest.mock('fs');
jest.mock('./yarnOutdated', () => ({
  __esModule: true,
  default: () => Promise.resolve(mock.outdated),
}));
jest.mock('./getNumberOfDependencies', () => ({
  __esModule: true,
  default: () => Promise.resolve(mock.outdated?.length || 0),
}));

describe('getDependencyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCore.getInput.mockImplementation((name: string): string => {
      // console.log('name:', name);
      return mock.inputs[name] || '';
    });

    const depConfig: YarnDepdendencyInfoRow = [
      'some-dep',
      '0.0.1',
      '0.0.1',
      '0.0.1',
      'dependencies',
      '',
    ];

    mock = {
      // Default action inputs
      inputs: {},
      outdated: [depConfig],
    };
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  it('returns stats if all dependencies are up to date', async () => {
    const result = await getDependencyStats();
    expect(result).toEqual({
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
        major: [],
        minor: [],
        patch: [],
      },
    });
  });

  it('returns stats about out of date major, minor, and patch versions', async () => {
    const majorDepName = 'some-major-dep';
    const minorDepName = 'some-minor-dep';
    const patchDepName = 'some-patch-dep';
    mock.outdated = [
      [majorDepName, '1.0.0', '1.0.0', '2.0.0', 'dependencies', ''],
      [minorDepName, '1.0.0', '1.0.0', '1.1.0', 'dependencies', ''],
      [patchDepName, '1.0.0', '1.0.0', '1.0.1', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
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
        major: [mock.outdated[0]],
        minor: [mock.outdated[1]],
        patch: [mock.outdated[2]],
      },
    });
  });

  it('marks out of date minors for pre-v1.0.0 versions as out of date majors', async () => {
    mock.outdated = [
      ['some-dep', '0.0.1', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
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
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });

  it('marks out of date minors for pre-v1.0.0 versions as out of date majors', async () => {
    mock.outdated = [
      ['some-dep', '0.0.1', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
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
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });

  it('marks out of date patch for pre-v0.1.0 versions as out of date major', async () => {
    mock.outdated = [
      ['some-dep', '0.0.1', '0.0.2', '0.0.2', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
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
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });

  it('marks out of date patch for pre-v1.0.0 versions as out of date minor', async () => {
    mock.outdated = [
      ['some-dep', '0.2.0', '0.2.1', '0.2.1', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 1,
        upToDate: 0,
        major: 0,
        minor: 1,
        patch: 0,
      },
      percents: {
        upToDate: '0.00',
        major: '0.00',
        minor: '100.00',
        patch: '0.00',
      },
      dependencies: {
        major: [],
        minor: [mock.outdated[0]],
        patch: [],
      },
    });
  });

  it('handles dependencies marked as "exotic" (their latest version can not be found)', async () => {
    mock.outdated = [
      ['some-dep', '0.0.1', '0.1.0', '0.1.0', 'dependencies', ''],
      ['some-exotic-dep', '0.0.1', 'exotic', 'exotic', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 2,
        upToDate: 1,
        major: 1,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '50.00',
        major: '50.00',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });

  it('returns stats about out of date major, minor, and patch versions', async () => {
    const majorDepName = 'some-major-dep';
    const minorDepName = 'some-minor-dep';
    const patchDepName = 'some-patch-dep';
    mock.outdated = [
      [majorDepName, '1.0.0', '1.0.0', '2.0.0', 'dependencies', ''],
      [minorDepName, '1.0.0', '1.0.0', '1.1.0', 'dependencies', ''],
      [patchDepName, '1.0.0', '1.0.0', '1.0.1', 'dependencies', ''],
      ['up-to-date-dep', '2.0.0', '2.0.0', '2.0.0', 'dependencies', ''],
      ['up-to-date-dep-2', '3.0.0', '3.0.0', '3.0.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 5,
        upToDate: 2,
        major: 1,
        minor: 1,
        patch: 1,
      },
      percents: {
        upToDate: '40.00',
        major: '20.00',
        minor: '20.00',
        patch: '20.00',
      },
      dependencies: {
        major: [mock.outdated[0]],
        minor: [mock.outdated[1]],
        patch: [mock.outdated[2]],
      },
    });
  });

  it('ignores dependencies which are ignored in dependabot settings', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const majorDepName = 'some-major-dep';
    const fakeDependabotConfigContent = yaml.dump({
      updates: [
        {
          'package-ecosystem': 'npm',
          directory: '/',
          ignore: [{ 'dependency-name': majorDepName }],
        },
      ],
    });
    jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(Buffer.from(fakeDependabotConfigContent));
    mock.outdated = [
      [majorDepName, '1.0.0', '1.0.0', '2.0.0', 'dependencies', ''],
      ['some-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
      ['some-other-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 3,
        upToDate: 3,
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
        major: [],
        minor: [],
        patch: [],
      },
    });
  });

  it('does not ignore any dependencies if dependabot config does not contain npm package ecosystem settings', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const majorDepName = 'some-major-dep';
    const fakeDependabotConfigContent = yaml.dump({
      updates: [
        {
          directory: '/',
          ignore: [{ 'dependency-name': majorDepName }],
        },
      ],
    });
    jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(Buffer.from(fakeDependabotConfigContent));
    mock.outdated = [
      [majorDepName, '1.0.0', '1.0.0', '2.0.0', 'dependencies', ''],
      ['some-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
      ['some-other-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 3,
        upToDate: 2,
        major: 1,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '66.67',
        major: '33.33',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });

  it('handles empty dependabot config file (not ignoring any dependencies)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const majorDepName = 'some-major-dep';
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from(''));
    mock.outdated = [
      [majorDepName, '1.0.0', '1.0.0', '2.0.0', 'dependencies', ''],
      ['some-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
      ['some-other-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 3,
        upToDate: 2,
        major: 1,
        minor: 0,
        patch: 0,
      },
      percents: {
        major: '33.33',
        minor: '0.00',
        patch: '0.00',
        upToDate: '66.67',
      },
      dependencies: {
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });

  it('handles error parsing dependabot config file (not ignoring any dependencies)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const majorDepName = 'some-major-dep';
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('{{{1asf`asdf'));
    mock.outdated = [
      [majorDepName, '1.0.0', '1.0.0', '2.0.0', 'dependencies', ''],
      ['some-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
      ['some-other-dep', '0.1.0', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toEqual({
      counts: {
        total: 3,
        upToDate: 2,
        major: 1,
        minor: 0,
        patch: 0,
      },
      percents: {
        upToDate: '66.67',
        major: '33.33',
        minor: '0.00',
        patch: '0.00',
      },
      dependencies: {
        major: [mock.outdated[0]],
        minor: [],
        patch: [],
      },
    });
  });
});

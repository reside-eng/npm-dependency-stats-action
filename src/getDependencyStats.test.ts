import * as core from '@actions/core';
import getDependencyStats from './getDependencyStats';
import { YarnDepdendencyInfoRow } from './yarnOutdated';

jest.mock('@actions/core');

const mockCore = core as jest.Mocked<typeof core>;

interface MockObj {
  inputs: Record<string, string | undefined>;
  outdated?: YarnDepdendencyInfoRow[];
}
let mock: MockObj;

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
  });

  it('returns stats if all dependencies are up to date', async () => {
    const result = await getDependencyStats();
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('counts');
    expect(result).toHaveProperty('percents');
    expect(result.counts).toHaveProperty('total', 1);
    expect(result.counts).toHaveProperty('upToDate', 1);
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
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('counts');
    expect(result).toHaveProperty('percents');
    expect(result.counts).toHaveProperty('total', 3);
    expect(result.counts).toHaveProperty('major', 1);
    expect(result.dependencies).toHaveProperty('major.0.0', majorDepName);
    expect(result.counts).toHaveProperty('minor', 1);
    expect(result.dependencies).toHaveProperty('minor.0.0', minorDepName);
    expect(result.counts).toHaveProperty('patch', 1);
    expect(result.dependencies).toHaveProperty('patch.0.0', patchDepName);
  });

  it('marks out of date minors for pre-v1.0.0 versions as out of date majors', async () => {
    mock.outdated = [
      ['some-dep', '0.0.1', '0.1.0', '0.1.0', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('counts');
    expect(result).toHaveProperty('percents');
    expect(result.counts).toHaveProperty('total', 1);
    expect(result.counts).toHaveProperty('major', 1);
  });

  it('handles dependencies marked as "exotic" (their latest version can not be found)', async () => {
    mock.outdated = [
      ['some-dep', '0.0.1', '0.1.0', '0.1.0', 'dependencies', ''],
      ['some-exotic-dep', '0.0.1', 'exotic', 'exotic', 'dependencies', ''],
    ];
    const result = await getDependencyStats();
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('counts');
    expect(result).toHaveProperty('percents');
    expect(result.counts).toHaveProperty('total', 2);
    expect(result.counts).toHaveProperty('major', 1);
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
    expect(result.percents).toHaveProperty('upToDate', '40.00');
    expect(result.percents).toHaveProperty('major', '20.00');
    expect(result.percents).toHaveProperty('minor', '20.00');
    expect(result.percents).toHaveProperty('patch', '20.00');
  });
});

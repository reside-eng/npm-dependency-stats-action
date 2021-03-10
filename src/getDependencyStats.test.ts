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

  it('returns stats about out of date major versions', async () => {
    const depConfig: YarnDepdendencyInfoRow = [
      'some-dep',
      '0.0.1',
      '0.1.0',
      '0.1.0',
      'dependencies',
      '',
    ];
    mock.outdated = [depConfig];
    const result = await getDependencyStats();
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('counts');
    expect(result).toHaveProperty('percents');
    expect(result.counts).toHaveProperty('total', 1);
    expect(result.counts).toHaveProperty('major', 1);
  });
});

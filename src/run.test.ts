import * as core from '@actions/core';
import fs from 'fs';
import run from './run';
import { YarnDependencyInfoRow } from './yarnOutdated';
import { StatsOutput } from './getDependencyStats';

const mockCore = core as jest.Mocked<typeof core>;
interface MockObj {
  inputs: Record<string, string | undefined>;
  outdated?: YarnDependencyInfoRow[];
  depStats: StatsOutput;
}
const mock: MockObj = {
  inputs: {},
  depStats: {
    counts: {
      total: 4,
      upToDate: 1,
      major: 1,
      minor: 1,
      patch: 1,
    },
    percents: {
      upToDate: '',
      major: '',
      minor: '',
      patch: '',
    },
    dependencies: {
      major: [],
      minor: [],
      patch: [],
    },
  },
};

jest.mock('@actions/core');
jest.mock('fs');
jest.mock('./getDependencyStats', () => ({
  __esModule: true,
  default: () => mock.depStats,
}));

describe('run', () => {
  beforeEach(() => {
    mockCore.getInput.mockImplementation((name: string): string => {
      // console.log('name:', name);
      return mock.inputs[name] || '';
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set output by default', async () => {
    await run();
    expect(mockCore.setOutput).toBeCalledWith(
      'dependencies',
      mock.depStats.dependencies,
    );
  });

  it('should write ot output file if output-file input is set', async () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => '');
    mockCore.getInput.mockReturnValue('./some-path');
    await run();
    expect(mockCore.setOutput).toBeCalledWith(
      'dependencies',
      mock.depStats.dependencies,
    );
  });
});

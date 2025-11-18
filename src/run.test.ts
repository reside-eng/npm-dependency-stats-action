import * as core from '@actions/core';
import fs from 'fs';
import { run } from './run';
import { type StatsOutput } from './getDependencyStats';
import { type NpmOutdatedOutput } from './npmOutdated';

const mockCore = core as jest.Mocked<typeof core>;
interface MockObj {
  inputs: Record<string, string | undefined>;
  outdated?: NpmOutdatedOutput;
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
      major: {} as NpmOutdatedOutput,
      minor: {} as NpmOutdatedOutput,
      patch: {} as NpmOutdatedOutput,
    },
  },
};

jest.mock('@actions/core');
jest.mock('./getDependencyStats', () => ({
  __esModule: true,
  getDependencyStats: () => mock.depStats,
}));

describe('run', () => {
  beforeEach(() => {
    mockCore.getInput.mockImplementation(
      (name: string): string =>
        // console.log('name:', name);
        mock.inputs[name] || '',
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set output by default', async () => {
    await run();
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'dependencies',
      mock.depStats.dependencies,
    );
  });

  it('should write ot output file if output-file input is set', async () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => '');
    mockCore.getInput.mockReturnValueOnce('./some-path');
    await run();
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'dependencies',
      mock.depStats.dependencies,
    );
  });

  describe('monorepo', () => {
    beforeEach(() => {
      mockCore.getInput.mockImplementation((inputName) => {
        if (inputName === 'is-monorepo') {
          return 'true';
        }
        if (inputName === 'packages-folder') {
          return 'packages';
        }
        return './some-path';
      });
    });

    it('should exit with failure if no packages folder found', async () => {
      mockCore.getInput.mockReturnValueOnce('true');
      mockCore.getInput.mockReturnValueOnce('packages');
      mockCore.getInput.mockReturnValueOnce('');
      await run();
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Monorepo detected, but no packages folder found',
      );
    });

    it('should write check dependencies for packages if is-monorepo is true', async () => {
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => '');
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest
        .spyOn(fs, 'readdirSync')
        .mockReturnValueOnce(['package1', 'package2']);
      await run();
      expect(mockCore.setOutput).toHaveBeenCalledWith('dependencies', {
        package1: mock.depStats.dependencies,
        package2: mock.depStats.dependencies,
      });
    });
  });
});

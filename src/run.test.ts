import fs from 'node:fs';
import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatsOutput } from './getDependencyStats.js';
import type { NpmOutdatedOutput } from './npmOutdated.js';
import { run } from './run.js';

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

vi.mock('@actions/core');
vi.mock('./getDependencyStats.js', () => ({
  getDependencyStats: () => mock.depStats,
}));

const mockCore = vi.mocked(core);

describe('run', () => {
  beforeEach(() => {
    mockCore.getInput.mockImplementation(
      (name: string): string => mock.inputs[name] || '',
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should set output by default', async () => {
    await run();
    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'dependencies',
      mock.depStats.dependencies,
    );
  });

  it('should write ot output file if output-file input is set', async () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => '');
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
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => '');
      vi.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValueOnce([
        'package1',
        'package2',
      ] as unknown as ReturnType<typeof fs.readdirSync>);
      await run();
      expect(mockCore.setOutput).toHaveBeenCalledWith('dependencies', {
        package1: mock.depStats.dependencies,
        package2: mock.depStats.dependencies,
      });
    });
  });
});

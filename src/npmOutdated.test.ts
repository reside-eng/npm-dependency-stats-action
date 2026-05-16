import * as exec from '@actions/exec';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { npmOutdatedByType } from './npmOutdated.js';

vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('./utils/repo.js', async (importActual) => ({
  ...(await importActual<typeof import('./utils/repo.js')>()),
  getRepoPackageFile: vi.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'npm-dependency-stats-action',
      dependencies: {
        'some-dep': '29.5.3',
      },
      devDependencies: {
        'some-dev-dep': '1.0.0',
      },
    }),
  ),
}));

const mockExec = vi.mocked(exec);

describe('npmOutdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('npmOutdatedByType', () => {
    it('returns npm outdated by type', async () => {
      const outOfDate = {
        'some-dep': {
          current: '29.5.3',
          dependent: 'npm-dependency-stats-action',
          latest: '29.5.4',
          location:
            '/Users/scott/Dev/Code/reside-eng/npm-dependency-stats-action/node_modules/some-dep',
          wanted: '29.5.3',
        },
      };
      mockExec.exec.mockImplementation(
        (
          _commandLine: string,
          _args?: string[] | undefined,
          options?: exec.ExecOptions | undefined,
        ) => {
          options?.listeners?.stdout?.(
            Buffer.from(JSON.stringify(outOfDate, null, 2)),
          );
          return Promise.reject(new Error('test'));
        },
      );
      const result = await npmOutdatedByType('');
      expect(result).toMatchObject({
        dependencies: expect.objectContaining({
          'some-dep': expect.any(Object),
        }),
      });
    });

    it('correctly categorizes devDependencies by package name', async () => {
      const outOfDate = {
        'some-dev-dep': {
          current: '1.0.0',
          dependent: 'npm-dependency-stats-action',
          latest: '2.0.0',
          wanted: '1.0.0',
        },
      };
      mockExec.exec.mockImplementation(
        (
          _commandLine: string,
          _args?: string[] | undefined,
          options?: exec.ExecOptions | undefined,
        ) => {
          options?.listeners?.stdout?.(
            Buffer.from(JSON.stringify(outOfDate, null, 2)),
          );
          return Promise.reject(new Error('test'));
        },
      );
      const result = await npmOutdatedByType('/some/workspace/path');
      expect(result).toMatchObject({
        devDependencies: expect.objectContaining({
          'some-dev-dep': expect.any(Object),
        }),
        dependencies: {},
      });
    });

    it('filters out dependencies from other workspaces', async () => {
      const outOfDate = {
        'some-dep': {
          current: '29.5.3',
          dependent: 'npm-dependency-stats-action',
          latest: '29.5.4',
          wanted: '29.5.3',
        },
        'other-workspace-dep': {
          current: '1.0.0',
          dependent: 'other-workspace',
          latest: '2.0.0',
          wanted: '1.0.0',
        },
      };
      mockExec.exec.mockImplementation(
        (
          _commandLine: string,
          _args?: string[] | undefined,
          options?: exec.ExecOptions | undefined,
        ) => {
          options?.listeners?.stdout?.(
            Buffer.from(JSON.stringify(outOfDate, null, 2)),
          );
          return Promise.reject(new Error('test'));
        },
      );
      const result = await npmOutdatedByType('/some/workspace/path');
      expect(result).toMatchObject({
        dependencies: {
          'some-dep': expect.any(Object),
        },
        devDependencies: {},
      });
      expect(result.dependencies).not.toHaveProperty('other-workspace-dep');
    });
  });
});

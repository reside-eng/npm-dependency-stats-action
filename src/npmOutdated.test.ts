import * as exec from '@actions/exec';
import { npmOutdatedByType } from './npmOutdated';

const mockExec = exec as jest.Mocked<typeof exec>;

jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('./utils/repo', () => ({
  ...jest.requireActual('./utils/repo.ts'), // Needed for types
  getRepoPackageFile: jest.fn().mockImplementation(() =>
    Promise.resolve({
      dependencies: {
        'some-dep': '29.5.3',
      },
    }),
  ),
}));

describe('npmOutdated', () => {
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
          commandLine: string,
          args?: string[] | undefined,
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
  });
});

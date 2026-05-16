import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNumberOfDependenciesByType } from './getNumberOfDependencies.js';

vi.mock('@actions/core');
vi.mock('node:fs', async (importActual) => {
  const actual = await importActual<typeof import('node:fs')>();
  return { ...actual, existsSync: vi.fn() };
});
vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn() };
});

const mockExistsSync = vi.mocked(existsSync);
const mockReadFile = vi.mocked(readFile);

describe('getNumberOfDependenciesByType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('should return 0 if package file is not found at path', async () => {
    const result = await getNumberOfDependenciesByType('./asdfasdf');
    expect(result).toMatchObject({
      dependencies: 0,
      devDependencies: 0,
    });
  });

  it('should return dependency numbers if package file exists', async () => {
    const pkgFileContents = {
      dependencies: {
        'some-dep': '^1.0.0',
      },
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      Buffer.from(JSON.stringify(pkgFileContents)),
    );
    const result = await getNumberOfDependenciesByType('./asdf');
    expect(result).toMatchObject({
      dependencies: 1,
      devDependencies: 0,
    });
  });

  it('should throw error if package file is invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(Buffer.from('{ { invalidJson }'));
    await expect(getNumberOfDependenciesByType('./asdf')).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          "Expected property name or '}' in JSON at position 2",
        ),
      }),
    );
  });
});

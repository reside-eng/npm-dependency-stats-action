import fs from 'fs';
import { getNumberOfDependenciesByType } from './getNumberOfDependencies';

jest.mock('@actions/core');

describe('getNumberOfDependenciesByType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue(Buffer.from(JSON.stringify(pkgFileContents)));
    const result = await getNumberOfDependenciesByType('./asdf');
    expect(result).toMatchObject({
      dependencies: 1,
      devDependencies: 0,
    });
  });

  it('should throw error if package file is invalid JSON', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue(Buffer.from('{ { invalidJson }'));
    await expect(getNumberOfDependenciesByType('./asdf')).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          "Expected property name or '}' in JSON at position 2",
        ),
      }),
    );
  });
});

import fs from 'fs';
import getNumberOfDependencies from './getNumberOfDependencies';

jest.mock('@actions/core');

describe('getNumberOfDependencies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 0 if package file is not found at path', async () => {
    const result = await getNumberOfDependencies('./asdf');
    expect(result).toBe(0);
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
    const result = await getNumberOfDependencies('./asdf');
    expect(result).toBe(1);
  });

  it('should throw error if package file is invalid JSON', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue(Buffer.from('{ { invalidJson }'));
    await expect(getNumberOfDependencies('./asdf')).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          'Unexpected token { in JSON at position 2',
        ),
      }),
    );
  });
});

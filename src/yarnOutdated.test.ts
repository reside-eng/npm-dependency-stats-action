import * as exec from '@actions/exec';
import yarnOutdated from './yarnOutdated';

jest.mock('@actions/exec');

const mockExec = exec as jest.Mocked<typeof exec>;
const mock = {
  outdatedOutput: '',
};

describe('yarnOutdated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExec.exec.mockImplementation(
      async (cmd: string, args?: string[], options?: exec.ExecOptions) => {
        options?.listeners?.stdout?.(Buffer.from(mock.outdatedOutput, 'utf-8'));
        throw new Error('test');
      },
    );
  });

  it('returns an empty list if no dependencies are out of date', async () => {
    mockExec.exec.mockImplementation(
      async (cmd: string, args?: string[], options?: exec.ExecOptions) => {
        options?.listeners?.stdout?.(Buffer.from(mock.outdatedOutput, 'utf-8'));
        return 0;
      },
    );
    const result = await yarnOutdated('./test');
    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(0);
  });

  it('should return a list of out of date dependencies', async () => {
    /* eslint-disable no-useless-escape */
    mock.outdatedOutput = `{"type":"info","data":"Color legend : \n \"<red>\"    : Major Update backward-incompatible updates \n \"<yellow>\" : Minor Update backward-compatible features \n \"<green>\"  : Patch Update backward-compatible bug fixes"}
    {"type":"table","data":{"head":["Package","Current","Wanted","Latest","Package Type","URL"],"body":[["@types/node","14.14.32","14.14.33","14.14.33","devDependencies","https://github.com/DefinitelyTyped/DefinitelyTyped.git"]]}}`;
    /* eslint-enable no-useless-escape */
    const result = await yarnOutdated('./test');
    expect(result).toBeInstanceOf(Array);
    expect(result[0]).toBeInstanceOf(Array);
    expect(result[0][0]).toBe('@types/node');
  });

  it('should handle error output from yarn outdated command', async () => {
    const outdatedOutput = '{"error": "asdf"}';
    mockExec.exec.mockImplementation(
      async (cmd: string, args?: string[], options?: exec.ExecOptions) => {
        options?.listeners?.stderr?.(Buffer.from(outdatedOutput, 'utf-8'));
        throw new Error('test');
      },
    );
    await expect(yarnOutdated('./test')).rejects.toThrow(
      new Error('Unexpected end of JSON input'),
    );
  });

  it('should handle invalid response from yarn outdated command', async () => {
    mock.outdatedOutput = 'asdfasdf]][[';
    await expect(yarnOutdated('./test')).rejects.toThrow(
      new Error('Unexpected end of JSON input'),
    );
  });
});

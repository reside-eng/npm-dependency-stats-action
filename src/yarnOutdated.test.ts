import * as exec from '@actions/exec';
import yarnOutdated from './yarnOutdated';

const outdatedOutput = `{"type":"info","data":"Color legend : \n \"<red>\"    : Major Update backward-incompatible updates \n \"<yellow>\" : Minor Update backward-compatible features \n \"<green>\"  : Patch Update backward-compatible bug fixes"}
{"type":"table","data":{"head":["Package","Current","Wanted","Latest","Package Type","URL"],"body":[["@types/node","14.14.32","14.14.33","14.14.33","devDependencies","https://github.com/DefinitelyTyped/DefinitelyTyped.git"]]}}`

jest.mock('@actions/exec', () => ({
  exec: (cmd: string, args: string[], options: exec.ExecOptions) => {
    options?.listeners?.stdout?.(Buffer.from(outdatedOutput, 'utf-8'))
    return Promise.resolve(0)
  }
}));

const mockExec = exec as jest.Mocked<typeof exec>;

describe('yarnOutdated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run with default action inputs', async () => {
    const result = await yarnOutdated('./test');
    expect(result).toBeInstanceOf(Array)
    expect(result[0]).toBeInstanceOf(Array)
    expect(result[0][0]).toBe('@types/node')
  });
});

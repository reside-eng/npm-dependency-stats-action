import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NpmOutdatedPackageOutput } from './npmOutdated.js';
import { parseMinimumReleaseAge, partitionQuarantined } from './quarantine.js';

vi.mock('@actions/core');
vi.mock('@actions/exec');

const mockCore = vi.mocked(core);
const mockExec = vi.mocked(exec);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get ISO date string for a number of days ago
 * @param days - Number of days ago
 * @returns ISO date string
 */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

/**
 * Mock npm view calls to return publish dates by package name
 * @param publishDatesByPackage - Map of package name to version publish dates
 */
function mockNpmViewTime(
  publishDatesByPackage: Record<string, Record<string, string>>,
): void {
  mockExec.exec.mockImplementation(
    (
      _commandLine: string,
      args?: string[] | undefined,
      options?: exec.ExecOptions | undefined,
    ) => {
      const packageName = args?.[1] as string;
      const publishDates = publishDatesByPackage[packageName];
      if (!publishDates) {
        return Promise.reject(new Error(`404 Not Found - ${packageName}`));
      }
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify(publishDates)));
      return Promise.resolve(0);
    },
  );
}

/**
 * Build npm outdated info for a package
 * @param overrides - Overrides for package info
 * @returns Package info in npm outdated format
 */
function outdatedInfo(
  overrides: Partial<NpmOutdatedPackageOutput> = {},
): NpmOutdatedPackageOutput {
  return {
    current: '1.0.0',
    wanted: '1.0.0',
    latest: '2.0.0',
    dependent: 'npm-dependency-stats-action',
    ...overrides,
  };
}

describe('parseMinimumReleaseAge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 for empty input', () => {
    expect(parseMinimumReleaseAge('')).toBe(0);
  });

  it('treats a bare number as days', () => {
    expect(parseMinimumReleaseAge('14')).toBe(14 * MS_PER_DAY);
  });

  it.each([
    ['14 days', 14 * MS_PER_DAY],
    ['1 day', MS_PER_DAY],
    ['2 weeks', 14 * MS_PER_DAY],
    ['12 hours', 12 * 60 * 60 * 1000],
    ['1 month', 30 * MS_PER_DAY],
    ['1 year', 365 * MS_PER_DAY],
  ])('parses duration string "%s"', (input, expected) => {
    expect(parseMinimumReleaseAge(input)).toBe(expected);
  });

  it('warns and returns 0 for invalid input', () => {
    expect(parseMinimumReleaseAge('a fortnight')).toBe(0);
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('Invalid minimum-release-age'),
    );
  });
});

describe('partitionQuarantined', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps packages actionable when latest is older than the minimum release age', async () => {
    const packageInfo = outdatedInfo();
    mockNpmViewTime({
      'some-dep': {
        created: daysAgo(100),
        '1.0.0': daysAgo(100),
        '2.0.0': daysAgo(30),
      },
    });
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: { 'some-dep': packageInfo },
      quarantined: {},
    });
  });

  it('quarantines packages where every newer version is younger than the minimum release age', async () => {
    const packageInfo = outdatedInfo();
    mockNpmViewTime({
      'some-dep': {
        created: daysAgo(100),
        '1.0.0': daysAgo(100),
        '2.0.0': daysAgo(3),
      },
    });
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: {},
      quarantined: { 'some-dep': packageInfo },
    });
  });

  it('compares against the newest mature version when latest is quarantined', async () => {
    const packageInfo = outdatedInfo({ latest: '3.0.0' });
    mockNpmViewTime({
      'some-dep': {
        created: daysAgo(100),
        '1.0.0': daysAgo(100),
        '2.5.0': daysAgo(60),
        '3.0.0': daysAgo(2),
      },
    });
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: { 'some-dep': { ...packageInfo, latest: '2.5.0' } },
      quarantined: {},
    });
  });

  it('ignores prerelease versions when finding the newest mature version', async () => {
    const packageInfo = outdatedInfo({ latest: '3.0.0' });
    mockNpmViewTime({
      'some-dep': {
        created: daysAgo(100),
        '1.0.0': daysAgo(100),
        '3.0.0-beta.1': daysAgo(60),
        '3.0.0': daysAgo(2),
      },
    });
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: {},
      quarantined: { 'some-dep': packageInfo },
    });
  });

  it('keeps packages actionable (fail open) when loading publish dates fails', async () => {
    const packageInfo = outdatedInfo();
    mockNpmViewTime({});
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: { 'some-dep': packageInfo },
      quarantined: {},
    });
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('Unable to load publish dates for some-dep'),
    );
  });

  it('skips publish date lookup for packages with non-semver latest (e.g. exotic)', async () => {
    const packageInfo = outdatedInfo({ latest: 'exotic' });
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: { 'some-dep': packageInfo },
      quarantined: {},
    });
    expect(mockExec.exec).not.toHaveBeenCalled();
  });

  it('falls back to wanted version when current is not set (monorepo)', async () => {
    const packageInfo = outdatedInfo({
      current: undefined,
      wanted: '1.9.0',
      latest: '2.0.0',
    });
    mockNpmViewTime({
      'some-dep': {
        created: daysAgo(100),
        '1.9.0': daysAgo(100),
        '2.0.0': daysAgo(3),
      },
    });
    const result = await partitionQuarantined(
      { 'some-dep': packageInfo },
      14 * MS_PER_DAY,
      '/some/path',
    );
    expect(result).toEqual({
      actionable: {},
      quarantined: { 'some-dep': packageInfo },
    });
  });
});

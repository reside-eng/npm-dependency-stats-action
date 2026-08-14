import * as core from '@actions/core';
import * as exec from '@actions/exec';
import semver from 'semver';
import type { NpmOutdatedOutput } from './npmOutdated.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_UNIT: Record<string, number> = {
  hour: MS_PER_HOUR,
  day: MS_PER_DAY,
  week: 7 * MS_PER_DAY,
  month: 30 * MS_PER_DAY,
  year: 365 * MS_PER_DAY,
};

// Max number of npm view calls in flight at once
const CONCURRENCY = 5;

/**
 * Parse minimum-release-age input into milliseconds. Supports the same style
 * of duration strings as Renovate's minimumReleaseAge setting (e.g. "14 days",
 * "2 weeks") as well as a bare number of days (e.g. "14")
 * @param input - Raw minimum-release-age input value
 * @returns Minimum release age in milliseconds (0 means disabled)
 */
export function parseMinimumReleaseAge(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }
  const match = /^(\d+)\s*(hours?|days?|weeks?|months?|years?)?$/i.exec(
    trimmed,
  );
  if (!match) {
    core.warning(
      `Invalid minimum-release-age "${input}" - expected format like "14 days", "2 weeks" or "14". Quarantine filtering is disabled.`,
    );
    return 0;
  }
  const [, value, unit = 'day'] = match;
  return Number(value) * MS_PER_UNIT[unit.toLowerCase().replace(/s$/, '')];
}

/**
 * Get publish dates for all versions of a package using npm view
 * @param packageName - Name of package to load publish dates for
 * @param cwd - Working directory (so npm picks up the repo's .npmrc)
 * @returns Map of version to ISO publish date (also contains created/modified keys)
 */
async function getVersionPublishDates(
  packageName: string,
  cwd: string,
): Promise<Record<string, string>> {
  let outputData = '';
  await exec.exec('npm', ['view', packageName, 'time', '--json'], {
    cwd,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        outputData += data.toString();
      },
    },
  });
  return JSON.parse(outputData);
}

export type QuarantinePartition = {
  actionable: NpmOutdatedOutput;
  quarantined: NpmOutdatedOutput;
};

/**
 * Split outdated packages into ones which are actionable and ones which are
 * quarantined (every version newer than the current version was published
 * more recently than the minimum release age, meaning Renovate is
 * intentionally not updating them yet). If the latest version is quarantined
 * but an older mature version is still newer than the current version, the
 * package stays actionable with latest replaced by that mature version
 * @param outdatedPackages - Outdated packages (from npm outdated)
 * @param minimumReleaseAgeMs - Minimum release age in milliseconds
 * @param cwd - Working directory (so npm picks up the repo's .npmrc)
 * @returns Outdated packages split into actionable and quarantined
 */
export async function partitionQuarantined(
  outdatedPackages: NpmOutdatedOutput,
  minimumReleaseAgeMs: number,
  cwd: string,
): Promise<QuarantinePartition> {
  const actionable: NpmOutdatedOutput = {};
  const quarantined: NpmOutdatedOutput = {};
  const cutoff = Date.now() - minimumReleaseAgeMs;
  const entries = Object.entries(outdatedPackages);

  /**
   * Partition a single outdated package as actionable or quarantined
   * @param entry - Package name and info from npm outdated
   */
  async function partitionPackage(
    entry: (typeof entries)[number],
  ): Promise<void> {
    const [packageName, packageInfo] = entry;
    // Leave packages with non-semver latest (e.g. "exotic") to existing handling
    if (!semver.valid(packageInfo.latest)) {
      actionable[packageName] = packageInfo;
      return;
    }
    let publishDates: Record<string, string>;
    try {
      publishDates = await getVersionPublishDates(packageName, cwd);
    } catch (err) {
      // Fail open - report as out of date rather than hiding it
      core.warning(
        `Unable to load publish dates for ${packageName}, skipping quarantine check: ${(err as Error).message}`,
      );
      actionable[packageName] = packageInfo;
      return;
    }

    // If latest is already older than the minimum release age, nothing is quarantined
    const latestPublishDate = publishDates[packageInfo.latest];
    if (latestPublishDate && Date.parse(latestPublishDate) <= cutoff) {
      actionable[packageName] = packageInfo;
      return;
    }

    // Newest stable version which is older than the minimum release age (what
    // Renovate would actually update to)
    let effectiveLatest: string | null = null;
    for (const [version, publishDate] of Object.entries(publishDates)) {
      if (
        !semver.valid(version) ||
        semver.prerelease(version) ||
        semver.gt(version, packageInfo.latest) ||
        Date.parse(publishDate) > cutoff
      ) {
        continue;
      }
      if (!effectiveLatest || semver.gt(version, effectiveLatest)) {
        effectiveLatest = version;
      }
    }

    const currentVersion = packageInfo.current ?? packageInfo.wanted;
    if (
      !effectiveLatest ||
      (currentVersion &&
        semver.valid(currentVersion) &&
        semver.lte(effectiveLatest, currentVersion))
    ) {
      core.debug(
        `${packageName} is quarantined - every version newer than ${currentVersion} is younger than the minimum release age`,
      );
      quarantined[packageName] = packageInfo;
      return;
    }
    if (effectiveLatest !== packageInfo.latest) {
      core.debug(
        `${packageName} latest ${packageInfo.latest} is younger than the minimum release age - comparing against ${effectiveLatest} instead`,
      );
    }
    actionable[packageName] = { ...packageInfo, latest: effectiveLatest };
  }

  let nextIndex = 0;
  /**
   * Worker which partitions packages until none are left
   */
  async function worker(): Promise<void> {
    while (nextIndex < entries.length) {
      const entry = entries[nextIndex];
      nextIndex += 1;
      await partitionPackage(entry);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker),
  );

  return { actionable, quarantined };
}

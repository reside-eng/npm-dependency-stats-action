# NPM Dependency Stats Action

> Github action for getting stats about npm dependencies

[![NPM version][npm-image]][npm-url]
[![Build Status][build-status-image]][build-status-url]
[![Code Coverage][coverage-image]][coverage-url]
[![License][license-image]][license-url]
[![semantic-release][semantic-release-icon]][semantic-release-url]
[![Code Style][code-style-image]][code-style-url]

**NOTE**: Currently only packages using yarn are supported since the `yarn outdated` command is used. There is a plan to support npm in the future.

## Features

- Loads dependency ignore settings from `.github/dependabot.yml` if it exists

## Examples

### Basic

The following workflow logs out dependency stats within Github Actions

```yaml
name: Check Outdated Dependencies

on:
  push:
    branches:
      - master

jobs:
  check:
    name: Check Dependencies
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-20.04]
        node-version: [14.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Use Node.js ${{ matrix.node-version }} on ${{ matrix.os }}
        uses: actions/setup-node@v2.1.5
        with:
          node-version: ${{ matrix.node-version }}

      - name: Check Outdated
        id: dep-stats
        uses: reside-eng/npm-dependency-stats-action@v1
        with:
          output-file: ./dep-stats.json

      - name: Message Outdated
        run: |
          echo "counts: ${{ fromJSON(steps.dep-stats.outputs.counts) }}"
          percents=${{ fromJSON(steps.dep-stats.outputs.percents) }}
          counts=${{ fromJSON(steps.dep-stats.outputs.counts) }}
          totalDeps=${{ fromJSON(steps.dep-stats.outputs.counts).total }}
          echo "counts total: $counts.total"
          echo "up to date: ${{ fromJSON(steps.dep-stats.outputs.counts).upToDate }}/$totalDeps (${{ fromJSON(steps.dep-stats.outputs.percents).upToDate }} %)"
          echo "major behind: ${{ fromJSON(steps.dep-stats.outputs.counts).major }}/$totalDeps (${{ fromJSON(steps.dep-stats.outputs.percents).major }} %)"
          echo "minor behind: ${{ fromJSON(steps.dep-stats.outputs.counts).minor }}/$totalDeps (${{ fromJSON(steps.dep-stats.outputs.percents).minor }} %)"
          echo "patch behind: ${{ fromJSON(steps.dep-stats.outputs.counts).patch }}/$totalDeps (${{ fromJSON(steps.dep-stats.outputs.percents).patch }} %)"
```

### Save File And Upload

The following workflow saves a file of stats information which is then uploaded to Google Cloud Storage. This is useful if you would like to load this data in another tool, such as [Retool](http://retool.com/).

```yaml
name: Check Outdated Dependencies

on:
  push:
    branches:
      - master

jobs:
  check:
    name: Upload Dependency Stats
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-20.04]
        node-version: [14.x]
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Use Node.js ${{ matrix.node-version }} on ${{ matrix.os }}
        uses: actions/setup-node@v2.1.5
        with:
          node-version: ${{ matrix.node-version }}

      - name: Check Outdated
        id: dep-stats
        uses: reside-eng/npm-dependency-stats-action@v1
        with:
          output-file: ./dep-stats.json

      # Setup gcloud CLI for uploading to storage in "Deploy Changed Functions" step
      - name: Set up Google Cloud SDK
        uses: google-github-actions/setup-gcloud@master
        with:
          project_id: "reside-stage"
          service_account_key: ${{ secrets.STAGE_SERVICE_ACCOUNT }}
          export_default_credentials: true

        # Deploy only Cloud Functions which have changed based on cache stored in Google Cloud Storage
      - name: Upload Dependency Stats To Cloud Storage
        run: |
          echo "Uploading results to cloud storage"
          echo ""
          bucket=reside-stage.appspot.com
          depStatsFolder=dependency-stats
          gsutil -m -q cp ./dep-stats.json gs://$bucket/$depStatsFolder/$(date +%Y-%m-%d_%H-%M-%S).json
          gsutil -m -q cp ./dep-stats.json gs://$bucket/$depStatsFolder/latest.json
          echo ""
          echo "Successfully uploaded dependency stats to Cloud Storage"
```

## Ideas

- `ignore` input to ignore dependencies (instead of loading from dependabot config)
- Setting to only check production dependencies (not include dev dependencies)
- Use `npm outdated` if yarn is not being used
- Output stats for multiple package levels in a single run

## FAQ

1. Why is the `dist` folder included in the repo?
   This is a built version of the action which is necessary to have in place for Github Actions to be able to use the action since the action's source code is written in Typescript (Actions runs Node)

[npm-image]: https://img.shields.io/npm/v/@side/npm-dependency-stats-action.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@side/npm-dependency-stats-action
[build-status-image]: https://img.shields.io/github/workflow/status/reside-eng/npm-dependency-stats-action/Publish?style=flat-square
[build-status-url]: https://github.com/reside-eng/npm-dependency-stats-saction/actions
[coverage-image]: https://img.shields.io/codecov/c/github/reside-eng/npm-dependency-stats-action.svg?style=flat-square
[coverage-url]: https://codecov.io/gh/reside-eng/npm-dependency-stats-saction
[license-image]: https://img.shields.io/npm/l/@side/npm-dependency-stats-action.svg?style=flat-square
[license-url]: https://github.com/reside-eng/npm-dependency-stats-action/blob/main/LICENSE
[code-style-image]: https://img.shields.io/badge/code%20style-airbnb-blue.svg?style=flat-square
[code-style-url]: https://github.com/airbnb/javascript
[semantic-release-icon]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square
[semantic-release-url]: https://github.com/semantic-release/semantic-release

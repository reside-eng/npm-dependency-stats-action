# NPM Dependency Stats Action

> Github action for getting stats about npm dependencies

**NOTE**: Currently only packages using yarn are supported since the `yarn outdated` command is used. There is a plan to support npm in the future.

## Features

- Loads dependency ignore settings from `.github/dependabot.yml` if it exists

## Ideas

- `ignore` input to ignore dependencies (instead of loading from dependabot config)
- Setting to only check production dependencies (not include dev dependencies)
- Use `npm outdated` if yarn is not being used
- Output stats for multiple package levels in a single run

## FAQ

1. Why is the `dist` folder included in the repo?
   This is a built version of the action which is necessary to have in place for Github Actions to be able to use the action since the action's source code is written in Typescript (Actions runs Node)

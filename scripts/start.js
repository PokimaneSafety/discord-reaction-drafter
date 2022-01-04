#!/usr/bin/env node
const ChildProcess = require('child_process');
const Commander = require('commander');
const Path = require('path');

Commander.program.allowUnknownOption(true);
Commander.program.option('-w --watch', 'Whether to hot-reload the runtime on file changes.', false);
Commander.program.parse();

const WATCH = Commander.program.getOptionValue('watch');
const PASSTHROUGH_ARGS = Commander.program.args;

const ROOT = Path.join(__dirname, '../');

const BINARY = WATCH ? 'ts-node-dev' : 'ts-node';
const ENV_PATH = '../../../.env';
const ENTRY_POINT = './src/entry.ts';
const NODE_OPTIONS = ['--trace-deprecation', '--trace-warnings', '--unhandled-rejections=strict'].join(' ');
const TS_CONFIG_OVERRIDES = { allowJs: true };
const DEBUG = false;
const CLEAR = false;

const ARGUMENTS = [
    '-O',
    JSON.stringify(TS_CONFIG_OVERRIDES),
    '--project',
    'tsconfig.json',
    DEBUG ? '--debug' : '',
    WATCH ? ['--watch', ENV_PATH] : [],
    CLEAR ? '--cls' : '',
    WATCH ? '--respawn' : '',
    WATCH ? '--exit-child' : '',
    ENTRY_POINT,
    ...PASSTHROUGH_ARGS,
]
    .flat()
    .filter(Boolean);

ChildProcess.spawn(BINARY, ARGUMENTS, {
    cwd: ROOT,
    env: { ...process.env, NODE_OPTIONS },
    stdio: 'inherit',
});

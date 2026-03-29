#!/usr/bin/env node
import { Command } from 'commander';
import { registerStatus } from './commands/status.js';
import { registerWhere } from './commands/where.js';
import { registerDash } from './commands/dash.js';
import { registerTimer } from './commands/timer.js';
import { registerToday } from './commands/today.js';
import { registerFlow } from './commands/flow.js';
import { registerInit } from './commands/init.js';
import { registerDoctor } from './commands/doctor.js';
import { registerConfigCmd } from './commands/config-cmd.js';
import { registerDaemonCmd } from './commands/daemon-cmd.js';
import { registerGo } from './commands/go.js';
import { registerHooks } from './commands/hooks.js';
import { registerReset } from './commands/reset.js';
import { registerPromptStatus } from './commands/prompt-status.js';
import { registerTmuxStatus } from './commands/tmux-status.js';
import { registerNotch } from './commands/notch.js';

const program = new Command();

program
  .name('crayfish-farm')
  .description('CLI-integrated focus tool for ADHD developers')
  .version('0.1.0');

registerStatus(program);
registerWhere(program);
registerDash(program);
registerTimer(program);
registerToday(program);
registerFlow(program);
registerInit(program);
registerDoctor(program);
registerConfigCmd(program);
registerDaemonCmd(program);
registerGo(program);
registerHooks(program);
registerReset(program);
registerPromptStatus(program);
registerTmuxStatus(program);
registerNotch(program);

await program.parseAsync(process.argv);

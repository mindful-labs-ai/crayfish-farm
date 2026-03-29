import { Command } from 'commander';
import chalk from 'chalk';

export function registerToday(program: Command): void {
  program
    .command('today')
    .description("Show today's focus stats")
    .action(async () => {
      const { getTodayStats } = await import('../../services/stats-aggregator.js');
      const stats = getTodayStats();

      const hours = Math.floor(stats.focusMinutes / 60);
      const minutes = stats.focusMinutes % 60;

      let timeStr: string;
      if (hours > 0) {
        timeStr = `${hours}h ${minutes}m`;
      } else {
        timeStr = `${minutes}m`;
      }

      console.log(chalk.bold("Today's Focus"));
      console.log(`  ${chalk.green(timeStr)} focus time`);
      console.log(`  ${chalk.cyan(String(stats.completedSessions))} completed sessions`);
    });
}

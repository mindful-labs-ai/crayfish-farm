import notifier from 'node-notifier';
import { loadConfig } from '../core/config.js';

export function sendBell(): void {
  process.stdout.write('\x07');
}

export function sendSystemNotification(title: string, message: string): void {
  notifier.notify({ title, message });
}

export function notifyTimerComplete(sessionMinutes: number): void {
  const config = loadConfig();

  if (config.notification.terminalBell) {
    sendBell();
  }

  if (config.notification.systemNotification) {
    sendSystemNotification(
      'crayfish-farm: Focus Session Complete',
      sessionMinutes > 0
        ? `You focused for ${sessionMinutes} minutes. Take a break!`
        : 'Timer finished. Take a break!'
    );
  }
}

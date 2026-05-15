import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function scheduleNudge(
  blockId: number,
  isoTime: string,
  tz: string
) {
  const cmd = [
    "openclaw cron add",
    `--name "echo-twin-block-${blockId}"`,
    `--at "${isoTime}"`,
    `--tz "${tz}"`,
    `--session isolated`,
    `--thinking off`,
    `--message "nudge blockId=${blockId}"`,
    `--delete-after-run`,
  ].join(" ");

  try {
    await execAsync(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If the flag syntax changed, surface a clear error rather than silently failing
    throw new Error(
      `openclaw cron add failed for block ${blockId}. Check \`openclaw cron --help\` for current flag names.\n${msg}`
    );
  }
}

import { execFileSync, spawn } from 'child_process'

export function which(bin: string): string | null {
  try {
    return execFileSync('which', [bin], { encoding: 'utf8' }).trim() || null
  } catch {
    return null
  }
}

export function runAsync(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { env: process.env })
    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code: number | null) => {
      if (stderr) console.warn('[paste] stderr:', stderr.trim())
      resolve(code === 0)
    })
    proc.on('error', () => resolve(false))
  })
}

/** Returns true if a non-intrusive paste tool is available (wtype or xdotool).
 *  Mutter RemoteDesktop is NOT counted — it triggers the screen-recording indicator. */
export function hasSilentPasteTool(): boolean {
  return !!(which('xdotool') || which('wtype'))
}

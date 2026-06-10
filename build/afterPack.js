import { rm, access } from 'fs/promises'
import path from 'path'
/* global console */

// GPU-related libs are safe to remove because the app runs with
// --disable-gpu and disableHardwareAcceleration(). libffmpeg.so must stay —
// even though the app has no media playback, Electron 31 lists it as a
// hard NEEDED dependency in its ELF binary so the dynamic linker requires
// it at process startup.
const UNNEEDED = [
  'libvulkan.so.1',
  'libvk_swiftshader.so',
  'vk_swiftshader_icd.json',
  'libGLESv2.so',
  'libEGL.so',
  'chrome_crashpad_handler',
]

export default async function afterPack({ appOutDir }) {
  for (const file of UNNEEDED) {
    const filePath = path.join(appOutDir, file)
    try {
      await access(filePath)
      await rm(filePath)
      console.log(`  removed: ${file}`)
    } catch {
      // not present in this build, skip
    }
  }
}

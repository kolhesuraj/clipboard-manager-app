const { rm, access } = require('fs/promises')
const path = require('path')

// These files are not needed because:
// - GPU libs: app runs with --disable-gpu and disableHardwareAcceleration()
// - libffmpeg: app has no audio/video playback
const UNNEEDED = [
  'libvulkan.so.1',
  'libvk_swiftshader.so',
  'vk_swiftshader_icd.json',
  'libGLESv2.so',
  'libEGL.so',
  'libffmpeg.so',
  'chrome_crashpad_handler',
]

exports.default = async function afterPack({ appOutDir }) {
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

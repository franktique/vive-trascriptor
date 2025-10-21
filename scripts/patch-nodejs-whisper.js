#!/usr/bin/env node

/**
 * Patch for nodejs-whisper to use absolute model paths
 * This ensures the whisper binary can find models regardless of working directory
 *
 * Issue: nodejs-whisper uses relative path `./models/modelname.bin`
 * Fix: Use absolute path to model file instead
 */

const fs = require('fs');
const path = require('path');

const whisperHelperPath = path.join(
  __dirname,
  '../node_modules/nodejs-whisper/dist/WhisperHelper.js'
);

try {
  let content = fs.readFileSync(whisperHelperPath, 'utf8');

  // Check if patch is already applied
  if (content.includes('-m "${modelPath}"')) {
    console.log('[patch-nodejs-whisper] Already patched, skipping...');
    process.exit(0);
  }

  // Apply the fix: use absolute modelPath instead of relative ./models/${modelName}
  const oldPattern = '-m "./models/${modelName}"';
  const newPattern = '-m "${modelPath}"';

  if (content.includes(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    fs.writeFileSync(whisperHelperPath, content, 'utf8');
    console.log('[patch-nodejs-whisper] ✓ Successfully patched nodejs-whisper to use absolute model paths');
    process.exit(0);
  } else {
    console.log('[patch-nodejs-whisper] Pattern not found, file may have already been patched or updated');
    process.exit(0);
  }
} catch (error) {
  console.error('[patch-nodejs-whisper] Error applying patch:', error.message);
  process.exit(1);
}

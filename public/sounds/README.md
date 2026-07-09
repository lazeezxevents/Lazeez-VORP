# Sound Effects Guide

This directory contains sound effects for the Lazeez VORP application.

## Required Sound Files

Place the following MP3 files in this directory:

### 1. `diagnostic.mp3`
- **Purpose**: Plays when the diagnostic dialog opens
- **Recommended**: Subtle "whoosh" or "rise" sound
- **Duration**: 0.3-0.5 seconds
- **Volume**: Will be played at 30% volume

### 2. `refresh.mp3`
- **Purpose**: Plays when re-running diagnostics
- **Recommended**: Quick "refresh" or "reload" sound
- **Duration**: 0.2-0.3 seconds
- **Volume**: Will be played at 30% volume

### 3. `success.mp3`
- **Purpose**: Plays when closing successful diagnostic results
- **Recommended**: Positive "ding" or "chime" sound
- **Duration**: 0.3-0.5 seconds
- **Volume**: Will be played at 30% volume

## Sound Effect Guidelines

- **Format**: MP3 (for broad browser compatibility)
- **Quality**: 128kbps or higher
- **Volume**: Normalize to -3dB to -6dB
- **Duration**: Keep under 1 second for UI sounds
- **Style**: Subtle, professional, non-intrusive

## Free Sound Resources

You can find free sound effects at:
- [Mixkit](https://mixkit.co/free-sound-effects/)
- [Freesound](https://freesound.org/)
- [Zapsplat](https://www.zapsplat.com/)
- [SoundBible](https://soundbible.com/)

## Testing

After adding sound files, test them by:
1. Opening the diagnostic dialog (should play `diagnostic.mp3`)
2. Clicking the "Re-run" button (should play `refresh.mp3`)
3. Clicking "Done" after successful check (should play `success.mp3`)

## Fallback Behavior

If sound files are missing, the application will:
- Continue to function normally
- Silently fail to play sounds (no errors shown to user)
- Log errors to browser console for debugging

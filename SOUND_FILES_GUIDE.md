# Sound Files Setup Guide

## Quick Setup

### Option 1: Use Free Sound Libraries (Recommended)

#### Mixkit (No Attribution Required)
Visit: https://mixkit.co/free-sound-effects/

**Recommended Sounds**:
1. **pop.mp3** - "Pop notification" or "UI click"
   - Search: "notification pop"
   - Duration: < 0.5s
   
2. **diagnostic.mp3** - "System startup" or "Scan complete"
   - Search: "system scan"
   - Duration: < 1s
   
3. **refresh.mp3** - "Refresh" or "Reload"
   - Search: "refresh"
   - Duration: < 0.5s
   
4. **success.mp3** - "Success" or "Complete"
   - Search: "success"
   - Duration: < 0.7s
   
5. **click.mp3** - "Click" or "Tap"
   - Search: "click"
   - Duration: < 0.3s
   
6. **delete.mp3** - "Delete" or "Remove"
   - Search: "delete"
   - Duration: < 0.5s
   
7. **archive.mp3** - "Archive" or "Store"
   - Search: "archive"
   - Duration: < 0.5s
   
8. **download.mp3** - "Download" or "Export"
   - Search: "download"
   - Duration: < 0.7s

### Option 2: Use Existing Web Sounds (Temporary)

For quick testing, you can use these data URIs in the code:

```typescript
// Temporary inline sounds (replace with actual MP3 files later)
const TEMP_SOUNDS = {
  pop: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10...",
  // ... etc
};
```

### Option 3: Generate Custom Sounds

Use online tools:
- **Bfxr**: https://www.bfxr.net/ (Game sound effects generator)
- **ChipTone**: https://sfbgames.itch.io/chiptone (Retro sound generator)
- **Audacity**: Free audio editor for custom sounds

## Installation Steps

1. Download 8 sound files (MP3 format)
2. Rename them according to the list above
3. Place all files in `public/sounds/` directory
4. Verify files are accessible at `/sounds/[filename].mp3`

## Sound Specifications

### Technical Requirements
- **Format**: MP3
- **Duration**: 0.3s - 1.0s maximum
- **Sample Rate**: 44.1kHz or 48kHz
- **Bit Rate**: 128kbps minimum
- **File Size**: < 50KB per file

### Audio Characteristics
- **Volume**: Normalized to -6dB to -3dB
- **Tone**: Subtle, non-intrusive
- **Frequency**: Mid-range (500Hz - 2kHz)
- **No harsh transients**: Smooth attack and release

## Testing

After adding files, test each sound:

```typescript
// In browser console
const audio = new Audio('/sounds/pop.mp3');
audio.volume = 0.3;
audio.play();
```

## Fallback Behavior

If sound files are missing:
- The app will continue to work normally
- Sound playback will fail silently (no errors)
- Users won't hear audio feedback
- All other functionality remains intact

## Current Usage

### Where Sounds Are Played

1. **pop.mp3**
   - Category toggle in notifications
   - General UI interactions

2. **diagnostic.mp3**
   - Diagnostic dialog opens

3. **refresh.mp3**
   - Manual notification refresh
   - Diagnostic re-run

4. **success.mp3**
   - Bulk mark as read
   - All caught up state
   - Approval actions

5. **click.mp3**
   - Notification item click
   - Navigation actions

6. **delete.mp3**
   - Bulk delete notifications
   - Remove actions

7. **archive.mp3**
   - Bulk archive
   - Archive old notifications

8. **download.mp3**
   - Export notifications
   - Download actions

## Volume Control

All sounds play at 30% volume (0.3) by default:

```typescript
audio.volume = 0.3; // 30% of maximum volume
```

Users can control this via:
- System volume settings
- Browser tab volume
- Notification preferences (enable/disable sounds)

## Browser Compatibility

### Supported Formats
- Chrome/Edge: MP3, WAV, OGG
- Firefox: MP3, WAV, OGG
- Safari: MP3, WAV, AAC

### Autoplay Policy
- Sounds only play after user interaction
- First sound may be blocked by browser
- Subsequent sounds play normally

## Troubleshooting

### Sound Not Playing
1. Check file exists at `/sounds/[filename].mp3`
2. Verify file format is MP3
3. Check browser console for errors
4. Ensure user has interacted with page first
5. Check notification preferences (sounds enabled)

### Sound Too Loud/Quiet
- Adjust volume in code: `audio.volume = 0.3` (range: 0.0 - 1.0)
- Normalize audio files to consistent levels
- Use audio editing software to adjust

### Performance Issues
- Ensure files are < 50KB each
- Use compressed MP3 format
- Avoid high sample rates (44.1kHz is sufficient)

## Future Enhancements

- [ ] Add user-configurable volume slider
- [ ] Allow users to upload custom sounds
- [ ] Add sound preview in settings
- [ ] Implement sound themes (professional, playful, minimal)
- [ ] Add haptic feedback for mobile devices

---

**Status**: Ready for sound file addition
**Priority**: Medium (app works without sounds, but enhances UX)
**Estimated Time**: 15-30 minutes to find and add all sounds

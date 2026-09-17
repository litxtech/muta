/**
 * NOX REELS — ses ayarları hook.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  loadSlotAudioSettings,
  saveSlotAudioSettings,
  startSlotMusic,
  type SlotAudioSettings,
} from '../ses/SlotSesYoneticisi';

export function useSlotAudio() {
  const [settings, setSettings] = useState<SlotAudioSettings>({
    effects: true,
    music: true,
  });

  useEffect(() => {
    void loadSlotAudioSettings().then(setSettings);
  }, []);

  const toggleEffects = useCallback(() => {
    void saveSlotAudioSettings({ effects: !settings.effects }).then(setSettings);
  }, [settings.effects]);

  const toggleMusic = useCallback(() => {
    void saveSlotAudioSettings({ music: !settings.music }).then((next) => {
      setSettings(next);
      if (next.music) void startSlotMusic();
    });
  }, [settings.music]);

  return { settings, toggleEffects, toggleMusic };
}

/**
 * Ses odası arka plan — Android Foreground Service (LiveKit önerisi).
 * iOS için UIBackgroundModes: audio app.config'te zaten var.
 *
 * @see https://github.com/livekit/client-sdk-react-native#background-processing
 */
const {
  withAndroidManifest,
  AndroidConfig,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_TYPES = 'microphone|mediaPlayback';

function ensurePermission(androidManifest, name) {
  const manifest = androidManifest.manifest;
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }
  const list = manifest['uses-permission'];
  const exists = list.some((p) => p?.$?.['android:name'] === name);
  if (!exists) {
    list.push({ $: { 'android:name': name } });
  }
}

function ensureMeta(app, name, value, isResource = false) {
  if (!app['meta-data']) app['meta-data'] = [];
  const list = app['meta-data'];
  const idx = list.findIndex((m) => m?.$?.['android:name'] === name);
  const entry = {
    $: isResource
      ? { 'android:name': name, 'android:resource': value }
      : { 'android:name': name, 'android:value': value },
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
}

function ensureService(app, name) {
  if (!app.service) app.service = [];
  const list = app.service;
  const idx = list.findIndex((s) => s?.$?.['android:name'] === name);
  const entry = {
    $: {
      'android:name': name,
      'android:foregroundServiceType': SERVICE_TYPES,
      'android:exported': 'false',
      'android:stopWithTask': 'true',
    },
  };
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      $: { ...list[idx].$, ...entry.$ },
    };
  } else {
    list.push(entry);
  }
}

function withSesOdasiForegroundService(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE_MICROPHONE');
    ensurePermission(
      manifest,
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    );
    ensurePermission(manifest, 'android.permission.WAKE_LOCK');
    ensurePermission(manifest, 'android.permission.POST_NOTIFICATIONS');

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    ensureMeta(
      app,
      'com.supersami.foregroundservice.notification_channel_name',
      'Ses odası',
    );
    ensureMeta(
      app,
      'com.supersami.foregroundservice.notification_channel_description',
      'Arka planda ses odası devam ediyor',
    );
    ensureMeta(
      app,
      'com.supersami.foregroundservice.notification_color',
      '@color/ses_odasi_fgs',
      true,
    );

    ensureService(app, 'com.supersami.foregroundservice.ForegroundService');
    ensureService(app, 'com.supersami.foregroundservice.ForegroundServiceTask');

    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const colorsPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/values/colors.xml',
      );
      const dir = path.dirname(colorsPath);
      fs.mkdirSync(dir, { recursive: true });

      const colorItem =
        '    <color name="ses_odasi_fgs">#E84091</color>\n' +
        '    <item name="blue" type="color">#E84091</item>\n' +
        '    <integer-array name="androidcolors">\n' +
        '        <item>@color/ses_odasi_fgs</item>\n' +
        '    </integer-array>\n';

      if (!fs.existsSync(colorsPath)) {
        fs.writeFileSync(
          colorsPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${colorItem}</resources>\n`,
          'utf8',
        );
      } else {
        let xml = fs.readFileSync(colorsPath, 'utf8');
        if (!xml.includes('ses_odasi_fgs')) {
          xml = xml.replace('</resources>', `${colorItem}</resources>`);
          fs.writeFileSync(colorsPath, xml, 'utf8');
        }
      }
      return cfg;
    },
  ]);

  return config;
}

module.exports = withSesOdasiForegroundService;

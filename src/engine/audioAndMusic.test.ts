import test from 'node:test';
import assert from 'node:assert/strict';
import {
  music,
  MUSIC_TRACKS,
  resolveDynamicMoodTrack,
} from './musicEngine';
import { sound } from '../utils/soundEngine';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';

test('MUSIC_TRACKS classify PEACE and WAR moods and resolveDynamicMoodTrack transitions cleanly', () => {
  assert.ok(MUSIC_TRACKS.some((t) => t.mood === 'WAR'));
  assert.ok(MUSIC_TRACKS.some((t) => t.mood === 'PEACE'));

  assert.equal(
    resolveDynamicMoodTrack({
      isAtWar: false,
      gameMode: 'EMPIRES_1440',
      screenState: 'PLAYING',
      currentTrackId: 'OSS_WESNOTH_BATTLE_EPIC',
      dynamicEnabled: true,
      manualOverrideMood: null,
    }),
    'OSS_WESNOTH_LOYALISTS'
  );

  assert.equal(
    resolveDynamicMoodTrack({
      isAtWar: false,
      gameMode: 'STANDARD_2026',
      screenState: 'PLAYING',
      currentTrackId: 'OSS_WESNOTH_BATTLE_EPIC',
      dynamicEnabled: true,
      manualOverrideMood: null,
    }),
    'OSS_WESNOTH_KINGDOM'
  );

  assert.equal(
    resolveDynamicMoodTrack({
      isAtWar: true,
      gameMode: 'EMPIRES_1440',
      screenState: 'PLAYING',
      currentTrackId: 'OSS_WESNOTH_LOYALISTS',
      dynamicEnabled: true,
      manualOverrideMood: null,
    }),
    'OSS_WESNOTH_BATTLE_EPIC'
  );

  // Preserves custom MP3 uploads and disabled dynamic mode
  assert.equal(
    resolveDynamicMoodTrack({
      isAtWar: true,
      gameMode: 'EMPIRES_1440',
      screenState: 'PLAYING',
      currentTrackId: 'CUSTOM_MP3',
      dynamicEnabled: true,
      manualOverrideMood: null,
    }),
    'CUSTOM_MP3'
  );

  assert.equal(
    resolveDynamicMoodTrack({
      isAtWar: true,
      gameMode: 'EMPIRES_1440',
      screenState: 'PLAYING',
      currentTrackId: 'OSS_WESNOTH_REVELATION',
      dynamicEnabled: false,
      manualOverrideMood: null,
    }),
    'OSS_WESNOTH_REVELATION'
  );

  // Honors per-mood manual override during current state
  assert.equal(
    resolveDynamicMoodTrack({
      isAtWar: true,
      gameMode: 'EMPIRES_1440',
      screenState: 'PLAYING',
      currentTrackId: 'OSS_WESNOTH_REVELATION',
      dynamicEnabled: true,
      manualOverrideMood: 'WAR',
    }),
    'OSS_WESNOTH_REVELATION'
  );
});

test('NationalMusicEngine syncCampaignMood shifts PEACE <-> WAR and clears manual overrides on mood flip', () => {
  music.setDynamicMoodEnabled(true);
  music.setTrack('OSS_WESNOTH_LOYALISTS', false);

  music.syncCampaignMood({
    isAtWar: false,
    gameMode: 'EMPIRES_1440',
    screenState: 'PLAYING',
  });
  assert.equal(music.activeMood, 'PEACE');
  assert.equal(music.activeTrackId, 'OSS_WESNOTH_LOYALISTS');

  // Entering war automatically swaps to battle symphony
  music.syncCampaignMood({
    isAtWar: true,
    gameMode: 'EMPIRES_1440',
    screenState: 'PLAYING',
  });
  assert.equal(music.activeMood, 'WAR');
  assert.equal(music.activeTrackId, 'OSS_WESNOTH_BATTLE_EPIC');

  // Manual track override during war sticks while war continues
  music.setTrack('OSS_WESNOTH_REVELATION', true);
  music.syncCampaignMood({
    isAtWar: true,
    gameMode: 'EMPIRES_1440',
    screenState: 'PLAYING',
  });
  assert.equal(music.activeTrackId, 'OSS_WESNOTH_REVELATION');

  // Returning to peace transitions smoothly back to 1440/2026 peace music
  music.setTrack('OSS_WESNOTH_BATTLE_EPIC', false);
  music.syncCampaignMood({
    isAtWar: false,
    gameMode: 'STANDARD_2026',
    screenState: 'PLAYING',
  });
  assert.equal(music.activeMood, 'PEACE');
  assert.equal(music.activeTrackId, 'OSS_WESNOTH_KINGDOM');
});

test('SoundEngine Faz 5.2 cues and volume clamping run safely in headless Node', () => {
  assert.equal(DEFAULT_GAME_SETTINGS.dynamicWarMusic, true);

  sound.setVolumes(85, 80);
  assert.equal(sound.enabled, true);
  assert.doesNotThrow(() => {
    sound.playWarHorn();
    sound.playBattleClash();
    sound.playSiegeFall();
    sound.playCoin();
    sound.playTreaty();
    sound.playTickCues(['COMBAT_CLASH', 'SIEGE_FALL', 'TAX_COIN'], 4);
    sound.playTickCues(['COMBAT_CLASH', 'SIEGE_FALL', 'WAR_DRUM'], 5);
  });

  sound.setVolumes(0, 80);
  assert.equal(sound.enabled, false);
  sound.setVolumes(85, 80);
  assert.equal(sound.enabled, true);
});

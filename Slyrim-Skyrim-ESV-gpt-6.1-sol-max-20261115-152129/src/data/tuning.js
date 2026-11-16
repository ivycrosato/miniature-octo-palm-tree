// the live tuning sliders (plan Part N): id, default, min, max, step. Labels are lines dev.tune.<id>.
export const TUNING = [
  ['player_damage', 1, .1, 5, .05], ['enemy_damage', 1, .1, 5, .05], ['enemy_health', 1, .1, 5, .05], ['dragon_health', 1, .1, 5, .05],
  ['dragon_breath', 1, 0, 5, .05], ['dragon_land_every', 30, 5, 120, 1], ['skill_xp', 1, 0, 10, .1], ['level_xp', 1, 0, 10, .1],
  ['regen_health', 1, 0, 10, .1], ['regen_magicka', 1, 0, 10, .1], ['regen_stamina', 1, 0, 10, .1], ['power_cost', 25, 0, 100, 1],
  ['sprint_cost', 8, 0, 40, .5], ['detect_range', 1, 0, 3, .05], ['detect_speed', 1, 0, 5, .05], ['sneak_mult', 3, 1, 10, .5],
  ['arrow_speed', 60, 20, 150, 1], ['arrow_gravity', 9.8, 0, 30, .1], ['shout_cooldown', 1, 0, 3, .05], ['push_force', 12, 0, 60, 1],
  ['carry', 300, 50, 2000, 10], ['walk', 2.2, .5, 20, .1], ['run', 4.4, .5, 20, .1], ['sprint', 7, .5, 20, .1], ['jump', 1.1, 0, 5, .05],
  ['gravity', 20, 5, 40, .5], ['time_scale', 30, 0, 600, 1], ['gold', 1, 0, 10, .1], ['prices', 1, .1, 5, .05], ['lock_spot', 1, .2, 5, .05],
  ['pickpocket', 1, 0, 5, .05], ['fall_damage_from', 6, 2, 50, .5], ['aggro_range', 25, 5, 100, 1], ['fines', 1, 0, 10, .1], ['follower_damage', 1, 0, 5, .05]
];

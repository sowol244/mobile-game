// Intended solutions, one per stage, written as scripted inputs (see bot.js).
// game.test.mjs plays every one of them and checks: stage cleared, no deaths, light shard collected.

const onGround = s => s.p.onGround;

export const SOLUTIONS = {
  '1-1': function* (b) {
    yield* b.go(5.5);
    yield* b.light(true, 15);           // bridge appears
    yield* b.go(12.2);
    yield* b.jump(12.6);                // shard over the bridge
    yield* b.go(27.5);
    yield* b.run(1, s => s.cleared);    // the halo finds the hidden door
  },
  '1-2': function* (b) {
    yield* b.go(5.5);
    yield* b.light(true, 0);            // the shadow wall melts
    yield* b.go(9.5);
    yield* b.light(false);              // dark again: the shadow floor holds
    yield* b.go(15.3);
    yield* b.jump(16.4);                // onto the shadow step
    yield* b.jump(17.6);                // shard, land below
    yield* b.go(23.6);
    yield* b.light(true, 0);
    yield* b.jump(28.5);                // through the melted wall, over the vanished floor
    yield* b.run(1, s => s.cleared);
  },
  '1-3': function* (b) {
    yield* b.light(true, 90);
    yield* b.go(8.5);
    yield* b.until(s => onGround(s) && s.p.y > 5);
    yield* b.light(false);              // drop through the first light floor
    yield* b.until(s => s.p.y > 8.3);
    yield* b.light(true);               // catch the second one
    yield* b.until(s => onGround(s) && s.p.y > 10);
    b.aim = 60;
    yield* b.go(14.3);
    yield* b.jump(17.5);
    yield* b.jump(20.5, { after: s => (s.p.y < 11 ? { lightSet: false } : null) });
    yield* b.jump(23.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null), airMx: null });
    yield* b.jump(27.5);
    yield* b.run(1, s => s.cleared);
  },
  '2-1': function* (b) {
    yield* b.go(4.5);                   // room light on
    yield* b.go(3.6);
    yield* b.jump(5.9);
    yield* b.jump(8.8);
    yield* b.jump(11.8);
    yield* b.jump(14.5);
    yield* b.go(16.6);                  // room light off: the shadow bridge forms
    yield* b.go(21.8);
    yield* b.jump(22.6);
    yield* b.go(28.5);
    yield* b.run(1, s => s.cleared);
  },
  '2-2': function* (b) {
    yield* b.go(4.3);
    yield* b.jump(5.5);                 // onto the crate
    yield* b.jump(2.8);                 // shelf: shard
    yield* b.go(1.5);                   // drop back down
    yield* b.until(onGround);
    yield* b.run(1, s => s.crates[0].x >= 10.9, 10); // push it to the very edge: thin shadow
    yield* b.wait(0.1);
    yield* b.jump(11.5);
    yield* b.go(25);
    yield* b.run(1, s => s.cleared);
  },
  '2-3': function* (b) {
    yield* b.go(2.5);                   // lamp on
    yield* b.go(3.8);
    yield* b.jump(6.4);                 // hop over the crate
    yield* b.jump(8.5);
    yield* b.go(10.3);
    yield* b.jump(12);
    yield* b.go(17.5);
    yield* b.jump(17.5);                // shard while the slope is low
    yield* b.go(12);
    yield* b.go(6.4);
    yield* b.run(-1, s => s.crates[0].x <= 3.05, 6); // crate close to the lamp: steep shadow
    yield* b.wait(0.1);
    yield* b.go(5.5);
    yield* b.jump(7.5);
    yield* b.jump(9);
    for (const x of [12, 15, 18, 21, 24]) { yield* b.go(x - 0.45); yield* b.jump(x + 0.6); } // up the shadow stairs
    yield* b.go(27.5);
    yield* b.run(1, s => s.cleared);
  },
  '3-1': function* (b) {
    yield* b.light(true, 45);
    yield* b.go(5.5);                   // red lens
    yield* b.go(7.4);
    yield* b.jump(9.9);
    yield* b.jump(12.8);
    yield* b.go(13.4);
    yield* b.jump(13.4);                // shard
    yield* b.jump(15.8);
    yield* b.go(17.5);                  // blue lens: the blue bridge holds
    yield* b.go(22.6);
    yield* b.jump(26.8, { after: s => (s.p.x + s.p.w / 2 < 25.35 ? { lightSet: false } : { lightSet: true }) });
    yield* b.go(30);
    yield* b.run(1, s => s.cleared);
  },
  '3-2': function* (b) {
    yield* b.go(3.6);
    yield* b.jump(5.6);
    yield* b.jump(8.6);
    yield* b.jump(11.0);
    yield* b.go(14.5);                  // lever: blue
    yield* b.go(15.4);
    yield* b.jump(17.6);
    yield* b.jump(20.6);
    yield* b.jump(22.8);
    yield* b.go(22.4);
    yield* b.jump(19.4);
    yield* b.go(16.5);
    yield* b.jump(16.5);                // shard
    yield* b.go(11.5);                  // lever: red
    yield* b.go(3);
    yield* b.run(-1, s => s.cleared);
  },
  '3-3': function* (b) {
    yield* b.jump(5.6);
    yield* b.jump(8.6);
    yield* b.jump(11.0);
    yield* b.go(12.6);
    yield* b.jump(15.5);                // hop over the crate, don't push it yet
    yield* b.jump(19.6);
    yield* b.jump(22.6);
    yield* b.jump(23.5);                // shard
    yield* b.go(22.4);
    yield* b.jump(19.8);
    yield* b.go(19.5);
    yield* b.jump(15.4);
    yield* b.go(15.4);
    yield* b.jump(13.5);
    yield* b.run(1, s => s.crates[0].y > 6.5, 5); // crate drops in front of the blue window
    yield* b.until(s => s.crates[0].vy === 0 && s.crates[0].y > 6.9);
    yield* b.go(17.5);
    yield* b.go(27);
    yield* b.run(1, s => s.cleared);
  },
  '4-1': function* (b) {
    yield* b.go(3.2);
    yield* b.jump(4.5);                 // stand on the sleeping statue
    yield* b.jump(7.4);                 // shard ledge
    yield* b.go(10);
    yield* b.until(onGround);
    yield* b.go(13.4);
    yield* b.light(true, 90);           // aim at your feet: the statue ahead stays asleep
    yield* b.go(24.8);
    yield* b.light(false);
    yield* b.go(25.4);
    yield* b.jump(29.5);                // over the statue
    yield* b.run(1, s => s.cleared);
  },
  '4-2': function* (b) {
    yield* b.go(6.4);
    yield* b.jump(10.5);                // over the sleeping statue
    yield* b.go(15.3);
    yield* b.light(true, 180);          // wake it and call it over
    yield* b.until(s => s.statues[1].x + s.statues[1].w / 2 >= 13.1, {}, 8);
    yield* b.light(false);              // freeze it at the wall
    yield* b.wait(0.1);
    yield* b.jump(13.4);
    yield* b.go(13.3);
    yield* b.jump(16.8);                // statue → ledge
    yield* b.go(18.6);
    yield* b.light(true, 0);            // wake the guard; it walks onto the light bridge
    yield* b.until(s => s.statues[0].x + s.statues[0].w / 2 < 21.4, {}, 8);
    yield* b.light(false);              // bridge gone, guard falls
    yield* b.until(s => s.statues[0].y > 9.6, {}, 3);
    yield* b.light(true, 80);
    yield* b.go(20.5);
    yield* b.jump(20.5);                // shard
    yield* b.go(26);
    yield* b.run(1, s => s.cleared);
  },
  '4-3': function* (b) {
    yield* b.go(3.5);                   // lights on: stairs appear, statue wakes
    yield* b.go(4.3);
    yield* b.jump(5.7);
    yield* b.jump(8.8);
    yield* b.jump(11.8);
    yield* b.go(12.5);                  // red lens
    yield* b.go(13.5);                  // lights off
    b.aim = 60;
    yield* b.go(16.3);
    yield* b.light(true);
    yield* b.jump(19.5);
    yield* b.jump(22.5, { after: s => (s.p.y < 5 ? { lightSet: false } : null) });
    yield* b.jump(25.5, { after: s => (s.p.vy > 0 ? { lightSet: true } : null) });
    yield* b.jump(28.5, { after: s => (s.p.y < 5 ? { lightSet: false } : null) });
    yield* b.jump(31.8);
    yield* b.go(34.5);
    yield* b.until(onGround);
    yield* b.go(39.2);
    yield* b.jump(40.8);                // safe block
    yield* b.go(41.4);
    yield* b.light(true, 12);           // reveal the door; the statue wakes and comes
    yield* b.until(s => s.statues[1].x < 42.3 || (s.t > 1 && !s.statues[1].awake), {}, 6);
    yield* b.light(false);
    yield* b.wait(0.1);
    yield* b.jump(45.5);
    yield* b.run(1, s => s.cleared);
  },
};

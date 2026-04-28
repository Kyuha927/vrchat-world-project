const assert = require('assert');
const GameRoom = require('./GameRoom');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test('fanAction ignores malformed actions without throwing', () => {
  const room = new GameRoom('ABCD', 'host-1', 'Host');
  room.addFan('fan-1', 'Fan');
  room.startCountdown();

  assert.doesNotThrow(() => room.fanAction('fan-1'));
  assert.strictEqual(room.fanAction('fan-1'), null);
});

test('removed fan door slots are cleared before assigning current fans', () => {
  const room = new GameRoom('ABCD', 'host-1', 'Host');
  room.addFan('fan-1', 'Fan 1');
  room.startCountdown();
  const firstDoor = room.fans.get('fan-1').assignedDoor;

  room.removeFan('fan-1');
  room.addFan('fan-2', 'Fan 2');
  room.startCountdown();

  assert.strictEqual([...room.neighborSlots.values()].includes('fan-1'), false);
  const staleEvent = room.bellRung(firstDoor.floor, firstDoor.doorIdx);
  assert.notStrictEqual(staleEvent && staleEvent.fanId, 'fan-1');
});

test('countdown returns to lobby if all fans disconnect before play starts', () => {
  const room = new GameRoom('ABCD', 'host-1', 'Host');
  room.addFan('fan-1', 'Fan');
  room.startCountdown();
  room.removeFan('fan-1');

  room.update();

  assert.strictEqual(room.state, 'lobby');
});

test('host state ignores undefined fields and clamps negative lives', () => {
  const room = new GameRoom('ABCD', 'host-1', 'Host');
  room.updateHostState({ score: 100, lives: undefined });
  room.updateHostState({ lives: -5, x: Number.POSITIVE_INFINITY });

  assert.strictEqual(room.hostState.score, 100);
  assert.strictEqual(room.hostState.lives, 0);
  assert.strictEqual(room.hostState.x, 100);
});

test('fan names are sanitized before snapshots can be rendered', () => {
  const room = new GameRoom('ABCD', 'host-1', 'Host');
  const result = room.addFan('fan-1', '<img onerror=x>');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(/[<>]/.test(result.fan.name), false);
});

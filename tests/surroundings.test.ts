import { describe, expect, it } from 'vitest';
import type { Arena, Rect, SpawnPoint } from '../src/sim/types';
import { FixedBrain, NO_SPREAD_STATS, createSimulation } from './helpers';

const { radius } = NO_SPREAD_STATS;
/** Out of the way in a corner, for tests that are only about the first robot. */
const FAR_CORNER: SpawnPoint = { x: 950, y: 550, rotation: 0 };

/** The first robot after one tick in the given setup. */
function firstRobot(spawns: [SpawnPoint, SpawnPoint], obstacles: Rect[] = []) {
  const arena: Arena = { width: 1000, height: 600, obstacles, spawns };
  const simulation = createSimulation([new FixedBrain(), new FixedBrain()], { arena });
  simulation.step();
  return simulation.robots[0];
}

describe('blocked', () => {
  const facingRight: SpawnPoint = { x: 300, y: 300, rotation: 0 };
  const touching = (x: number): Rect => ({ x, y: 250, width: 50, height: 100 });
  const blocked = (spawns: [SpawnPoint, SpawnPoint], obstacles: Rect[] = []) => firstRobot(spawns, obstacles).blocked;

  it('is false with open ground ahead', () => {
    expect(blocked([facingRight, FAR_CORNER])).toBe(false);
  });

  it('is true with an obstacle directly ahead', () => {
    expect(blocked([facingRight, FAR_CORNER], [touching(facingRight.x + radius)])).toBe(true);
  });

  it('is false while the obstacle is still more than a step away', () => {
    expect(blocked([facingRight, FAR_CORNER], [touching(facingRight.x + radius + 10)])).toBe(false);
  });

  it('is false with the obstacle beside or behind the robot', () => {
    const behind: Rect = { x: facingRight.x - radius - 50, y: 250, width: 50, height: 100 };
    const beside: Rect = { x: 250, y: facingRight.y + radius, width: 100, height: 50 };
    expect(blocked([facingRight, FAR_CORNER], [behind, beside])).toBe(false);
  });

  it('is true facing the arena wall', () => {
    expect(blocked([{ x: 1000 - radius, y: 300, rotation: 0 }, FAR_CORNER])).toBe(true);
  });

  it('is true when heading into an obstacle at an angle', () => {
    const diagonal: SpawnPoint = { ...facingRight, rotation: 30 };
    expect(blocked([diagonal, FAR_CORNER], [touching(diagonal.x + radius)])).toBe(true);
  });

  it('does not count the other robot, so a robot can keep facing an enemy it has run into', () => {
    const other: SpawnPoint = { x: facingRight.x + radius * 2, y: 300, rotation: 180 };
    expect(blocked([facingRight, other])).toBe(false);
  });
});

describe('enemy_visible', () => {
  const watcher: SpawnPoint = { x: 300, y: 300, rotation: 0 };
  const enemy: SpawnPoint = { x: 600, y: 300, rotation: 180 };
  /** A wall across the line between the robots whose lower edge is at the given y. */
  const wallDownTo = (bottom: number): Rect => ({ x: 440, y: 100, width: 20, height: bottom - 100 });
  const visible = (spawns: [SpawnPoint, SpawnPoint], obstacles: Rect[] = []) =>
    firstRobot(spawns, obstacles).sensorReading.enemyVisible;

  it('is true when nothing lies between the robots', () => {
    expect(visible([watcher, enemy])).toBe(true);
  });

  it('is true whichever way the robot faces', () => {
    for (const rotation of [0, 90, 180, -90]) expect(visible([{ ...watcher, rotation }, enemy])).toBe(true);
  });

  it('is false with an obstacle between the robots', () => {
    expect(visible([watcher, enemy], [wallDownTo(400)])).toBe(false);
  });

  it('is true with an obstacle well beside the line between them', () => {
    expect(visible([watcher, enemy], [wallDownTo(250)])).toBe(true);
  });

  it('is false while an obstacle is closer to the line than a robot is wide', () => {
    // Seeing the enemy means the robot could also drive straight at it.
    expect(visible([watcher, enemy], [wallDownTo(watcher.y - radius + 1)])).toBe(false);
    expect(visible([watcher, enemy], [wallDownTo(watcher.y - radius - 1)])).toBe(true);
  });

  it('is true for a robot that exactly touches the obstacle it looks along', () => {
    expect(visible([watcher, enemy], [wallDownTo(watcher.y - radius)])).toBe(true);
  });

  it('is false for both robots when an obstacle is between them', () => {
    const arena: Arena = { width: 1000, height: 600, obstacles: [wallDownTo(400)], spawns: [watcher, enemy] };
    const simulation = createSimulation([new FixedBrain(), new FixedBrain()], { arena });
    simulation.step();
    expect(simulation.robots.map((robot) => robot.sensorReading.enemyVisible)).toEqual([false, false]);
  });
});

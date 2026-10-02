/**
 * Which way a program turns to get around an obstacle. The robots start
 * facing each other, so two that turn the same way end up on opposite sides
 * of the obstacle and never meet: the second robot gets the other side.
 */
export type Side = 'left' | 'right';

export function otherSide(side: Side): Side {
  return side === 'left' ? 'right' : 'left';
}

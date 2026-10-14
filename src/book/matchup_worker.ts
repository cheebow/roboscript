import { type MatchupRecord, playMatchup } from './matchups';
import type { Matchup } from './types';

// Plays a table of results away from the page, so that the page keeps
// responding while a long match goes on: a message after every match with
// the records so far, and a last one when all are played.

export interface MatchupProgress {
  played: number;
  records: MatchupRecord[];
  done: boolean;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Matchup>) => void) | null;
  postMessage(message: MatchupProgress): void;
};

scope.onmessage = (event) => {
  const play = playMatchup(event.data);
  let played = 0;
  let step = play.next();
  while (!step.done) {
    played++;
    scope.postMessage({ played, records: step.value, done: false });
    step = play.next();
  }
  scope.postMessage({ played, records: step.value, done: true });
};

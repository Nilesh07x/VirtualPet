/**
 * usePetDecay
 *
 * Manages all time-based stat decay for the virtual pet:
 *   1. Auto-starts the game if the saved state shows isGameStarted=false.
 *   2. On mount, applies offline decay for any time the app was closed.
 *   3. Runs a live 30-second decay tick while the app is in the foreground.
 *   4. Re-applies offline decay whenever the app resumes from background.
 *
 * Call this hook ONCE at the top-level navigator — not per screen.
 */

import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  applyOfflineDecay,
  applyStatDecay,
  recordAppOpen,
  selectIsAlive,
  selectIsGameStarted,
  startGame,
} from '../redux/petSlice';
import { useAppDispatch, useAppSelector } from './useRedux';

export function usePetDecay(): void {
  const dispatch = useAppDispatch();
  const isGameStarted = useAppSelector(selectIsGameStarted);
  const isAlive = useAppSelector(selectIsAlive);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGameStarted) {
      // First-ever launch: start a fresh game
      dispatch(startGame({ name: 'My Pet' }));
    } else {
      // Returning launch: apply decay accumulated while the app was closed
      dispatch(applyOfflineDecay());
    }
    dispatch(recordAppOpen());
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live decay tick (every 30 s while alive & in foreground) ──────────────
  useEffect(() => {
    if (!isAlive) return;

    const id = setInterval(() => {
      dispatch(applyStatDecay());
    }, 30_000); // 30 seconds

    return () => clearInterval(id);
  }, [dispatch, isAlive]);

  // ── App background → foreground ──────────────────────────────────────────
  useEffect(() => {
    const handleChange = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        dispatch(applyOfflineDecay());
        dispatch(recordAppOpen());
      }
    };
    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
  }, [dispatch]);
}

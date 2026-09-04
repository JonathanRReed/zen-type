import { useSyncExternalStore } from 'react';
import { getSettings, subscribeSettings, type Settings } from '../utils/storage';

const getServerSnapshot = (): Settings => getSettings();

/**
 * Live view of the persisted settings. Re-renders when any island calls
 * updateSettings(), and when another tab changes them.
 */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getServerSnapshot);
}

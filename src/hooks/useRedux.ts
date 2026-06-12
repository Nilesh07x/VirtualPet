/**
 * Typed Redux Hooks
 *
 * Pre-typed versions of `useDispatch` and `useSelector` bound to this
 * app's RootState and AppDispatch. Always import from here instead of
 * importing directly from react-redux.
 *
 * @example
 *   const dispatch = useAppDispatch();
 *   const petName = useAppSelector(state => state.pet.name);
 */

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../redux/store';

/** Use throughout the app instead of plain `useDispatch` */
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();

/** Use throughout the app instead of plain `useSelector` */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

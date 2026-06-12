/**
 * Virtual Pet Game — App Root
 *
 * Bootstraps the Redux Provider with the MMKV-backed store.
 * AppNavigator manages the four-screen game flow with animated transitions.
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { AppNavigator } from './src/navigation';
import { store } from './src/redux/store';

function App(): React.JSX.Element {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        {/* Each screen manages its own StatusBar style */}
        <AppNavigator />
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;

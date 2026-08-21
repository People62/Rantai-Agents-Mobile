/**
 * Native Google Sign-In. Opens the Google account sheet, gets an ID token, and
 * exchanges it for a mobile session via the backend (/api/mobile/auth/google).
 * On success the auth state flips to signed-in and the app swaps to the main UI.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import Config from 'react-native-config';

import { useAuth } from '@/navigation/auth-context';

// Configure once at module load. `webClientId` ties the ID token's audience to
// our server OAuth client so the backend can verify it.
GoogleSignin.configure({
  webClientId: Config.GOOGLE_WEB_CLIENT_ID ?? '',
});

export function useGoogleSignIn() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promptGoogle() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data.idToken;
        if (!idToken) {
          setError('Google did not return an ID token.');
          return;
        }
        // signedIn flips → RootNavigator swaps to the app.
        await signInWithGoogle(idToken);
      }
      // cancelled / noSavedCredentialFound → stay on the login screen silently.
    } catch (e) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED) {
          // user dismissed the sheet — not an error
        } else if (e.code === statusCodes.IN_PROGRESS) {
          // a sign-in is already running
        } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setError('Google Play Services is unavailable on this device.');
        } else {
          setError('Google sign-in failed. Please try again.');
        }
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return { promptGoogle, loading, error };
}

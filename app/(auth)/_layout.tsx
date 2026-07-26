/**
 * app/(auth)/_layout.tsx
 *
 * The signup flow: A2 language -> A3 phone -> A4 code -> A5 role -> A6/O1.
 * Back is allowed within the flow; A4 offers "change number" explicitly.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

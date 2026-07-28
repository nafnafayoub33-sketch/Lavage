/**
 * app/(client)/_layout.tsx
 *
 * The client's four bottom tabs, per the menu table in docs/SCREENS.md.
 *
 * Labels without icons: there is no icon set in this project, and adding a
 * font just for four tabs would be the UI library CLAUDE.md rules out. Icons
 * can come with a real icon pass.
 *
 * The "My turn" tab carries a badge with the ticket number while a booking is
 * live — that number is the one thing a client checks over and over.
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useActiveBooking } from '@/features/booking/useActiveBooking';
import { type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function ClientLayout() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const booking = useActiveBooking();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: type.caption.fontFamily, fontSize: type.caption.fontSize },
        tabBarBadgeStyle: { backgroundColor: c.warn, color: c.onPrimary },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('queue.near') }} />
      <Tabs.Screen
        name="turn"
        options={{
          title: t('queue.myTurn'),
          tabBarBadge: booking?.ticketNo,
        }}
      />
      <Tabs.Screen name="history" options={{ title: t('account.history') }} />
      <Tabs.Screen name="account" options={{ title: t('account.title') }} />

      {/* Not tabs — pushed on top of them. */}
      <Tabs.Screen name="wash/[id]" options={{ href: null }} />
    </Tabs>
  );
}

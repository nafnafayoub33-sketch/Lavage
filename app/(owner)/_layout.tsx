/**
 * app/(owner)/_layout.tsx
 *
 * The owner's four bottom tabs, per the menu table in docs/SCREENS.md.
 * Labels without icons, same reasoning as the client tabs.
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function OwnerLayout() {
  const { t } = useTranslation();
  const { c } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: type.caption.fontFamily, fontSize: type.caption.fontSize },
      }}
    >
      <Tabs.Screen name="queue" options={{ title: t('owner.queue') }} />
      <Tabs.Screen name="wash" options={{ title: t('owner.myWash') }} />
      <Tabs.Screen name="credit" options={{ title: t('owner.balance') }} />
      <Tabs.Screen name="account" options={{ title: t('account.title') }} />

      {/* Registration and approval sit outside the tabs — an owner without a
          wash has nothing to put in them. */}
      <Tabs.Screen name="register" options={{ href: null }} />
      <Tabs.Screen name="pending" options={{ href: null }} />
    </Tabs>
  );
}

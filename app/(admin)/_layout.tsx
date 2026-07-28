/**
 * app/(admin)/_layout.tsx
 *
 * The admin's tabs. Only the two MVP screens are here — D3 and D9 join them
 * when they are built, and the rest of section 4 in docs/SCREENS.md is
 * phase 2.
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { c } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: {
          fontFamily: type.caption.fontFamily,
          fontSize: type.caption.fontSize,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('admin.dashboard') }} />
      <Tabs.Screen name="approvals" options={{ title: t('admin.approvals') }} />
    </Tabs>
  );
}

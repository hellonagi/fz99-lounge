'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  currentLocale: string;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    router.push(newPath);
  };

  // SSR時はプレースホルダーを表示してhydration mismatchを防ぐ
  if (!mounted) {
    return (
      <button className="flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white">
        <span className={`fi fi-${localeFlags[currentLocale as Locale]}`} />
        <span className="hidden sm:inline">{localeNames[currentLocale as Locale]}</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white">
          <span className={`fi fi-${localeFlags[currentLocale as Locale]}`} />
          <span className="hidden sm:inline">{localeNames[currentLocale as Locale]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className={currentLocale === locale ? 'bg-gray-700' : ''}
          >
            <span className={`fi fi-${localeFlags[locale]} mr-2`} />
            {localeNames[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

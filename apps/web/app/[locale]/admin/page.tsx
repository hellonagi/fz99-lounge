'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Extract locale from pathname and redirect to /admin/matches
    const locale = pathname.split('/')[1];
    router.replace(`/${locale}/admin/matches`);
  }, [router, pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
}

'use client';

import { logoutAction } from '@/app/actions';

export function LogoutButton({ className = 'btn ghost', label = 'Đăng xuất' }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => logoutAction()}>
      {label}
    </button>
  );
}

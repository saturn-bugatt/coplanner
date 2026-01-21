'use client';

import Image from 'next/image';

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="px-6 py-4">
        <Image
          src="/saturn-logo-black.png"
          alt="Saturn"
          width={120}
          height={40}
          className="object-contain"
          priority
        />
      </div>
    </header>
  );
}

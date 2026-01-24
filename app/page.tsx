import Image from 'next/image';

export default function Home() {
  return (
    <main className="relative min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Corner brackets frame */}
      <div className="absolute inset-4 md:inset-8 pointer-events-none">
        {/* Top-left corner */}
        <div className="absolute top-0 left-0 w-8 h-8 md:w-12 md:h-12 border-l-2 border-t-2 border-gray-300" />
        {/* Top-right corner */}
        <div className="absolute top-0 right-0 w-8 h-8 md:w-12 md:h-12 border-r-2 border-t-2 border-gray-300" />
        {/* Bottom-left corner */}
        <div className="absolute bottom-0 left-0 w-8 h-8 md:w-12 md:h-12 border-l-2 border-b-2 border-gray-300" />
        {/* Bottom-right corner */}
        <div className="absolute bottom-0 right-0 w-8 h-8 md:w-12 md:h-12 border-r-2 border-b-2 border-gray-300" />
      </div>

      {/* Main text */}
      <h1 className="font-beton text-3xl md:text-5xl lg:text-6xl text-gray-900 text-center">
        What will you <span className="text-blue-600">build?</span>
      </h1>

      {/* Saturn logo at bottom */}
      <div className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2">
        <Image
          src="/saturn.svg"
          alt="Saturn"
          width={150}
          height={50}
          className="w-32 md:w-40 lg:w-48 h-auto opacity-40"
          priority
        />
      </div>
    </main>
  );
}

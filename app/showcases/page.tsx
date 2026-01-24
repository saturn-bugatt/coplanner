import Image from 'next/image';

const showcaseData = [
  {
    image: '/pic1.jpg',
    founders: [
      { name: 'Alex Chen', x: '@alexchen' },
      { name: 'Sarah Kim', x: '@sarahkim' },
    ],
    product: 'FinanceFlow',
  },
  {
    image: '/pic2.jpg',
    founders: [
      { name: 'Marcus Johnson', x: '@marcusj' },
      { name: 'Emily Zhang', x: '@emilyzhang' },
    ],
    product: 'DataSync',
  },
  {
    image: '/pic1.jpg',
    founders: [
      { name: 'Jordan Lee', x: '@jordanlee' },
      { name: 'Taylor Swift', x: '@taylordev' },
    ],
    product: 'CloudPilot',
  },
];

export default function ShowcasesPage() {
  return (
    <main className="relative min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Corner brackets frame */}
      <div className="absolute inset-4 md:inset-8 pointer-events-none">
        <div className="absolute top-0 left-0 w-8 h-8 md:w-12 md:h-12 border-l-2 border-t-2 border-[#0202D5]" />
        <div className="absolute top-0 right-0 w-8 h-8 md:w-12 md:h-12 border-r-2 border-t-2 border-[#0202D5]" />
        <div className="absolute bottom-0 left-0 w-8 h-8 md:w-12 md:h-12 border-l-2 border-b-2 border-[#0202D5]" />
        <div className="absolute bottom-0 right-0 w-8 h-8 md:w-12 md:h-12 border-r-2 border-b-2 border-[#0202D5]" />
      </div>

      {/* Three-column showcase */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 lg:gap-16 w-full max-w-6xl px-8 md:px-12">
        {showcaseData.map((team, index) => (
          <div key={index} className="flex-1 flex flex-col items-center text-center">
            <div className="relative w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full overflow-hidden mb-6 border-4 border-[#0202D5]">
              <Image
                src={team.image}
                alt={team.product}
                fill
                className="object-cover"
              />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 text-sm md:text-base">
              {team.founders.map((founder, i) => (
                <span key={i} className="flex items-center">
                  <a
                    href={`https://x.com/${founder.x.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {founder.x}
                  </a>
                  {i < team.founders.length - 1 && <span className="text-gray-300 ml-2">&</span>}
                </span>
              ))}
            </div>

            <p className="text-gray-500 text-sm md:text-base mb-1">Founders of</p>
            <h2 className="font-beton text-xl md:text-2xl lg:text-3xl text-gray-900">
              {team.product}
            </h2>
          </div>
        ))}
      </div>

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

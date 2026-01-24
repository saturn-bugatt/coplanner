'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const showcaseData = [
  {
    image: '/IMG_20260124_151518.jpg',
    teamName: 'Alec',
    problemSpace: 'Streamlining identity verification for financial services',
    founders: [{ name: 'Alec' }],
    building: 'Saturn KYC Onboarding',
  },
  {
    image: '/IMG_4426.jpg',
    teamName: 'Jupiter',
    problemSpace: 'Making expert financial guidance accessible to everyone',
    founders: [{ name: 'Thomas' }, { name: 'Shnay' }, { name: 'Sam' }, { name: 'Jorin' }],
    building: 'Scaling Advice',
  },
  {
    image: '/IMG_20260124_152033.jpg',
    teamName: 'TaxDone',
    problemSpace: 'Simplifying tax filing with intelligent automation',
    founders: [{ name: 'Denys' }, { name: 'Himanshu' }],
    building: 'AI Tax Consultant',
  },
  {
    image: '/IMG_20260124_152340.jpg',
    teamName: 'Baker',
    problemSpace: 'Bringing predictability to complex financial systems',
    founders: [{ name: 'Haashim' }],
    building: 'Baking Determinism',
  },
  {
    image: '/IMG_4427.jpg',
    teamName: 'Nova',
    problemSpace: '24/7 automated bookkeeping for busy founders',
    founders: [{ name: 'Faran' }, { name: 'Sahid' }],
    building: 'Always On Accounting',
  },
  {
    image: '/IMG_20260124_152635.jpg',
    teamName: 'MPS Enhancer',
    problemSpace: 'AI-powered investment suitability assessments',
    founders: [{ name: 'Shivang' }],
    building: 'MPS Suitability Tool',
  },
  {
    image: '/IMG_20260124_152904.jpg',
    teamName: 'Mandala',
    problemSpace: 'Real-time global risk intelligence for investors',
    founders: [{ name: 'Akshay' }],
    building: 'Geopolitical Risk Scanning Tool',
  },
  {
    image: '/IMG_4428.jpg',
    teamName: "Phil's AI",
    problemSpace: 'Smarter financial decisions through conversational AI',
    founders: [{ name: 'Phil' }],
    building: 'Boon',
  },
  {
    image: '/IMG_4429.jpg',
    teamName: 'WalyLabs',
    problemSpace: 'Fastest path to your first 100k savings',
    founders: [{ name: 'Yile' }, { name: 'William' }, { name: 'Andy' }, { name: 'Lucas' }],
    building: 'Ladders',
  },
  {
    image: '/IMG_20260124_153540.jpg',
    teamName: 'The Mirrors',
    problemSpace: 'Unlocking trapped data from legacy CRMs',
    founders: [{ name: 'Chris' }, { name: 'Mani' }],
    building: 'Reusable CRM Scraper',
  },
  {
    image: '/IMG_4431.jpg',
    teamName: 'Clinix',
    problemSpace: 'Affordable diagnostic imaging powered by AI',
    founders: [{ name: 'Mariam' }, { name: 'Ali' }],
    building: 'AI Low Cost Imaging Diagnostics',
  },
  {
    image: '/IMG_20260124_154554.jpg',
    teamName: 'Nemo AI',
    problemSpace: 'Personalized math education for every student',
    founders: [{ name: 'Ali' }, { name: 'Irem' }],
    building: 'Math Tutor',
  },
  {
    image: '/IMG_20260124_154748.jpg',
    teamName: 'Lets Saturn',
    problemSpace: 'Auto-generating compliant investment reports',
    founders: [{ name: 'Antonio' }],
    building: 'Automated Generative Suitability Report',
  },
  {
    image: '/IMG_20260124_154918.jpg',
    teamName: 'Krish',
    problemSpace: 'Eliminating manual letter of authority processing',
    founders: [{ name: 'Krish' }],
    building: 'LOA Automation',
  },
  {
    image: '/IMG_20260124_155017.jpg',
    teamName: 'Turing',
    problemSpace: 'Level up your coding skills competitively',
    founders: [{ name: 'Avram' }],
    building: 'Competitive Programming Platform',
  },
  {
    image: '/IMG_4432.jpg',
    teamName: 'Pluto',
    problemSpace: 'Voice-first automation for authority letters',
    founders: [{ name: 'James' }, { name: 'Kenji' }, { name: 'Roze' }],
    building: 'Voice Agents for LOA',
  },
  {
    image: '/IMG_20260124_155147.jpg',
    teamName: 'ExpensesSuck',
    problemSpace: 'Autonomous expense tracking across the web',
    founders: [{ name: 'James' }],
    building: 'Browser Agents for Financial Planning',
  },
  {
    image: '/IMG_4433.jpg',
    teamName: 'Savelli',
    problemSpace: 'Training smarter compliance agents with RL',
    founders: [{ name: 'Savelli' }],
    building: 'RL Env for Compliance Agents',
  },
  {
    image: '/IMG_20260124_155545.jpg',
    teamName: 'GID',
    problemSpace: 'No-code LOA workflow builder',
    founders: [{ name: 'Francisco' }],
    building: 'Lovable of LOA',
  },
  {
    image: '/IMG_20260124_155657.jpg',
    teamName: 'SingleCore',
    problemSpace: 'From concept to visual in seconds',
    founders: [{ name: 'Facundo' }],
    building: 'Idea to Previsualization in Seconds',
  },
  {
    image: '/IMG_4434.jpg',
    teamName: 'Eurobridge',
    problemSpace: 'Connecting advisers to Eastern European markets',
    founders: [{ name: 'Giorgi' }, { name: 'Lorin' }],
    building: 'Trust First Agents for Advisers',
  },
];

export default function ShowcasesPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideState, setSlideState] = useState<'visible' | 'exit' | 'enter'>('visible');

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideState('exit'); // slide out to left
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % showcaseData.length);
        setSlideState('enter'); // prep to enter from right
        setTimeout(() => {
          setSlideState('visible'); // slide in
        }, 50);
      }, 500);
    }, 5000); // every 5 seconds

    return () => clearInterval(timer);
  }, []);

  const team = showcaseData[currentIndex];

  return (
    <main className="relative min-h-screen bg-black flex flex-col items-center justify-center px-4 overflow-hidden">
      
      {/* Grid markers near corners */}
      <div className="absolute inset-4 md:inset-8 pointer-events-none">
        <span className="absolute top-16 left-16 text-white text-xs">+</span>
        <span className="absolute top-16 right-16 text-white text-xs">+</span>
        <span className="absolute bottom-16 left-16 text-white text-xs">+</span>
        <span className="absolute bottom-16 right-16 text-white text-xs">+</span>
      </div>

      {/* Saturn logo - fixed position */}
      <div className="absolute top-8 md:top-12 left-1/2 -translate-x-1/2 z-20">
        <Image
          src="/saturn.svg"
          alt="Saturn"
          width={150}
          height={50}
          className="w-28 md:w-36 lg:w-40 h-auto opacity-60 invert"
          priority
        />
      </div>

      {/* Title - fixed position */}
      <h1 className="absolute top-24 md:top-28 left-1/2 -translate-x-1/2 z-20 text-white font-beton text-3xl md:text-4xl lg:text-5xl whitespace-nowrap">
        Building the Next Decade at..
      </h1>

      {/* Content with slide transition */}
      <div
        className={`flex flex-col items-center text-center max-w-2xl z-10 transition-all duration-500 ease-in-out mt-32 md:mt-40 ${
          slideState === 'exit' ? '-translate-x-full opacity-0' :
          slideState === 'enter' ? 'translate-x-full opacity-0' :
          'translate-x-0 opacity-100'
        }`}
      >

        {/* Team name */}
        <h2 className="font-beton font-bold text-3xl md:text-4xl text-white mb-2">
          {team.teamName}
        </h2>

        {/* Underline */}
        <div className="w-16 h-0.5 bg-white mb-4" />

        {/* Problem space */}
        <p className="font-beton text-xl md:text-2xl text-gray-300 mb-8 max-w-xl">
          {team.problemSpace}
        </p>

        {/* Image with corner markers */}
        <div className="relative mb-8">
          {/* Corner + markers */}
          <span className="absolute -top-4 -left-4 text-white text-sm">+</span>
          <span className="absolute -top-4 -right-4 text-white text-sm">+</span>
          <span className="absolute -bottom-4 -left-4 text-white text-sm">+</span>
          <span className="absolute -bottom-4 -right-4 text-white text-sm">+</span>

          {/* Image */}
          <div className="relative w-[340px] h-56 md:w-[520px] md:h-80 lg:w-[600px] lg:h-96 overflow-hidden bg-gray-100">
            <Image
              src={team.image}
              alt={team.teamName}
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* Founders/Builders label */}
        <p className="text-gray-500 text-base md:text-lg mb-2">Founders/Builders</p>

        {/* Names */}
        <p className="text-white font-semibold text-lg md:text-xl mb-2">
          {team.founders.map(f => f.name).join(', ')}
        </p>

        {/* Building */}
        <p className="text-gray-400 text-base md:text-lg">
          Building: {team.building}
        </p>
      </div>

      
      {/* Left pillar - hidden on mobile */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-0 pointer-events-none">
        <img
          src="/pillar.svg"
          alt="Decorative pillar"
          className="h-full w-auto max-w-none"
          style={{ marginLeft: '-50px' }}
        />
      </div>

      {/* Right pillar - hidden on mobile */}
      <div className="hidden md:flex fixed right-0 top-0 h-full z-0 pointer-events-none justify-end">
        <img
          src="/pillar.svg"
          alt="Decorative pillar"
          className="h-full w-auto max-w-none scale-x-[-1]"
          style={{ marginRight: '-50px' }}
        />
      </div>
    </main>
  );
}

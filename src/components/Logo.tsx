/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

// Drop your logo file at  public/logo.png  (or change this path, e.g. /logo.svg).
// Until that file exists, the built-in SVG logo below is shown automatically.
const LOGO_SRC = '/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeMap = {
    sm: { pin: 'w-10 h-10', text: 'text-xl', tag: 'text-[9px]' },
    md: { pin: 'w-16 h-16', text: 'text-2xl', tag: 'text-[11px]' },
    lg: { pin: 'w-28 h-28', text: 'text-4xl', tag: 'text-xs' },
    xl: { pin: 'w-48 h-48', text: 'text-5xl', tag: 'text-sm' }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {/* Map-pin leaf custom organic logo — replaced by your image once public/logo.png exists */}
      <div className={`relative ${currentSize.pin} transform transition-all duration-300 hover:scale-105 filter drop-shadow-md`}>
        {!imgFailed ? (
          <img
            src={LOGO_SRC}
            alt="Freshly Drop logo"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain"
          />
        ) : (
        <svg
          viewBox="0 0 100 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Outer Map Pin Shape with Kerala Green Gradient */}
          <defs>
            <linearGradient id="pinGradient" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4CAF67" />
              <stop offset="60%" stopColor="#1B7A36" />
              <stop offset="100%" stopColor="#0F5422" />
            </linearGradient>
            <linearGradient id="goldGradient" x1="50" y1="20" x2="50" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E8C35A" />
              <stop offset="100%" stopColor="#D9AB3B" />
            </linearGradient>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Pin Shadow */}
          <ellipse cx="50" cy="110" rx="18" ry="5" fill="#222222" fillOpacity="0.1" />

          {/* Main Pin */}
          <path
            d="M50 100C30 75 14 56 14 38C14 18 30.1 2 50 2C69.9 2 86 18 86 38C86 56 70 75 50 100Z"
            fill="url(#pinGradient)"
          />

          {/* Golden Circle (Core) */}
          <circle cx="50" cy="38" r="20" fill="url(#goldGradient)" />

          {/* Organic Leaf inside Golden Circle */}
          <path
            d="M50 22C41.5 28 41 42 50 54C59 42 58.5 28 50 22Z"
            fill="#1B7A36"
          />
          
          {/* Leaf Veins */}
          <path
            d="M50 24V52"
            stroke="#71C587"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M50 32C47.2 33 45.1 31.5 45.1 31.5M50 32C52.8 33 54.9 31.5 54.9 31.5M50 39C46.5 41 44.5 39 44.5 39M50 39C53.5 41 55.5 39 55.5 39M50 46C47.5 48 45.5 46.5 45.5 46.5M50 46C52.5 48 54.5 46.5 54.5 46.5"
            stroke="#71C587"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
        )}
      </div>

      {showText && (
        <div className="mt-3">
          <h1 className="brand-font text-2xl font-bold tracking-tight">
            <span className="text-brand-green-primary" style={{ color: '#1B7A36' }}>Freshly</span>{' '}
            <span className="text-brand-gold-primary" style={{ color: '#D9AB3B' }}>Drop</span>
          </h1>
          <p 
            className="font-sans font-medium uppercase tracking-wider text-brand-gold-primary mt-1 opacity-90"
            style={{ color: '#D9AB3B', fontSize: '0.65rem', letterSpacing: '0.08em' }}
          >
            Rooted in Freshness. Freshly Delivered
          </p>
        </div>
      )}
    </div>
  );
}

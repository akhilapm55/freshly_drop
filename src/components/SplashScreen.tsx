/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [dots, setDots] = useState('');

  // Subtle loading text effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Complete Splash screen after a short interval
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#F8F8F8] p-8 overflow-hidden">
      {/* Absolute Decorative Leaves in Background */}
      <div className="absolute top-[-50px] left-[-30px] w-48 h-48 rounded-full bg-[#1B7A36]/5 blur-2xl" />
      <div className="absolute bottom-[-50px] right-[-30px] w-64 h-64 rounded-full bg-[#D9AB3B]/5 blur-2xl" />

      {/* Top spacing */}
      <div />

      {/* Center Content with Staggered Entrance */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center.text-center max-w-sm"
      >
        {/* Animated Map-Pin Leaf Logo */}
        <motion.div
          animate={{
            y: [0, -12, 0],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Logo size="lg" showText={false} />
        </motion.div>

        {/* Text Area */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-6 text-center"
        >
          <h1 className="brand-font text-3xl font-bold tracking-normal">
            <span style={{ color: '#1B7A36' }}>Freshly</span>{' '}
            <span style={{ color: '#D9AB3B' }}>Drop</span>
          </h1>
          
          <p 
            className="text-base font-semibold mt-2 tracking-wide block"
            style={{ color: '#1B7A36' }}
          >
            Organic Fresh. Delivered Daily
          </p>
          
          <p 
            className="text-[11px] font-semibold uppercase tracking-wide mt-3 opacity-70 block"
            style={{ color: '#D9AB3B' }}
          >
            Rooted in Freshness. Freshly Delivered
          </p>
        </motion.div>
      </motion.div>

      {/* Animated leaf and organic progress meter */}
      <div className="flex flex-col items-center mb-10 w-full max-w-xs">
        {/* Rotating Leaf Animation */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="mb-4"
        >
          <svg
            className="w-10 h-10"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 14.53 2.94 16.84 4.5 18.6L12 11.1V2Z"
              fill="#1B7A36"
              fillOpacity="0.85"
            />
            <path
              d="M12 2V11.1L19.5 18.6C21.06 16.84 22 14.53 22 12C22 6.48 17.52 2 12 2Z"
              fill="#D9AB3B"
              fillOpacity="0.85"
            />
          </svg>
        </motion.div>

        {/* Dynamic Loading Message */}
        <div className="text-sm font-semibold text-[#222222] opacity-80 flex items-center gap-1">
          <span>Harvesting organic goodness{dots}</span>
        </div>

        {/* Static decorative tag */}
        <p className="text-[10px] text-gray-400 mt-2 font-mono">
          V1.2.0 • Kerala Farm Direct
        </p>
      </div>
    </div>
  );
}

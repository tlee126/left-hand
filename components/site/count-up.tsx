"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

interface CountUpProps {
  value: number;
  suffix?: string;
  padStart?: number;
  duration?: number;
}

export function CountUp({
  value,
  suffix = "",
  padStart = 0,
  duration = 900
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  // Animates when at least 30% of the number is visible
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    if (!isInView) return;

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing: easeOutCubic (starts fast, slows down at the end)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, value, duration, shouldReduceMotion]);

  const formatted = padStart > 0 
    ? String(displayValue).padStart(padStart, "0") 
    : String(displayValue);

  return <span ref={ref}>{formatted}{suffix}</span>;
}

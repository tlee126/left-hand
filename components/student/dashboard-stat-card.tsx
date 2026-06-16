"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  microcopy: string;
  icon: LucideIcon;
  iconColor: string;
  borderColor: string;
  bgColor: string;
}

export function DashboardStatCard({
  label,
  value,
  microcopy,
  icon: IconComp,
  iconColor,
  borderColor,
  bgColor
}: DashboardStatCardProps) {
  return (
    <div 
      className={`rounded-[22px] border ${borderColor} ${bgColor} p-4 md:p-5 shadow-[0_8px_20px_rgba(19,37,79,0.02)] hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(19,37,79,0.06)] transition-all duration-300 flex flex-col justify-between min-h-[135px]`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-[#5f6d8f] uppercase tracking-wider">
          {label}
        </span>
        <div className={`p-1.5 rounded-lg ${bgColor} border ${borderColor} shrink-0`}>
          <IconComp className={`h-4.5 w-4.5 ${iconColor}`} />
        </div>
      </div>
      
      <div className="mt-3">
        <span className="block text-2xl font-black text-[#13245d] tracking-tight">
          {value}
        </span>
        <span className="text-[10px] font-bold text-[#8091b8] leading-tight block mt-1">
          {microcopy}
        </span>
      </div>
    </div>
  );
}

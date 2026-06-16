"use client";

import React from "react";

type DoodleType =
  | "RightTriangle"
  | "EMC2"
  | "CoordinateGraph"
  | "Protractor"
  | "VennDiagram"
  | "ChemicalStructure"
  | "PaperPlane"
  | "GraduationCap"
  | "Integral"
  | "Summation"
  | "MechanicalDoodle"
  | "SineWave"
  | "LimitFormula"
  | "SimpleEquations"
  | "SparklesCluster"
  | "GridNotes";

interface Placement {
  top: string;
  side: "left" | "right";
  offset: string;
  rotate: string;
  scale: number;
  opacity: string;
  color: string;
  type: DoodleType;
}

// 1. Hero Zone (Range: 140px to 800px) - 8 doodles
const heroDoodles: Placement[] = [
  { top: "160px", side: "left", offset: "2vw", rotate: "-12deg", scale: 1.15, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "RightTriangle" },
  { top: "230px", side: "right", offset: "1vw", rotate: "18deg", scale: 0.9, opacity: "opacity-[0.22]", color: "text-[#13245d]", type: "EMC2" },
  { top: "320px", side: "left", offset: "12vw", rotate: "-8deg", scale: 1.1, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "SparklesCluster" }, // Inner margin
  { top: "400px", side: "right", offset: "14vw", rotate: "10deg", scale: 1.05, opacity: "opacity-[0.15]", color: "text-[#13245d]", type: "CoordinateGraph" }, // Inner margin
  { top: "490px", side: "left", offset: "3vw", rotate: "-18deg", scale: 0.95, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "VennDiagram" },
  { top: "580px", side: "right", offset: "2vw", rotate: "12deg", scale: 1.25, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "Protractor" },
  { top: "670px", side: "left", offset: "15vw", rotate: "-14deg", scale: 1.0, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "PaperPlane" }, // Inner margin
  { top: "750px", side: "right", offset: "4vw", rotate: "13deg", scale: 1.1, opacity: "opacity-[0.22]", color: "text-[#13245d]", type: "GraduationCap" },
];

// 2. About Zone (Range: 800px to 1300px) - 7 doodles
const aboutDoodles: Placement[] = [
  { top: "840px", side: "left", offset: "1.5vw", rotate: "-10deg", scale: 1.05, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "ChemicalStructure" },
  { top: "910px", side: "right", offset: "3vw", rotate: "14deg", scale: 0.9, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "LimitFormula" },
  { top: "980px", side: "left", offset: "14vw", rotate: "-6deg", scale: 1.15, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "GridNotes" }, // Inner margin
  { top: "1060px", side: "right", offset: "12vw", rotate: "16deg", scale: 1.0, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "SimpleEquations" }, // Inner margin
  { top: "1140px", side: "left", offset: "2.5vw", rotate: "-15deg", scale: 1.2, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "Integral" },
  { top: "1210px", side: "right", offset: "1.5vw", rotate: "8deg", scale: 1.1, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "Summation" },
  { top: "1280px", side: "left", offset: "16vw", rotate: "-12deg", scale: 0.85, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "SparklesCluster" }, // Inner margin
];

// 3. Impact/Stats Zone (Range: 1300px to 1700px) - 6 doodles
const statsDoodles: Placement[] = [
  { top: "1340px", side: "right", offset: "3vw", rotate: "11deg", scale: 1.25, opacity: "opacity-[0.22]", color: "text-[#13245d]", type: "RightTriangle" },
  { top: "1410px", side: "left", offset: "12vw", rotate: "-9deg", scale: 1.0, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "MechanicalDoodle" }, // Inner margin
  { top: "1480px", side: "right", offset: "15vw", rotate: "15deg", scale: 0.95, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "SineWave" }, // Inner margin
  { top: "1550px", side: "left", offset: "2vw", rotate: "-7deg", scale: 1.15, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "VennDiagram" },
  { top: "1620px", side: "right", offset: "2.5vw", rotate: "13deg", scale: 1.05, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "EMC2" },
  { top: "1680px", side: "left", offset: "13vw", rotate: "-13deg", scale: 1.2, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "CoordinateGraph" }, // Inner margin
];

// 4. Services Zone (Range: 1700px to 2250px) - 7 doodles
const servicesDoodles: Placement[] = [
  { top: "1740px", side: "right", offset: "14vw", rotate: "8deg", scale: 1.1, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "PaperPlane" }, // Inner margin
  { top: "1810px", side: "left", offset: "3.5vw", rotate: "-16deg", scale: 0.9, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "GraduationCap" },
  { top: "1890px", side: "right", offset: "1.5vw", rotate: "12deg", scale: 1.25, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "Protractor" },
  { top: "1970px", side: "left", offset: "15vw", rotate: "-10deg", scale: 1.0, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "ChemicalStructure" }, // Inner margin
  { top: "2050px", side: "right", offset: "4vw", rotate: "14deg", scale: 1.15, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "LimitFormula" },
  { top: "2130px", side: "left", offset: "2vw", rotate: "-18deg", scale: 0.95, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "SimpleEquations" },
  { top: "2200px", side: "right", offset: "12vw", rotate: "10deg", scale: 1.2, opacity: "opacity-[0.15]", color: "text-[#13245d]", type: "GridNotes" }, // Inner margin
];

// 5. Featured Resources Zone (Range: 2250px to 3150px) - 9 doodles
const resourcesDoodles: Placement[] = [
  { top: "2280px", side: "left", offset: "1vw", rotate: "-15deg", scale: 1.15, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "RightTriangle" },
  { top: "2380px", side: "right", offset: "3vw", rotate: "16deg", scale: 0.85, opacity: "opacity-[0.22]", color: "text-[#13245d]", type: "EMC2" },
  { top: "2480px", side: "left", offset: "13vw", rotate: "-8deg", scale: 1.05, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "CoordinateGraph" }, // Inner margin
  { top: "2580px", side: "right", offset: "15vw", rotate: "11deg", scale: 1.2, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "Protractor" }, // Inner margin
  { top: "2680px", side: "left", offset: "2.5vw", rotate: "-12deg", scale: 0.9, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "VennDiagram" },
  { top: "2780px", side: "right", offset: "1.5vw", rotate: "13deg", scale: 1.1, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "ChemicalStructure" },
  { top: "2880px", side: "left", offset: "14vw", rotate: "-14deg", scale: 1.25, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "SparklesCluster" }, // Inner margin
  { top: "2980px", side: "right", offset: "2vw", rotate: "9deg", scale: 1.05, opacity: "opacity-[0.22]", color: "text-[#13245d]", type: "GraduationCap" },
  { top: "3080px", side: "left", offset: "3vw", rotate: "-10deg", scale: 1.0, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "Integral" },
];

// 6. Process Zone (Range: 3150px to 3750px) - 7 doodles
const processDoodles: Placement[] = [
  { top: "3200px", side: "right", offset: "13vw", rotate: "15deg", scale: 1.15, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "MechanicalDoodle" }, // Inner margin
  { top: "3290px", side: "left", offset: "2vw", rotate: "-16deg", scale: 0.95, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "Summation" },
  { top: "3380px", side: "right", offset: "3.5vw", rotate: "10deg", scale: 1.2, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "SineWave" },
  { top: "3470px", side: "left", offset: "14vw", rotate: "-9deg", scale: 1.1, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "LimitFormula" }, // Inner margin
  { top: "3560px", side: "right", offset: "2.5vw", rotate: "14deg", scale: 0.9, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "SimpleEquations" },
  { top: "3650px", side: "left", offset: "1.5vw", rotate: "-12deg", scale: 1.05, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "GridNotes" },
  { top: "3720px", side: "right", offset: "12vw", rotate: "13deg", scale: 1.25, opacity: "opacity-[0.14]", color: "text-[#13245d]", type: "SparklesCluster" }, // Inner margin
];

// 7. Consultation/Form Zone (Range: 3750px to 4400px) - 9 doodles
const formDoodles: Placement[] = [
  { top: "3790px", side: "left", offset: "2.5vw", rotate: "-14deg", scale: 1.15, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "RightTriangle" },
  { top: "3870px", side: "right", offset: "1vw", rotate: "16deg", scale: 0.95, opacity: "opacity-[0.24]", color: "text-[#13245d]", type: "EMC2" },
  { top: "3950px", side: "left", offset: "15vw", rotate: "-7deg", scale: 1.25, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "CoordinateGraph" }, // Inner margin
  { top: "4030px", side: "right", offset: "14vw", rotate: "11deg", scale: 1.0, opacity: "opacity-[0.15]", color: "text-[#13245d]", type: "Protractor" }, // Inner margin
  { top: "4110px", side: "left", offset: "3vw", rotate: "-15deg", scale: 0.9, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "VennDiagram" },
  { top: "4190px", side: "right", offset: "2vw", rotate: "12deg", scale: 1.1, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "ChemicalStructure" },
  { top: "4260px", side: "left", offset: "12vw", rotate: "-10deg", scale: 1.15, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "PaperPlane" }, // Inner margin
  { top: "4320px", side: "right", offset: "3.5vw", rotate: "8deg", scale: 1.2, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "GraduationCap" },
  { top: "4380px", side: "left", offset: "1.5vw", rotate: "-18deg", scale: 1.05, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "Integral" },
];

// 8. Testimonials Zone (Range: 4400px to 4900px) - 7 doodles
const trustDoodles: Placement[] = [
  { top: "4440px", side: "right", offset: "13vw", rotate: "14deg", scale: 0.95, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "Summation" }, // Inner margin
  { top: "4510px", side: "left", offset: "2vw", rotate: "-12deg", scale: 1.1, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "MechanicalDoodle" },
  { top: "4580px", side: "right", offset: "2.5vw", rotate: "10deg", scale: 1.25, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "SineWave" },
  { top: "4650px", side: "left", offset: "14vw", rotate: "-9deg", scale: 1.0, opacity: "opacity-[0.15]", color: "text-[#7d5b46]", type: "LimitFormula" }, // Inner margin
  { top: "4720px", side: "right", offset: "1.5vw", rotate: "15deg", scale: 1.15, opacity: "opacity-[0.24]", color: "text-[#13245d]", type: "SimpleEquations" },
  { top: "4790px", side: "left", offset: "3vw", rotate: "-5deg", scale: 0.9, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "GridNotes" },
  { top: "4860px", side: "right", offset: "12vw", rotate: "13deg", scale: 1.2, opacity: "opacity-[0.15]", color: "text-[#13245d]", type: "SparklesCluster" }, // Inner margin
];

// 9. Ecosystem Zone (Range: 4900px to 5350px) - 7 doodles
const ecosystemDoodles: Placement[] = [
  { top: "4920px", side: "left", offset: "2.5vw", rotate: "-16deg", scale: 1.05, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "RightTriangle" },
  { top: "4990px", side: "right", offset: "3vw", rotate: "11deg", scale: 1.2, opacity: "opacity-[0.18]", color: "text-[#13245d]", type: "EMC2" },
  { top: "5060px", side: "left", offset: "1vw", rotate: "-15deg", scale: 0.95, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "CoordinateGraph" },
  { top: "5130px", side: "right", offset: "14vw", rotate: "13deg", scale: 1.15, opacity: "opacity-[0.16]", color: "text-[#13245d]", type: "Protractor" }, // Inner margin
  { top: "5200px", side: "left", offset: "15vw", rotate: "-14deg", scale: 1.0, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "VennDiagram" }, // Inner margin
  { top: "5270px", side: "right", offset: "2vw", rotate: "9deg", scale: 1.25, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "ChemicalStructure" },
  { top: "5330px", side: "left", offset: "3vw", rotate: "-8deg", scale: 1.1, opacity: "opacity-[0.22]", color: "text-[#7d5b46]", type: "PaperPlane" },
];

// 10. Footer Zone (Range: 5350px to 5700px) - 6 doodles
const footerDoodles: Placement[] = [
  { top: "5390px", side: "right", offset: "15vw", rotate: "12deg", scale: 0.9, opacity: "opacity-[0.15]", color: "text-[#13245d]", type: "GraduationCap" }, // Inner margin
  { top: "5450px", side: "left", offset: "2vw", rotate: "-13deg", scale: 1.15, opacity: "opacity-[0.24]", color: "text-[#7d5b46]", type: "Integral" },
  { top: "5510px", side: "right", offset: "1vw", rotate: "15deg", scale: 1.05, opacity: "opacity-[0.20]", color: "text-[#13245d]", type: "Summation" },
  { top: "5570px", side: "left", offset: "13vw", rotate: "-10deg", scale: 1.2, opacity: "opacity-[0.14]", color: "text-[#7d5b46]", type: "MechanicalDoodle" }, // Inner margin
  { top: "5630px", side: "right", offset: "2.5vw", rotate: "14deg", scale: 0.95, opacity: "opacity-[0.22]", color: "text-[#13245d]", type: "SineWave" },
  { top: "5690px", side: "left", offset: "3.5vw", rotate: "-6deg", scale: 1.1, opacity: "opacity-[0.20]", color: "text-[#7d5b46]", type: "LimitFormula" },
];

// Combine all 73 placements deterministically (safe from hydration mismatches)
const placements: Placement[] = [
  ...heroDoodles,
  ...aboutDoodles,
  ...statsDoodles,
  ...servicesDoodles,
  ...resourcesDoodles,
  ...processDoodles,
  ...formDoodles,
  ...trustDoodles,
  ...ecosystemDoodles,
  ...footerDoodles,
];

function renderDoodle(type: DoodleType) {
  switch (type) {
    case "RightTriangle":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 30 30 L 30 150 L 190 150 Z" />
          <path d="M 30 136 H 44 V 150" strokeWidth="1.6" />
          <path d="M 20 85 C 18 78, 14 82, 18 88 Q 20 90 22 82" strokeWidth="1.6" />
          <path d="M 100 165 Q 105 160, 100 168" strokeWidth="1.6" />
          <path d="M 125 55 Q 118 51, 121 61" strokeWidth="1.6" />
          <path d="M 132 58 H 142 M 132 64 H 142" strokeWidth="1.6" />
          <path d="M 148 68 L 152 73 L 157 45 H 205" strokeWidth="1.8" />
          <path d="M 166 61 C 164 56, 161 58, 163 64 M 171 52 Q 175 48, 175 52" strokeWidth="1.6" />
          <path d="M 180 58 H 188 M 184 54 V 62" strokeWidth="1.6" />
          <path d="M 194 52 V 64 H 199 Q 202 64, 202 59 M 205 47 Q 209 43, 209 47" strokeWidth="1.6" />
        </svg>
      );

    case "EMC2":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 40 50 H 20 V 90 H 40 M 20 70 H 35" />
          <path d="M 48 65 H 62 M 48 75 H 62" />
          <path d="M 72 80 V 90 M 72 82 Q 77 75, 82 82 Q 87 75, 92 82 V 90" />
          <path d="M 112 78 Q 102 76, 102 85 Q 102 94, 112 92" />
          <path d="M 116 62 Q 120 58, 120 62 C 120 65, 116 68, 116 70 H 122" strokeWidth="1.6" />
          <path d="M 40 145 C 38 140, 35 142, 37 148" strokeWidth="1.6" />
          <path d="M 52 145 H 60 M 56 141 V 149" strokeWidth="1.6" />
          <path d="M 68 138 V 150 H 73 Q 76 150, 76 145" strokeWidth="1.6" />
          <path d="M 84 142 H 94 M 84 148 H 94" strokeWidth="1.6" />
          <path d="M 108 140 Q 102 138, 105 147" strokeWidth="1.6" />
        </svg>
      );

    case "CoordinateGraph":
      return (
        <svg viewBox="0 0 240 240" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 40 30 L 40 180 L 190 180" />
          <path d="M 36 38 L 40 30 L 44 38" />
          <path d="M 182 176 L 190 180 L 182 184" />
          <path d="M 45 60 Q 80 170, 170 175" strokeWidth="2.5" />
          <path d="M 110 125 V 180" strokeDasharray="3 4" strokeWidth="1.5" />
          <path d="M 40 125 H 110" strokeDasharray="3 4" strokeWidth="1.5" />
          <circle cx="110" cy="125" r="3" fill="currentColor" />
          <path d="M 196 172 L 204 180 M 204 172 L 196 180" strokeWidth="1.6" />
          <path d="M 32 15 C 32 11, 38 11, 36 21" strokeWidth="1.6" />
        </svg>
      );

    case "Protractor":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 30 130 A 80 80 0 0 1 190 130 H 30 Z" />
          <path d="M 85 130 A 25 25 0 0 1 135 130 H 85 Z" />
          <line x1="110" y1="130" x2="110" y2="122" strokeWidth="1.6" />
          <line x1="110" y1="50" x2="110" y2="58" strokeWidth="1.6" />
          <line x1="53" y1="74" x2="60" y2="81" strokeWidth="1.6" />
          <line x1="167" y1="74" x2="160" y2="81" strokeWidth="1.6" />
        </svg>
      );

    case "VennDiagram":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 80 90 C 80 60, 120 60, 120 90 C 120 120, 80 120, 80 90 Z" />
          <path d="M 120 90 C 120 60, 160 60, 160 90 C 160 120, 120 120, 120 90 Z" />
          <path d="M 60 60 L 64 72 H 56 M 58 68 H 62" strokeWidth="1.6" />
          <path d="M 180 60 V 72 H 185 Q 189 72, 189 66" strokeWidth="1.6" />
          <path d="M 85 150 L 90 162 H 82" strokeWidth="1.6" />
          <path d="M 98 158 C 98 150, 108 150, 108 158" strokeWidth="1.8" />
          <path d="M 115 150 V 162 H 120 Q 124 162, 124 156" strokeWidth="1.6" />
        </svg>
      );

    case "ChemicalStructure":
      return (
        <svg viewBox="0 0 240 240" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 70 60 L 115 35 L 160 60 L 160 110 L 115 135 L 70 110 Z" />
          <path d="M 82 67 L 115 48 M 148 67 L 148 103 M 82 103 L 115 122" strokeWidth="1.5" />
          <path d="M 160 60 L 185 45 M 160 110 L 185 125" />
          <path d="M 192 38 Q 186 38, 186 46 T 194 48 M 198 38 V 48 H 202" strokeWidth="1.6" />
        </svg>
      );

    case "PaperPlane":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 30 90 L 170 30 L 80 120 Z M 80 120 L 100 160 L 115 130" />
          <path d="M 20 100 Q -10 120 15 140 Q 40 160 70 145" strokeWidth="1.5" strokeDasharray="3 4" />
        </svg>
      );

    case "GraduationCap":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 40 60 L 120 30 L 200 60 L 120 90 Z" />
          <path d="M 75 73 V 95 Q 120 110, 165 95 V 73" />
          <path d="M 120 60 L 70 65 V 100" />
          <circle cx="70" cy="100" r="2.5" fill="currentColor" />
          <path d="M 210 40 L 213 46 L 220 46 L 215 50 L 217 56 L 210 52 L 203 56 L 205 50 L 200 46 L 207 46 Z" fill="currentColor" stroke="none" />
        </svg>
      );

    case "Integral":
      return (
        <svg viewBox="0 0 240 220" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 60 30 C 45 30, 45 50, 45 90 C 45 130, 45 150, 30 150" />
          <path d="M 42 142 H 48" strokeWidth="1.6" />
          <path d="M 56 34 H 62" strokeWidth="1.6" />
          <path d="M 80 85 H 90 M 85 75 V 105" strokeWidth="1.6" />
          <path d="M 98 85 L 106 97 M 106 85 L 98 97" strokeWidth="1.6" />
          <path d="M 118 88 V 100 M 128 85 L 136 97" strokeWidth="1.6" />
        </svg>
      );

    case "Summation":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 50 40 H 100 L 75 75 L 100 110 H 50" />
          <path d="M 55 125 H 65 M 60 125 V 135" strokeWidth="1.6" />
          <path d="M 70 20 V 30" strokeWidth="1.6" />
          <path d="M 115 70 L 125 85 M 128 82 V 90" strokeWidth="1.6" />
        </svg>
      );

    case "MechanicalDoodle":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 30 80 H 60 Q 70 60, 80 80 Q 90 100, 100 80 Q 110 60, 120 80 Q 130 100, 140 80 H 170" />
          <path d="M 170 60 H 210 V 100 H 170 Z" />
          <path d="M 183 75 Q 187 70, 191 75" strokeWidth="1.6" />
          <path d="M 210 80 H 240" />
          <path d="M 233 76 L 240 80 L 233 84" />
        </svg>
      );

    case "SineWave":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 20 80 H 220 M 120 20 V 140" />
          <path d="M 30 80 Q 75 20, 120 80 T 210 80" strokeWidth="2.5" />
          <path d="M 150 40 L 155 52 M 165 42 H 175" strokeWidth="1.6" />
        </svg>
      );

    case "LimitFormula":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 40 80 V 100 M 46 88 Q 50 80, 56 88 V 100 M 62 80 V 100" />
          <path d="M 38 112 H 58 M 53 108 L 58 112 L 53 116" strokeWidth="1.5" />
          <path d="M 30 112 L 35 120 M 64 112 A 4 4 0 1 1 64 111" strokeWidth="1.6" />
          <path d="M 150 85 H 165 M 150 95 H 165" strokeWidth="1.6" />
          <path d="M 180 75 L 185 70 V 100" strokeWidth="1.8" />
        </svg>
      );

    case "SimpleEquations":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 30 65 L 36 85 M 45 70 H 55 M 45 76 H 55" strokeWidth="1.6" />
          <path d="M 65 55 Q 60 52, 60 60 Q 60 65, 70 65" strokeWidth="1.6" />
          <path d="M 75 78 H 95" strokeWidth="1.6" />
          <path d="M 82 82 V 100" strokeWidth="1.6" strokeLinecap="square" />
          <path d="M 30 155 L 45 130 H 15 Z" />
          <path d="M 52 140 H 62 M 52 146 H 62" strokeWidth="1.6" />
          <path d="M 72 135 V 150 H 77 Q 80 150, 80 145 M 83 125 Q 87 121, 87 125" strokeWidth="1.6" />
          <path d="M 92 143 H 102" strokeWidth="1.6" />
          <path d="M 112 135 L 108 143 H 117 V 150" strokeWidth="1.6" />
          <path d="M 125 145 Q 120 142, 122 148 M 140 142 Q 133 140, 136 148" strokeWidth="1.6" />
        </svg>
      );

    case "SparklesCluster":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 35 35 Q 35 45, 45 45 Q 35 45, 35 55 Q 35 45, 25 45 Q 35 45, 35 35 Z" fill="currentColor" stroke="none" />
          <path d="M 75 25 Q 75 30, 80 30 Q 75 30, 75 35 Q 75 30, 70 30 Q 75 30, 75 25 Z" fill="currentColor" stroke="none" />
          <path d="M 40 100 Q 80 130, 120 90" strokeDasharray="3 4" strokeWidth="1.8" />
          <path d="M 109 90 H 120 V 101" strokeWidth="1.6" />
          <path d="M 145 130 L 152 137 L 170 120" strokeWidth="2.4" />
          <path d="M 185 150 L 192 157 L 210 140" strokeWidth="2.4" />
          <path d="M 195 50 L 195 75 M 195 85 A 1.5 1.5 0 1 1 195 84.9" strokeWidth="2.0" fill="currentColor" />
          <path d="M 210 60 L 210 80 M 210 90 A 1.5 1.5 0 1 1 210 89.9" strokeWidth="2.0" fill="currentColor" />
        </svg>
      );

    case "GridNotes":
      return (
        <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <path d="M 20 20 H 160 V 160 H 20 Z" />
          <path d="M 20 65 H 160 M 20 110 H 160" />
          <path d="M 65 20 V 160 M 110 20 V 160" />
          <path d="M 30 145 Q 65 140, 110 65 T 150 35" strokeWidth="2.5" />
          <path d="M 40 45 L 45 40 M 130 135 L 140 125" strokeWidth="1.6" />
          <path d="M 180 80 H 200 M 180 90 H 200" strokeWidth="1.6" />
          <path d="M 215 75 Q 210 75, 210 85 Q 210 95, 215 95" strokeWidth="1.6" />
        </svg>
      );

    default:
      return null;
  }
}

export function DecorativeDoodles() {
  return (
    <div className="pointer-events-none select-none absolute inset-0 -z-20 overflow-hidden">
      {placements.map((item, index) => {
        const sideStyle = item.side === "left" ? { left: item.offset } : { right: item.offset };
        
        return (
          <div
            key={index}
            className={`absolute w-[210px] h-[210px] hidden lg:block transition-all duration-300 hover:scale-110 ${item.color} ${item.opacity}`}
            style={{
              top: item.top,
              ...sideStyle,
              transform: `rotate(${item.rotate}) scale(${item.scale})`,
              transformOrigin: "center center",
            }}
          >
            {renderDoodle(item.type)}
          </div>
        );
      })}
    </div>
  );
}

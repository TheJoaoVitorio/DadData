import React from 'react';
import { DatabaseType } from '@shared/types/database';

interface DatabaseIconProps {
  type: DatabaseType | string;
  className?: string;
  size?: number;
}

export const DatabaseIcon: React.FC<DatabaseIconProps> = ({ type, className = 'w-6 h-6', size }) => {
  const style = size ? { width: size, height: size } : undefined;

  switch (type.toLowerCase()) {
    // 1. PostgreSQL (Official Slonik Elephant)
    case 'postgres':
    case 'postgresql':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#F0F4F8" />
          <path
            d="M64 24C44 24 34 38 34 54C34 76 49 92 64 98C64 98 64 104 60 106C56 108 48 106 48 106L44 114C44 114 56 117 66 112C74 108 74 98 74 98C89 92 94 76 94 54C94 38 84 24 64 24Z"
            fill="#336791"
          />
          <path
            d="M50 52C53.3137 52 56 49.3137 56 46C56 42.6863 53.3137 40 50 40C46.6863 40 44 42.6863 44 46C44 49.3137 46.6863 52 50 52Z"
            fill="white"
          />
          <path
            d="M78 52C81.3137 52 84 49.3137 84 46C84 42.6863 81.3137 40 78 40C74.6863 40 72 42.6863 72 46C72 49.3137 74.6863 52 78 52Z"
            fill="white"
          />
          <path
            d="M60 62C56 68 49 71 49 71C49 71 58 76 64 71C70 76 79 71 79 71C79 71 72 68 68 62"
            stroke="#20405C"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    // 2. MySQL (Official Dolphin / Wave)
    case 'mysql':
    case 'mariadb':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#F0F9FF" />
          <path
            d="M40 82C35 70 38 52 48 42C56 34 68 30 78 32C88 34 94 42 94 50C94 62 82 72 74 76C68 79 60 82 54 84L40 82Z"
            fill="#00758F"
          />
          <path
            d="M78 32C86 26 96 28 102 34C106 38 106 46 102 52L94 50C94 42 88 34 78 32Z"
            fill="#F29111"
          />
          <path
            d="M32 94C42 88 56 86 68 88C78 90 92 98 100 94L104 102C92 108 76 102 64 98C52 94 38 98 32 94Z"
            fill="#00758F"
          />
          <circle cx="58" cy="46" r="3" fill="white" />
        </svg>
      );

    // 3. SQLite (Official Feather)
    case 'sqlite':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#F0FDF4" />
          <path
            d="M30 94C30 94 48 86 58 72C68 58 72 40 98 28C98 28 88 50 78 64C68 78 52 90 30 94Z"
            fill="#0F80C1"
          />
          <path
            d="M98 28C98 28 92 42 84 52C76 62 62 72 42 78C56 70 66 60 74 48C82 36 86 28 98 28Z"
            fill="#7DD3FC"
          />
          <circle cx="48" cy="80" r="4" fill="#003B57" />
        </svg>
      );

    // 4. Microsoft SQL Server
    case 'mssql':
    case 'sqlserver':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#FEF2F2" />
          {/* Three database cylinders */}
          <g transform="translate(24, 24)">
            {/* Top cylinder */}
            <path
              d="M40 8C62 8 80 14 80 20C80 26 62 32 40 32C18 32 0 26 0 20C0 14 18 8 40 8Z"
              fill="#E11D48"
            />
            <path
              d="M80 20V36C80 42 62 48 40 48C18 48 0 42 0 36V20C0 26 18 32 40 32C62 32 80 26 80 20Z"
              fill="#BE123C"
            />
            {/* Middle cylinder */}
            <path
              d="M80 44V56C80 62 62 68 40 68C18 68 0 62 0 56V44C0 50 18 56 40 56C62 56 80 50 80 44Z"
              fill="#9F1239"
            />
            {/* Bottom cylinder */}
            <path
              d="M80 64V76C80 82 62 88 40 88C18 88 0 82 0 76V64C0 70 18 76 40 76C62 76 80 70 80 64Z"
              fill="#881337"
            />
          </g>
        </svg>
      );

    // 5. MongoDB (Official Leaf)
    case 'mongodb':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#F0FDF4" />
          <path
            d="M64 20C64 20 44 46 44 68C44 86 54 100 64 108C74 100 84 86 84 68C84 46 64 20 64 20Z"
            fill="#13AA52"
          />
          <path
            d="M64 20C64 20 64 46 64 108C74 100 84 86 84 68C84 46 64 20 64 20Z"
            fill="#116149"
          />
          <path
            d="M64 20V108"
            stroke="#FFEEDB"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    // 6. Firebird (.FDB)
    case 'firebird':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#FFF7ED" />
          <path
            d="M64 20C52 38 46 54 48 70C50 86 64 100 64 108C64 108 52 96 52 84C52 74 58 66 62 60C62 60 60 76 72 82C84 88 88 74 88 64C88 48 78 34 64 20Z"
            fill="#EA580C"
          />
          <path
            d="M64 36C56 48 56 60 62 68C68 76 76 74 76 68C76 56 70 46 64 36Z"
            fill="#FBBF24"
          />
        </svg>
      );

    // 7. dBase / FoxPro (.DBF)
    case 'dbf':
    case 'foxpro':
    case 'dbase':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#FFFBEB" />
          {/* Orange/Amber Folder & Table Badge */}
          <path
            d="M28 36C28 32 32 28 36 28H52L60 36H92C96 36 100 40 100 44V92C100 96 96 100 92 100H36C32 100 28 96 28 92V36Z"
            fill="#F59E0B"
          />
          {/* Grid lines inside folder */}
          <rect x="38" y="48" width="52" height="42" rx="6" fill="#FFFFFF" />
          <path
            d="M38 60H90 M38 74H90 M56 48V90 M74 48V90"
            stroke="#FDE68A"
            strokeWidth="2"
          />
          {/* DBF Badge */}
          <rect x="62" y="74" width="34" height="18" rx="6" fill="#D97706" />
          <text x="66" y="87" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
            DBF
          </text>
        </svg>
      );

    // 8. Paradox (.DB)
    case 'paradox':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#EEF2FF" />
          {/* Classic Borland Blue & Crimson Disc */}
          <circle cx="64" cy="64" r="38" fill="#4338CA" />
          <path
            d="M52 42H70C78 42 84 48 84 56C84 64 78 70 70 70H62V86H52V42Z"
            fill="#FFFFFF"
          />
          <rect x="62" y="50" width="10" height="12" rx="2" fill="#4338CA" />
          {/* Red Accent Badge */}
          <circle cx="86" cy="42" r="10" fill="#EF4444" />
          <text x="82" y="46" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
            7
          </text>
        </svg>
      );

    // 9. Microsoft Access (.MDB / .ACCDB)
    case 'access':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#FFF1F2" />
          {/* Access Red Key & Cylinder */}
          <rect x="30" y="30" width="68" height="68" rx="16" fill="#A21CAF" />
          <path
            d="M54 44H74L84 84H68L64 70H50L46 84H34L54 44Z"
            fill="#FFFFFF"
            opacity="0.95"
          />
          <path d="M54 62H60L57 52L54 62Z" fill="#A21CAF" />
          {/* Keyhole accent */}
          <circle cx="82" cy="76" r="6" fill="#F43F5E" />
        </svg>
      );

    // 10. HFSQL / PC SOFT WinDev (.FIC)
    case 'hfsql':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#FEFCE8" />
          {/* PC SOFT Yellow & Charcoal Cube */}
          <path
            d="M64 26L96 44V84L64 102L32 84V44L64 26Z"
            fill="#1E293B"
          />
          <path
            d="M64 26L96 44L64 62L32 44L64 26Z"
            fill="#FACC15"
          />
          <path
            d="M64 62V102L32 84V44L64 62Z"
            fill="#CA8A04"
          />
          <path
            d="M64 62L96 44V84L64 102V62Z"
            fill="#A16207"
          />
          <text x="44" y="78" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">
            HF
          </text>
        </svg>
      );

    // 11. NexusDB (.NX1)
    case 'nexusdb':
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#F0F9FF" />
          {/* Nexus Interconnected Nodes */}
          <circle cx="64" cy="40" r="12" fill="#0284C7" />
          <circle cx="42" cy="82" r="12" fill="#0284C7" />
          <circle cx="86" cy="82" r="12" fill="#0284C7" />
          <line x1="64" y1="40" x2="42" y2="82" stroke="#38BDF8" strokeWidth="6" />
          <line x1="64" y1="40" x2="86" y2="82" stroke="#38BDF8" strokeWidth="6" />
          <line x1="42" y1="82" x2="86" y2="82" stroke="#38BDF8" strokeWidth="6" />
          <circle cx="64" cy="64" r="7" fill="#BAE6FD" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 128 128" className={className} style={style} fill="none">
          <rect width="128" height="128" rx="28" fill="#F8FAFC" />
          <circle cx="64" cy="64" r="32" stroke="#64748B" strokeWidth="6" />
          <path d="M64 48V64L76 76" stroke="#64748B" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );
  }
};

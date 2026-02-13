'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Team {
  teamIndex: number;
  teamNumber: number;
  color: string;
  colorHex: string;
}

interface MachineColorGuideProps {
  teams: Team[];
  userTeamIndex: number | null;
}

const MACHINES = [
  { id: 'bf', label: 'BF', colorImage: '/rules/colors_example_bf.webp', decalImage: '/rules/decal_example_bf.webp', colShift: 0 },
  { id: 'fs', label: 'FS', colorImage: '/rules/colors_example_fs.webp', decalImage: '/rules/decal_example_fs.webp', colShift: 1 },
  { id: 'gf', label: 'GF', colorImage: '/rules/colors_example_gf.webp', decalImage: '/rules/decal_example_gf.webp', colShift: 2 },
  { id: 'wg', label: 'WG', colorImage: '/rules/colors_example_wg.webp', decalImage: '/rules/decal_example_wg.webp', colShift: 3 },
] as const;

// Map team color name to F-ZERO 99 color grid position (1-based)
// F-ZERO 99 machine color grid:
// Row 0:  1=Blue,   2=Green,  3=Yellow,  4=Pink
// Row 1:  5=Red,    6=Purple, 7=Rose,    8=Cyan
// Row 2:  9=Lime,  10=Orange, 11=Navy,  12=Magenta
// Row 3: 13=Teal,  14=White,  15=Black,  16=Gold
const COLOR_TO_GRID_POSITION: Record<string, number> = {
  Blue: 1, Green: 2, Yellow: 3, Pink: 4,
  Red: 5, Purple: 6, Rose: 7, Cyan: 8,
  Lime: 9, Orange: 10, Navy: 11, Magenta: 12,
  Teal: 13, White: 14, Black: 15, Gold: 16,
};

function getGridPosition(colorName: string): { row: number; col: number } | null {
  const gridPos = COLOR_TO_GRID_POSITION[colorName];
  if (!gridPos) return null;
  const index = gridPos - 1;
  return { row: Math.floor(index / GRID_COLS), col: index % GRID_COLS };
}

function getGridPositionForMachine(colorName: string, colShift: number): { row: number; col: number } | null {
  const basePos = getGridPosition(colorName);
  if (!basePos) return null;
  if (basePos.row === 0) {
    const newCol = (basePos.col + colShift) % GRID_COLS;
    return { row: basePos.row, col: newCol };
  }
  return basePos;
}

// Grid area boundaries as percentages of the image
const GRID_TOP = 30; // % from top where first row of machines starts
const GRID_LEFT = 10; // % from left where first column starts
const GRID_BOTTOM = 79; // % from top where last row ends
const GRID_RIGHT = 90; // % from left where last column ends
const GRID_ROWS = 4;
const GRID_COLS = 4;

const INSET = 1.5; // % inset to avoid overlapping adjacent cells

function getCellBounds(row: number, col: number) {
  const cellWidth = (GRID_RIGHT - GRID_LEFT) / GRID_COLS;
  const cellHeight = (GRID_BOTTOM - GRID_TOP) / GRID_ROWS;
  return {
    top: `${GRID_TOP + cellHeight * row + INSET}%`,
    left: `${GRID_LEFT + cellWidth * col + INSET}%`,
    width: `${cellWidth - INSET * 2}%`,
    height: `${cellHeight - INSET * 2}%`,
  };
}

// Use black text on light-colored teams for contrast
const LIGHT_COLORS = new Set(['Yellow', 'Lime', 'White', 'Gold']);
function getTextColor(colorName: string): string {
  return LIGHT_COLORS.has(colorName) ? '#000' : '#fff';
}

export function MachineColorGuide({
  teams,
  userTeamIndex,
}: MachineColorGuideProps) {
  const t = useTranslations('teamClassic');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('teamSetup')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Machine Color Selection */}
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-gray-300">{t('teamSetupColorTitle')}</h3>
          <p className="text-sm text-gray-400">
            {t('teamSetupColorDescription')}
          </p>
        </div>
        <Tabs defaultValue="bf" className="border border-gray-700 rounded-md overflow-hidden">
          <TabsList>
            {MACHINES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {MACHINES.map((machine) => (
            <TabsContent key={machine.id} value={machine.id} className="p-3 sm:p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="relative aspect-[10/9] w-full">
                  <Image
                    src={machine.colorImage}
                    alt={`${machine.label} Color Selection`}
                    fill
                    className="object-contain rounded"
                  />
                  {teams.map((team) => {
                    const pos = getGridPositionForMachine(team.color, machine.colShift);
                    if (!pos) return null;

                    const isUserTeam = team.teamIndex === userTeamIndex;
                    const bounds = getCellBounds(pos.row, pos.col);
                    const letter = String.fromCharCode(65 + team.teamIndex);
                    const textColor = getTextColor(team.color);

                    return (
                      <div
                        key={team.teamIndex}
                        className={`absolute rounded-sm ${
                          isUserTeam ? 'z-20' : 'z-10'
                        }`}
                        style={{
                          ...bounds,
                          backgroundColor: `${team.colorHex}20`,
                          border: `${isUserTeam ? 3 : 2}px solid ${team.colorHex}`,
                          animation: isUserTeam
                            ? 'cursor-select-highlight 1.5s ease-in-out infinite'
                            : 'cursor-select-pulse 2s ease-in-out infinite',
                          '--cursor-glow-color': team.colorHex,
                        } as React.CSSProperties}
                      >
                        <span
                          className="absolute top-0 left-0 px-1 py-0.5 text-[9px] md:text-base md:px-2 font-bold leading-tight rounded-br-sm"
                          style={{
                            backgroundColor: team.colorHex,
                            color: textColor,
                          }}
                        >
                          {letter}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="relative aspect-[10/9] w-full">
                  <Image
                    src={machine.decalImage}
                    alt={`${machine.label} Decal Selection`}
                    fill
                    className="object-contain rounded"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

import React, { useState, useMemo } from 'react';
import { Team } from '../balancer';
import { Award, Shield, Zap, Crosshair, Activity, Sparkles, AlertCircle, Eye, EyeOff, Copy } from 'lucide-react';

interface TeamRadarChartProps {
  teams: Team[];
}

interface RadarAttribute {
  key: 'avgDefending' | 'avgMidfield' | 'avgAttacking' | 'avgStamina' | 'avgSkill';
  label: string;
  icon: React.ReactNode;
  color: string;
}

export const TeamRadarChart: React.FC<TeamRadarChartProps> = ({ teams }) => {
  // Toggle visibility of specific teams on the radar chart
  const [visibleTeams, setVisibleTeams] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    teams.forEach(t => {
      init[t.id] = true;
    });
    return init;
  });

  // Highlight a specific team when hovered
  const [hoveredTeamId, setHoveredTeamId] = useState<number | null>(null);

  // Active tooltip coordinate and details
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    teamName: string;
    attribute: string;
    value: number;
  } | null>(null);

  // Copy to clipboard notification state
  const [copied, setCopied] = useState(false);

  // Helper to generate text visual bar for copied footprints
  const generateBar = (val: number) => {
    const filled = Math.max(0, Math.min(10, Math.round(((val - 40) / 60) * 10)));
    return '■'.repeat(filled) + '░'.repeat(10 - filled);
  };

  // Copy beautiful ASCII footprint & stats reports
  const handleCopyReport = () => {
    let report = `📊 TACTICAL DIAGRAM & COMPARATIVE STATS REPORT\n`;
    report += `==============================================\n\n`;

    report += `📈 VISUAL RADAR CHART FOOTPRINTS:\n`;
    report += `----------------------------------\n`;
    teams.forEach((team) => {
      const isVisible = syncTeams[team.id] !== false;
      if (!isVisible) return;
      
      report += `${team.name.toUpperCase()} (Tactical Signature):\n`;
      attributes.forEach(attr => {
        const val = team.metrics[attr.key] !== undefined ? (team.metrics[attr.key] as number) : 0;
        const bar = generateBar(val);
        let emoji = '🔮';
        if (attr.key === 'avgDefending') emoji = '🛡️ DEF';
        if (attr.key === 'avgMidfield') emoji = '⚡ MID';
        if (attr.key === 'avgAttacking') emoji = '🎯 ATT';
        if (attr.key === 'avgStamina') emoji = '🔋 STA';
        if (attr.key === 'avgSkill') emoji = '🏆 OVR';
        report += `  ${emoji.padEnd(6, ' ')}: [${bar}] ${val}\n`;
      });
      report += `\n`;
    });

    report += `📊 SIDE-BY-SIDE STATS COMPARISON:\n`;
    report += `----------------------------------\n`;
    attributes.forEach(attr => {
      report += `🔹 [${attr.label}]:\n`;
      teams.forEach(team => {
        const val = team.metrics[attr.key] !== undefined ? (team.metrics[attr.key] as number) : 0;
        const isWinner = winners[attr.key]?.ids.includes(team.id);
        const winMarker = isWinner && teams.length > 1 ? ' ⭐ (Leader)' : '';
        report += `   - ${team.name}: ${val}${winMarker}\n`;
      });
      report += `\n`;
    });

    report += `Generated automatically via Tactical Team Balancer.\n`;

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // Re-sync visibility state if teams list changes (e.g. after balancing)
  const syncTeams = useMemo(() => {
    const next: Record<number, boolean> = {};
    teams.forEach(t => {
      next[t.id] = visibleTeams[t.id] !== undefined ? visibleTeams[t.id] : true;
    });
    return next;
  }, [teams, visibleTeams]);

  // Handle visibility checkbox change
  const toggleTeamVisibility = (id: number) => {
    setVisibleTeams(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Dimensions of SVG Radar Chart
  const size = 380;
  const cx = size / 2;
  const cy = (size / 2) - 10; // offset slightly up to make room for bottom labels
  const r = 120; // max radius for value of 100

  // Standard rating baseline settings to enhance graphical contrast
  const MIN_VAL = 40;
  const MAX_VAL = 95;

  const valueToRadius = (val: number) => {
    const clamped = Math.max(MIN_VAL, Math.min(MAX_VAL, val));
    return ((clamped - MIN_VAL) / (MAX_VAL - MIN_VAL)) * r;
  };

  const attributes: RadarAttribute[] = [
    { key: 'avgDefending', label: 'Defending', icon: <Shield className="h-3 w-3 inline mr-0.5" />, color: 'text-emerald-700' },
    { key: 'avgMidfield', label: 'Midfield', icon: <Zap className="h-3 w-3 inline mr-0.5" />, color: 'text-blue-700' },
    { key: 'avgAttacking', label: 'Attacking', icon: <Crosshair className="h-3 w-3 inline mr-0.5" />, color: 'text-amber-800' },
    { key: 'avgStamina', label: 'Stamina', icon: <Activity className="h-3 w-3 inline mr-0.5" />, color: 'text-indigo-700' },
    { key: 'avgSkill', label: 'Overall', icon: <Award className="h-3 w-3 inline mr-0.5" />, color: 'text-rose-700' },
  ];

  const numSides = attributes.length;

  // Precompute the angles for our pentagram grid axes (Defending is top-center at -90 degrees)
  const angles = useMemo(() => {
    return Array.from({ length: numSides }, (_, i) => {
      return (i * 2 * Math.PI) / numSides - Math.PI / 2;
    });
  }, [numSides]);

  // Color theme definitions matching dashboard team indices
  const themes = [
    {
      name: 'Sky',
      fill: 'rgba(14, 165, 233, 0.16)',
      stroke: '#0ea5e9',
      activeFill: 'rgba(14, 165, 233, 0.38)',
      activeStroke: '#0284c7',
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      pill: 'bg-sky-500',
      hoverBorder: 'hover:border-sky-300'
    },
    {
      name: 'Rose',
      fill: 'rgba(244, 63, 94, 0.16)',
      stroke: '#f43f5e',
      activeFill: 'rgba(244, 63, 94, 0.38)',
      activeStroke: '#e11d48',
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      pill: 'bg-rose-500',
      hoverBorder: 'hover:border-rose-300'
    },
    {
      name: 'Amber',
      fill: 'rgba(245, 158, 11, 0.16)',
      stroke: '#f59e0b',
      activeFill: 'rgba(245, 158, 11, 0.38)',
      activeStroke: '#d97706',
      bg: 'bg-amber-50 border-amber-200 text-amber-800',
      pill: 'bg-amber-500',
      hoverBorder: 'hover:border-amber-300'
    },
    {
      name: 'Emerald',
      fill: 'rgba(16, 185, 129, 0.16)',
      stroke: '#10b981',
      activeFill: 'rgba(16, 185, 129, 0.38)',
      activeStroke: '#059669',
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      pill: 'bg-emerald-500',
      hoverBorder: 'hover:border-emerald-300'
    },
    {
      name: 'Indigo',
      fill: 'rgba(99, 102, 241, 0.16)',
      stroke: '#6366f1',
      activeFill: 'rgba(99, 102, 241, 0.38)',
      activeStroke: '#4f46e5',
      bg: 'bg-indigo-50 border-indigo-200 text-indigo-805',
      pill: 'bg-indigo-500',
      hoverBorder: 'hover:border-indigo-300'
    }
  ];

  // Helper: map polar to cartesian coordinates
  const getCoordinates = (index: number, val: number) => {
    const radiusLength = valueToRadius(val);
    const angle = angles[index];
    const x = cx + radiusLength * Math.cos(angle);
    const y = cy + radiusLength * Math.sin(angle);
    return { x, y };
  };

  // Concentric background grid coordinates representing levels (e.g. 50, 60, 70, 80, 90)
  const gridLevels = [50, 60, 70, 80, 90];

  // Identifies the best team in each category
  const winners = useMemo(() => {
    const res: Record<string, { val: number; ids: number[] }> = {};
    attributes.forEach(attr => {
      let maxVal = -1;
      const ids: number[] = [];
      teams.forEach(t => {
        const val = t.metrics[attr.key] !== undefined ? (t.metrics[attr.key] as number) : 0;
        if (val > maxVal) {
          maxVal = val;
        }
      });
      // Collect all teams having this max value (in case of ties)
      teams.forEach(t => {
        const val = t.metrics[attr.key] !== undefined ? (t.metrics[attr.key] as number) : 0;
        if (val === maxVal && maxVal > 0) {
          ids.push(t.id);
        }
      });
      res[attr.key] = { val: maxVal, ids };
    });
    return res;
  }, [teams]);

  return (
    <div className="mt-8 bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4 mb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-black text-slate-800 tracking-wide flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-500 fill-rose-100 animate-pulse" />
              Tactical Spider Chart Comparison
            </h2>
            <button
              onClick={handleCopyReport}
              className="px-5 h-11 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2 transition cursor-pointer border-solid shadow"
              title="Copy visual radar signature and side-by-side stats report to clipboard"
            >
              <Copy className="h-4 w-4 text-blue-600" />
              {copied ? 'Copied!' : 'Copy Report'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Graphical multi-dimensional overlap checking tactical balance across defenders, midfielders, attackers, stamina, and overall skill.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0 self-start sm:self-center">
          {teams.map((team, idx) => {
            const isVisible = syncTeams[team.id] !== false;
            const style = themes[idx % themes.length];
            return (
              <button
                key={team.id}
                onClick={() => toggleTeamVisibility(team.id)}
                onMouseEnter={() => isVisible && setHoveredTeamId(team.id)}
                onMouseLeave={() => setHoveredTeamId(null)}
                className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition ${
                  isVisible ? `${style.bg} ${style.hoverBorder}` : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
                title={`Toggle ${team.name} visibility on the chart`}
              >
                <span className={`h-2 w-2 rounded-full ${isVisible ? style.pill : 'bg-slate-300'}`} />
                <span>{team.name}</span>
                {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Radar SVG Left Column */}
        <div className="lg:col-span-6 flex items-center justify-center relative">
          <div className="max-w-[100%] w-[380px] h-[380px] bg-slate-50/50 rounded-xl p-2 border border-slate-100/80 relative">
            
            {/* SVG Render */}
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full overflow-visible"
            >
              {/* Concentric grid lines */}
              {gridLevels.map((lvl, index) => {
                const points = angles.map((angle) => {
                  const radiusScale = valueToRadius(lvl);
                  const x = cx + radiusScale * Math.cos(angle);
                  const y = cy + radiusScale * Math.sin(angle);
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <g key={lvl}>
                    {/* Concentric pentagon path */}
                    <polygon
                      points={points}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="0.75"
                      strokeDasharray="2,2"
                    />
                    {/* Concentric grid axis score tag */}
                    <text
                      x={cx + 4}
                      y={cy - valueToRadius(lvl) + 3}
                      fontSize="8"
                      fill="#94a3b8"
                      className="font-mono font-bold select-none pointer-events-none"
                    >
                      {lvl}
                    </text>
                  </g>
                );
              })}

              {/* Radial Axis line stems */}
              {angles.map((angle, i) => {
                const outerRad = valueToRadius(MAX_VAL + 2);
                const ox = cx + outerRad * Math.cos(angle);
                const oy = cy + outerRad * Math.sin(angle);

                return (
                  <line
                    key={i}
                    x1={cx}
                    y1={cy}
                    x2={ox}
                    y2={oy}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="1,1"
                  />
                );
              })}

              {/* Team Overlay Polygons */}
              {teams.map((team, idx) => {
                const isVisible = syncTeams[team.id] !== false;
                if (!isVisible) return null;

                const style = themes[idx % themes.length];
                const isHighlighted = hoveredTeamId === team.id;
                const isAnyHovered = hoveredTeamId !== null;
                const opacity = isHighlighted ? 1.0 : (isAnyHovered ? 0.2 : 0.7);

                const polygonPoints = attributes.map((attr, aIdx) => {
                  const val = team.metrics[attr.key] !== undefined ? (team.metrics[attr.key] as number) : 0;
                  const { x, y } = getCoordinates(aIdx, val);
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <g
                    key={team.id}
                    onMouseEnter={() => setHoveredTeamId(team.id)}
                    onMouseLeave={() => setHoveredTeamId(null)}
                    className="transition duration-300"
                    style={{ opacity }}
                  >
                    {/* Filled Area */}
                    <polygon
                      points={polygonPoints}
                      fill={isHighlighted ? style.activeFill : style.fill}
                      stroke={isHighlighted ? style.activeStroke : style.stroke}
                      strokeWidth={isHighlighted ? "2.5" : "1.8"}
                      className="transition duration-150 ease-out cursor-pointer"
                    />
                    
                    {/* Data Vertices Points */}
                    {attributes.map((attr, aIdx) => {
                      const val = team.metrics[attr.key] !== undefined ? (team.metrics[attr.key] as number) : 0;
                      const { x, y } = getCoordinates(aIdx, val);

                      return (
                        <circle
                          key={aIdx}
                          cx={x}
                          cy={y}
                          r={isHighlighted ? "4.5" : "3"}
                          fill={style.stroke}
                          className="cursor-pointer stroke-white hover:r-6 hover:stroke-slate-800 transition-all text-xs"
                          onMouseEnter={(e) => {
                            setTooltip({
                              x,
                              y,
                              teamName: team.name,
                              attribute: attr.label,
                              value: val
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* Axis labels with appropriate positioning */}
              {attributes.map((attr, i) => {
                const angle = angles[i];
                // Push labels slightly outside the maximum radius
                const labelDist = valueToRadius(MAX_VAL) + 18;
                const lx = cx + labelDist * Math.cos(angle);
                const ly = cy + labelDist * Math.sin(angle);

                let anchorValue = 'middle';
                if (Math.cos(angle) > 0.15) anchorValue = 'start';
                if (Math.cos(angle) < -0.15) anchorValue = 'end';

                return (
                  <text
                    key={i}
                    x={lx}
                    y={ly + 3}
                    textAnchor={anchorValue}
                    fontSize="9.5"
                    fill="#334155"
                    className="font-bold select-none text-[9.5px]"
                  >
                    {attr.label}
                  </text>
                );
              })}

              {/* Center point mark */}
              <circle cx={cx} cy={cy} r="2.5" fill="#64748b" />
            </svg>

            {/* Custom Tooltip Overlays */}
            {tooltip && (
              <div
                className="absolute z-10 px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-white rounded shadow-md pointer-events-none text-[10px] font-mono leading-tight max-w-[140px]"
                style={{
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y - 35}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">{tooltip.teamName}</div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-slate-400">{tooltip.attribute}:</span>
                  <span className="font-extrabold text-amber-400">{tooltip.value}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side-by-Side Tactical Analytical Table Right Column */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 md:p-5 flex flex-col gap-3">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
              <Sparkles className="h-4 w-4 text-amber-500 fill-amber-100" />
              Side-By-Side Stats Breakdown
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2.5 text-slate-400 font-bold select-none text-[10px] uppercase">TACTICAL DIMENSION</th>
                    {teams.map((team, idx) => (
                      <th key={team.id} className="py-2.5 px-2 font-black text-slate-700 text-center select-none">
                        {team.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attributes.map((attr, aIdx) => {
                    return (
                      <tr key={attr.key} className="border-b border-slate-100 hover:bg-slate-200/40 transition">
                        <td className="py-3 text-slate-600 font-bold flex items-center gap-1">
                          {attr.icon}
                          <span>{attr.label}</span>
                        </td>
                        {teams.map((team, idx) => {
                          const val = team.metrics[attr.key] !== undefined ? (team.metrics[attr.key] as number) : 0;
                          const isWinner = winners[attr.key]?.ids.includes(team.id);
                          const isBold = isWinner && teams.length > 1;

                          return (
                            <td key={team.id} className="py-3 px-2 text-center font-mono">
                              <span className={`px-2 py-0.5 rounded ${isBold ? 'bg-amber-100 text-amber-900 border border-amber-250 font-black' : 'text-slate-600'}`}>
                                {val}
                                {isBold && <span className="ml-0.5 select-none text-[8px]" title="Leader in Category">⭐</span>}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-1.5 bg-slate-100 text-slate-500 border border-slate-200 p-2.5 rounded-lg text-[9.5px] leading-relaxed">
              <AlertCircle className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                <strong>Ties / Equalizations:</strong> Star marks highlight the highest rating squad in that specific zone. This multi-dimensional comparison verifies that defensively-minded and play-making midfielders, wingers, and physical runners are evenly distributed across systems so both teams play identically flat.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

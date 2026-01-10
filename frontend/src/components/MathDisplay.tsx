import React from 'react';
import { Tooltip, InfoIcon } from './Tooltip';
import type { Composition } from '../types/music';

interface MathDisplayProps {
    composition: Composition | null;
    tempo?: number;
    isPlaying?: boolean;
    currentTime?: number;
}

export const MathDisplay: React.FC<MathDisplayProps> = ({
    composition,
    tempo = 72,
    isPlaying = false,
    currentTime = 0,
}) => {
    if (!composition) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-gray-100 min-h-[400px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="text-xl">Waiting for inspiration...</p>
                    <p className="text-sm mt-2">Generate a composition to see the structure.</p>
                </div>
            </div>
        );
    }

    const { scale, form, euclideanPatterns } = composition;

    // Calculate current beat based on tempo and time
    const beatsPerSecond = tempo / 60;
    const currentBeat = currentTime * beatsPerSecond;

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
            {/* Scale Visualization */}
            <section>
                <h3 className="text-lg font-bold text-silk-stone mb-4 flex items-center">
                    <span className="w-2 h-8 bg-silk-amber mr-2 rounded-full"></span>
                    Pentatonic Scale Structure
                </h3>
                <div className="flex gap-2 justify-center bg-stone-50 p-4 rounded-xl">
                    {scale?.map((note: string, i: number) => (
                        <div key={i} className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-silk-stone text-white flex items-center justify-center font-bold shadow-md">
                                {note}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Euclidean Rhythm */}
            <section>
                <h3 className="text-lg font-bold text-silk-stone mb-4 flex items-center">
                    <span className="w-2 h-8 bg-silk-red mr-2 rounded-full"></span>
                    Euclidean Rhythm Geometry
                    <Tooltip content={
                        <div className="max-w-[200px] text-left">
                            <div className="font-bold mb-1">E(k,n) Pattern</div>
                            <div>Distributes k beats optimally across n pulses. Found in traditional African and Asian rhythms.</div>
                        </div>
                    }>
                        <InfoIcon className="ml-2" />
                    </Tooltip>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {euclideanPatterns &&
                        Object.entries(euclideanPatterns).map(([role, pattern]: [string, number[]]) => (
                            <div key={role} className="flex flex-col items-center">
                                <span className="uppercase text-xs font-bold tracking-wider mb-2 text-gray-500">
                                    {role}
                                </span>
                                <AnimatedEuclideanCircle
                                    pattern={pattern}
                                    isPlaying={isPlaying}
                                    currentBeat={currentBeat}
                                    role={role}
                                />
                                <EuclideanNotation pattern={pattern} />
                            </div>
                        ))}
                </div>
            </section>

            {/* Form Structure with Playhead */}
            <section>
                <h3 className="text-lg font-bold text-silk-stone mb-4 flex items-center">
                    <span className="w-2 h-8 bg-gray-400 mr-2 rounded-full"></span>
                    Musical Form
                </h3>
                <FormTimeline form={form} currentTime={currentTime} isPlaying={isPlaying} />
            </section>
        </div>
    );
};

// Animated Euclidean Circle with rotating playhead
interface AnimatedEuclideanCircleProps {
    pattern: number[];
    isPlaying: boolean;
    currentBeat: number;
    role: string;
}

const AnimatedEuclideanCircle: React.FC<AnimatedEuclideanCircleProps> = ({
    pattern,
    isPlaying,
    currentBeat,
    role,
}) => {
    const size = 140;
    const center = size / 2;
    const radius = 50;

    // Calculate which beat is active
    const patternLength = pattern.length;
    const activeBeatIndex = Math.floor(currentBeat) % patternLength;

    // Calculate playhead angle
    const beatFraction = currentBeat % patternLength;
    const playheadAngle = (beatFraction / patternLength) * 2 * Math.PI - Math.PI / 2;

    // Count hits for E(k,n) notation
    const hits = pattern.filter((p) => p === 1).length;

    return (
        <svg width={size} height={size} className="overflow-visible">
            {/* Background circle */}
            <circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#e5e7eb"
                strokeWidth="2"
                fill="none"
            />

            {/* Playhead line (rotating radar sweep) */}
            {isPlaying && (
                <line
                    x1={center}
                    y1={center}
                    x2={center + radius * Math.cos(playheadAngle)}
                    y2={center + radius * Math.sin(playheadAngle)}
                    stroke={role === 'melody' ? '#d32f2f' : '#ffbf00'}
                    strokeWidth="2"
                    opacity="0.6"
                />
            )}

            {/* Beat nodes */}
            {pattern.map((hit, i) => {
                const angle = (i / patternLength) * 2 * Math.PI - Math.PI / 2;
                const x = center + radius * Math.cos(angle);
                const y = center + radius * Math.sin(angle);

                const isActive = isPlaying && i === activeBeatIndex;
                const isHit = hit === 1;

                // Pulse effect when active hit
                const pulseScale = isActive && isHit ? 1.5 : 1;
                const baseRadius = isHit ? 8 : 4;

                return (
                    <g key={i}>
                        {/* Glow effect for active hit */}
                        {isActive && isHit && (
                            <circle
                                cx={x}
                                cy={y}
                                r={baseRadius * 2}
                                fill={role === 'melody' ? '#d32f2f' : '#ffbf00'}
                                opacity="0.3"
                                className="animate-ping"
                            />
                        )}
                        <circle
                            cx={x}
                            cy={y}
                            r={baseRadius * pulseScale}
                            fill={
                                isHit
                                    ? role === 'melody'
                                        ? '#d32f2f'
                                        : '#ffbf00'
                                    : '#e5e7eb'
                            }
                            className={isActive && isHit ? 'transition-all duration-100' : ''}
                            style={{
                                filter: isActive && isHit ? 'drop-shadow(0 0 4px currentColor)' : 'none',
                            }}
                        />
                    </g>
                );
            })}

            {/* Center notation E(k,n) */}
            <text
                x={center}
                y={center}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs font-mono fill-gray-500"
            >
                E({hits},{patternLength})
            </text>
        </svg>
    );
};

// Euclidean notation showing the pattern
const EuclideanNotation: React.FC<{ pattern: number[] }> = ({ pattern }) => {
    return (
        <div className="flex gap-1 mt-2">
            {pattern.map((hit, i) => (
                <div
                    key={i}
                    className={`w-3 h-3 rounded-sm ${
                        hit ? 'bg-silk-red' : 'bg-gray-200'
                    }`}
                />
            ))}
        </div>
    );
};

// Form timeline with playhead
interface FormTimelineProps {
    form: string[];
    currentTime: number;
    isPlaying: boolean;
}

const FormTimeline: React.FC<FormTimelineProps> = ({ form, currentTime, isPlaying }) => {
    // Assume each section is roughly equal duration
    // In a real app, this would come from the composition data
    const sectionDuration = 15; // seconds per section (estimated)
    const totalDuration = form.length * sectionDuration;
    const currentSection = Math.floor(currentTime / sectionDuration);
    const sectionProgress = ((currentTime % sectionDuration) / sectionDuration) * 100;

    return (
        <div className="space-y-3">
            {/* Section boxes */}
            <div className="flex items-center justify-center gap-4">
                {form?.map((section: string, i: number) => {
                    const isCurrent = i === currentSection && isPlaying;
                    const isPast = i < currentSection && isPlaying;

                    return (
                        <React.Fragment key={i}>
                            <div
                                className={`relative px-6 py-3 border-2 rounded-lg font-bold transition-all duration-300 ${
                                    isCurrent
                                        ? 'bg-silk-amber border-silk-amber text-white scale-110 shadow-lg'
                                        : isPast
                                        ? 'bg-silk-amber/30 border-silk-amber/50 text-silk-amber'
                                        : 'bg-silk-amber/10 border-silk-amber text-silk-amber'
                                }`}
                            >
                                {section}
                                {/* Progress bar within current section */}
                                {isCurrent && (
                                    <div className="absolute bottom-0 left-0 h-1 bg-white/50 rounded-b transition-all duration-100"
                                        style={{ width: `${sectionProgress}%` }}
                                    />
                                )}
                            </div>
                            {i < form.length - 1 && (
                                <div className={`text-lg ${isPast ? 'text-silk-amber' : 'text-gray-300'}`}>
                                    →
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Overall progress bar */}
            {isPlaying && (
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-silk-amber transition-all duration-100"
                        style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
};

// Legacy export for backwards compatibility
export const EuclideanCircle = ({ pattern }: { pattern: number[] }) => {
    const size = 120;
    const center = size / 2;
    const radius = 40;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={center} cy={center} r={radius} stroke="#e5e7eb" strokeWidth="2" fill="none" />
            {pattern.map((hit, i) => {
                const angle = (i / pattern.length) * 2 * Math.PI;
                const x = center + radius * Math.cos(angle);
                const y = center + radius * Math.sin(angle);
                return (
                    <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={hit ? 6 : 3}
                        fill={hit ? '#d32f2f' : '#e5e7eb'}
                    />
                );
            })}
        </svg>
    );
};

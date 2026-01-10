import React, { useState, useId } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipId = useId();

    return (
        <span
            className="relative inline-flex items-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
            tabIndex={0}
            aria-describedby={isVisible ? tooltipId : undefined}
        >
            {children}
            {isVisible && (
                <div
                    id={tooltipId}
                    role="tooltip"
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap max-w-xs"
                >
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </span>
    );
};

export const InfoIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        className={`w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help ${className}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
    </svg>
);

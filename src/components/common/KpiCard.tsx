import * as React from 'react';

interface KpiCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    colorObj: {
        from: string;
        to: string;
        shadow: string;
        iconBg?: string;
        border?: string;
        text?: string;
    };
    subtitle?: string;
    breakdown?: string;
    valueClassName?: string;
    variant?: 'primary' | 'secondary';
    onClick?: () => void;
    isActive?: boolean;
    className?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, colorObj, subtitle, breakdown, valueClassName, variant = 'primary', onClick, isActive, className = '' }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const Component = onClick ? 'button' : 'div';
    const clickProps = onClick ? {
        onClick,
        type: 'button' as const,
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false)
    } : {};

    if (variant === 'secondary') {
        return (
            // @ts-ignore
            <Component
                {...clickProps}
                className={`w-full md:w-auto min-w-[120px] text-left relative overflow-hidden bg-white/40 dark:bg-[#1e2530]/40 backdrop-blur-sm border ${isActive ? 'border-primary-500 ring-2 ring-primary-500/20' : colorObj.border || 'border-gray-200 dark:border-gray-700'} rounded-xl px-2 py-2 shadow-sm hover:shadow-lg transition-all duration-300 ${onClick ? 'hover:-translate-y-1' : ''} group h-full`}
            >
                <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 ${colorObj.text || 'text-gray-400'}`}>
                    {React.cloneElement(icon as React.ReactElement<any>, { className: "h-12 w-12" })}
                </div>
                <div className="flex items-center gap-2 relative z-10">
                    <div className={`p-1 rounded-lg ${colorObj.iconBg || 'bg-gray-100 dark:bg-gray-800'} ${colorObj.text || 'text-gray-600 dark:text-gray-300'} shadow-inner`}>
                        {React.cloneElement(icon as React.ReactElement<any>, { className: "h-3.5 w-3.5" })}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className={`text-lg font-bold ${colorObj.text || 'text-gray-900 dark:text-white'} truncate leading-tight`} title={value}>{value}</div>
                        <div className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate leading-tight" title={title}>{title}</div>
                    </div>
                </div>
                {subtitle && <div className="mt-1 text-[9px] font-medium text-gray-400 pl-1 truncate" title={subtitle}>{subtitle}</div>}
                {breakdown && <div className="mt-0.5 text-[8px] font-medium text-blue-400/80 pl-1 truncate italic" title={breakdown}>{breakdown}</div>}
            </Component>
        );
    }

    // ESTAMPA / COMPACT STYLE
    const gradientClass = `bg-gradient-to-br ${colorObj.from} ${colorObj.to}`;

    return (
        // @ts-ignore
        <Component
            {...clickProps}
            className={`w-full relative overflow-hidden ${gradientClass} rounded-xl px-2 py-1.5 text-white shadow-md transition-all duration-300 ${onClick ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''} h-full flex flex-col items-center justify-center min-h-[55px] text-center ${isActive ? 'ring-2 ring-white ring-offset-2' : ''} ${className}`}
        >
            {/* Subtle background icon */}
            <div className={`absolute -right-2 -bottom-2 opacity-20 transform -rotate-12 pointer-events-none transition-transform duration-500 ${isHovered ? 'scale-[2.5]' : 'scale-[2]'}`}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: "h-8 w-8 text-white" })}
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center w-full">
                <div className="text-[9px] font-black uppercase tracking-widest opacity-80 leading-tight mb-0.5">
                    {title}
                </div>
                <div className={`${valueClassName || 'text-xl'} font-black text-white leading-tight tracking-tight`}>
                    {value}
                </div>
                {breakdown && (
                    <div className="mt-1 text-[8px] font-bold text-white/60 truncate max-w-full">
                        {breakdown}
                    </div>
                )}
            </div>
        </Component>
    );
};

export default KpiCard;

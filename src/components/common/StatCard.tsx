import * as React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    valueClassName?: string;
    isTotal?: boolean;
    colorVariant?: 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo' | 'slate' | 'violet' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    valueClassName,
    isTotal,
    colorVariant = 'slate'
}) => {
    const getIconColor = () => {
        const colors = {
            emerald: 'text-emerald-400',
            blue: 'text-blue-400',
            amber: 'text-amber-400',
            rose: 'text-rose-400',
            indigo: 'text-indigo-400',
            slate: 'text-slate-400',
            violet: 'text-violet-400',
            orange: 'text-orange-400'
        };
        return isTotal ? 'text-teal-400' : (colors[colorVariant] || colors.slate);
    };

    const iconColor = getIconColor();

    return (
        <div className="relative overflow-hidden bg-[#1e2530] border border-slate-700/50 rounded-2xl p-4 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-600 group h-full">
            <div className="flex items-center gap-4 relative z-10">
                {/* Icon Container */}
                <div className={`p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 group-hover:scale-110 transition-transform duration-300 ${iconColor}`}>
                    {React.cloneElement(icon as React.ReactElement<any>, { className: "h-6 w-6" })}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 truncate">
                        {title}
                    </div>
                    <div className={`${valueClassName || 'text-2xl'} font-bold text-white tracking-tight truncate leading-none`}>
                        {value}
                    </div>
                    {subtitle && (
                        <div className="mt-1.5 text-[10px] font-medium text-gray-400 truncate">
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>

            {/* Subtle background glow */}
            <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-3xl opacity-5 transition-opacity duration-500 group-hover:opacity-10 ${iconColor.replace('text-', 'bg-')}`}></div>
        </div>
    );
};

export default StatCard;
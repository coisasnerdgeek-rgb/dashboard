import React, { useState } from 'react';

interface CopyButtonProps {
    text: string;
    className?: string;
    iconSize?: string;
    title?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
    text,
    className,
    iconSize = "h-3 w-3",
    title = "Copiar ID"
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={`transition-all active:scale-90 ${copied ? 'text-emerald-500 bg-emerald-500/10' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-500/10'} ${className || 'p-1 rounded'}`}
            title={title}
            type="button"
        >
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
        </button>
    );
};

import React from 'react';

interface PanelProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export const Panel: React.FC<PanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`panel ${className}`}>
            {title && <h3>{title}</h3>}
            {children}
        </div>
    );
};

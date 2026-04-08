import React from 'react';

interface PanelProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
    headerRight?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, children, className = '', headerRight }) => {
    return (
        <div className={`panel ${className}`}>
            {(title || headerRight) && (
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {title && <h3 style={{ margin: 0 }}>{title}</h3>}
                    {headerRight && <div>{headerRight}</div>}
                </div>
            )}
            {children}
        </div>
    );
};

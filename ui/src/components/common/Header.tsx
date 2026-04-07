import React from 'react';

interface HeaderProps {
    title: string;
    children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, children }) => {
    return (
        <div className="panel-header main-header">
            <h2>{title}</h2>
            {children && (
                <div className="header-buttons">
                    {children}
                </div>
            )}
        </div>
    );
};

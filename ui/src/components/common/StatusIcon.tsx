import React from 'react';
import type { ValidationStatus } from '../../types';

interface StatusIconProps {
    status: ValidationStatus | 'running' | 'stopped' | 'starting' | 'stopping';
    className?: string;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status, className = '' }) => {
    return (
        <span className={`status-icon ${status} ${className}`} />
    );
};

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'icon' | 'danger';
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    children,
    className = '',
    ...props
}) => {
    const classNames = [
        variant === 'secondary' ? 'secondary' : '',
        variant === 'icon' ? 'icon-btn' : '',
        variant === 'danger' ? 'danger-btn' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <button className={classNames || undefined} {...props}>
            {children}
        </button>
    );
};

interface ButtonGroupProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className = '', style }) => {
    return (
        <div className={`button-group ${className}`} style={style}>
            {children}
        </div>
    );
};

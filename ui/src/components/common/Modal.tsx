import React, { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    confirmDisabled?: boolean;
    position?: { top: number; left: number };
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    title,
    onClose,
    onConfirm,
    confirmText = '확인',
    cancelText = '취소',
    hideCancel = false,
    confirmDisabled = false,
    position,
    children,
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            ref={overlayRef}
            onClick={handleOverlayClick}
            style={{ display: 'flex' }}
        >
            <div
                className="modal"
                style={position ? {
                    position: 'absolute',
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    width: '100%',
                    transform: 'none',
                } : undefined}
            >
                <div className="modal-header">
                    <h4>{title}</h4>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    {!hideCancel && (
                        <Button variant="secondary" onClick={onClose}>
                            {cancelText}
                        </Button>
                    )}
                    <Button onClick={onConfirm} disabled={confirmDisabled}>
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { Modal } from '../common';

export const ChangedFilesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    changedFiles: { java: string[], query: string[] };
    onApply: () => void;
    isHotReloading: boolean;
}> = ({ isOpen, onClose, changedFiles, onApply, isHotReloading }) => {
    const [isJavaOpen, setIsJavaOpen] = useState(true);
    const [isQueryOpen, setIsQueryOpen] = useState(true);

    const totalCount = changedFiles.java.length + changedFiles.query.length;

    const getFileName = (p: string) => {
        const parts = p.split('/');
        return parts[parts.length - 1];
    };

    const getTooltip = (p: string) => {
        const srcIndex = p.indexOf('/src/');
        return srcIndex !== -1 ? p.substring(srcIndex) : p;
    };

    const renderSection = (
        label: string,
        files: string[],
        isOpen: boolean,
        toggle: () => void
    ) => (
        <div className="tree-section">
            <div
                className="tree-header"
                onClick={toggle}
                style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}
            >
                <span style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s', display: 'inline-block', marginRight: '4px', fontSize: '10px' }}>▶</span>
                {label} ({files.length})
            </div>
            {isOpen && (
                <div className="tree-content">
                    {files.length === 0 ? (
                        <div style={{ padding: '4px 8px 4px 24px', fontStyle: 'italic', color: 'var(--vscode-descriptionForeground)' }}>변경된 파일이 없습니다.</div>
                    ) : (
                        files.map((file, idx) => (
                            <div key={idx} className="tree-item" title={getTooltip(file)} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 24px' }}>
                                <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getFileName(file)}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            title={`변경된 파일 (${totalCount}건)`}
            onClose={onClose}
            onConfirm={onApply}
            confirmText="로컬 서버에 적용"
            cancelText="닫기"
            confirmDisabled={!isHotReloading}
            position={{ left: 0, top: 50 }}
        >
            {!isHotReloading && (
                <div className="message info" style={{ marginBottom: '12px', fontSize: '12px' }}>
                    Hot Reloading이 비활성화 상태에서 기동되어 변경 파일을 적용할 수 없습니다.
                </div>
            )}
            <div className="tree-view-container" style={{
                border: '1px solid var(--vscode-panel-border)',
                height: '220px',
                overflowY: 'auto',
                backgroundColor: 'var(--vscode-sideBar-background)',
                color: 'var(--vscode-sideBar-foreground)',
                margin: 0
            }}>
                {renderSection('Java', changedFiles.java, isJavaOpen, () => setIsJavaOpen(!isJavaOpen))}
                {renderSection('Query', changedFiles.query, isQueryOpen, () => setIsQueryOpen(!isQueryOpen))}
            </div>
        </Modal>
    );
};

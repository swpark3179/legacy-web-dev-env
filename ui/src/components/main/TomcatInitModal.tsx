import React from 'react';
import { Modal } from '../common';

export const TomcatInitModal: React.FC<{
    isOpen: boolean;
    contextRoot: string;
    port: string;
    isBusy: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onChangeContextRoot: (value: string) => void;
    onChangePort: (value: string) => void;
}> = ({
    isOpen,
    contextRoot,
    port,
    isBusy,
    onClose,
    onConfirm,
    onChangeContextRoot,
    onChangePort,
}) => {
    const trimmedContextRoot = contextRoot.trim();
    const parsedPort = Number.parseInt(port, 10);
    const isPortValid = port !== '' && Number.isInteger(parsedPort) && parsedPort >= 1024 && parsedPort <= 65535;
    const isContextRootValid = trimmedContextRoot.length > 0;

    return (
        <Modal
            isOpen={isOpen}
            title="Tomcat 초기화"
            onClose={onClose}
            onConfirm={onConfirm}
            confirmText="초기화"
            confirmDisabled={isBusy || !isContextRootValid || !isPortValid}
        >
            <div className="input-group">
                <label htmlFor="tomcat-init-context-root">context root</label>
                <input
                    id="tomcat-init-context-root"
                    type="text"
                    value={contextRoot}
                    onChange={(e) => onChangeContextRoot(e.target.value)}
                    placeholder="예: my-app"
                    autoFocus
                />
                <span className="input-hint">display-name이 없으면 직접 입력해야 합니다.</span>
                {!isContextRootValid && (
                    <div className="validation-message invalid" role="alert" style={{ marginTop: '6px' }}>
                        context root를 입력해 주세요.
                    </div>
                )}
            </div>

            <div className="input-group">
                <label htmlFor="tomcat-init-port">port</label>
                <input
                    id="tomcat-init-port"
                    type="text"
                    value={port}
                    onChange={(e) => onChangePort(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="8080"
                    inputMode="numeric"
                    aria-invalid={!isPortValid}
                    aria-describedby={!isPortValid ? 'tomcat-init-port-error' : undefined}
                    style={{ borderColor: !isPortValid ? 'var(--vscode-testing-iconFailed, #f14c4c)' : undefined }}
                />
                <span className="input-hint">기본값은 8080입니다.</span>
                {!isPortValid && (
                    <div id="tomcat-init-port-error" className="validation-message invalid" role="alert" style={{ marginTop: '6px' }}>
                        포트 번호는 1024~65535 사이여야 합니다.
                    </div>
                )}
            </div>
        </Modal>
    );
};

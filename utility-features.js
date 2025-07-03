// 유틸리티 기능 모듈
class UtilityFeatures {
    constructor() {
        this.batchManager = new BatchManager();
        this.dataManager = new DataManager();
        this.backupManager = new BackupManager();
        this.statisticsManager = new StatisticsManager();
        this.notificationManager = new NotificationManager();
        this.settingsManager = new SettingsManager();
        this.init();
    }

    init() {
        this.createUtilityMenu();
        this.initManagers();
    }

    createUtilityMenu() {
        const utilityMenu = document.createElement('div');
        utilityMenu.className = 'utility-menu';
        utilityMenu.innerHTML = `
            <button class="utility-toggle" onclick="utilityFeatures.toggleMenu()">
                <i class="fas fa-cog"></i>
            </button>
            <div class="utility-dropdown" id="utilityDropdown">
                <div class="utility-item" onclick="utilityFeatures.batchManager.openBatchOperations()">
                    <i class="fas fa-tasks"></i> 일괄 작업
                </div>
                <div class="utility-item" onclick="utilityFeatures.dataManager.openExportDialog()">
                    <i class="fas fa-download"></i> 데이터 내보내기
                </div>
                <div class="utility-item" onclick="utilityFeatures.dataManager.openImportDialog()">
                    <i class="fas fa-upload"></i> 데이터 가져오기
                </div>
                <div class="utility-item" onclick="utilityFeatures.backupManager.openBackupDialog()">
                    <i class="fas fa-shield-alt"></i> 백업/복원
                </div>
                <div class="utility-item" onclick="utilityFeatures.statisticsManager.openDashboard()">
                    <i class="fas fa-chart-bar"></i> 통계 대시보드
                </div>
                <div class="utility-item" onclick="utilityFeatures.settingsManager.openSettings()">
                    <i class="fas fa-sliders-h"></i> 설정
                </div>
            </div>
        `;

        // 헤더에 추가
        const header = document.querySelector('.main-header');
        if (header) {
            header.appendChild(utilityMenu);
        }
    }

    toggleMenu() {
        const dropdown = document.getElementById('utilityDropdown');
        dropdown.classList.toggle('show');
    }

    initManagers() {
        this.batchManager.init();
        this.dataManager.init();
        this.backupManager.init();
        this.statisticsManager.init();
        this.notificationManager.init();
        this.settingsManager.init();
    }
}

// 일괄 작업 관리자
class BatchManager {
    constructor() {
        this.selectedItems = new Set();
        this.operations = {
            delete: '삭제',
            move: '이동',
            export: '내보내기',
            tag: '태그 추가'
        };
    }

    init() {
        this.createBatchInterface();
        this.setupSelectionMode();
    }

    createBatchInterface() {
        const batchModal = document.createElement('div');
        batchModal.id = 'batchModal';
        batchModal.className = 'modal';
        batchModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>일괄 작업</h3>
                    <span class="close" onclick="utilityFeatures.batchManager.closeBatchOperations()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="batch-controls">
                        <div class="selection-controls">
                            <button onclick="utilityFeatures.batchManager.selectAll()">전체 선택</button>
                            <button onclick="utilityFeatures.batchManager.selectNone()">선택 해제</button>
                            <span class="selection-count">선택된 항목: <span id="selectedCount">0</span>개</span>
                        </div>
                        <div class="batch-operations">
                            <select id="batchOperation">
                                <option value="">작업 선택</option>
                                <option value="delete">선택 항목 삭제</option>
                                <option value="export">선택 항목 내보내기</option>
                                <option value="move">저장소 이동</option>
                            </select>
                            <button onclick="utilityFeatures.batchManager.executeBatchOperation()">실행</button>
                        </div>
                    </div>
                    <div class="batch-items" id="batchItemsList">
                        <!-- 선택 가능한 항목들이 여기에 표시됩니다 -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(batchModal);
    }

    openBatchOperations() {
        this.loadBatchItems();
        document.getElementById('batchModal').style.display = 'block';
    }

    closeBatchOperations() {
        document.getElementById('batchModal').style.display = 'none';
        this.selectedItems.clear();
        this.updateSelectionCount();
    }

    loadBatchItems() {
        const container = document.getElementById('batchItemsList');
        const currentTab = document.querySelector('.tab-btn.active').textContent.trim();
        
        let items = [];
        switch (currentTab) {
            case '추억':
                items = memoriesData.map(memory => ({
                    id: memory.id,
                    type: 'memory',
                    title: memory.title,
                    subtitle: `${memory.author} • ${memory.date}`
                }));
                break;
            case '학생 목록':
                items = studentsData.map(student => ({
                    id: student.id,
                    type: 'student',
                    title: student.name,
                    subtitle: student.type === 'teacher' ? '선생님' : '학생'
                }));
                break;
            case '개발자':
                items = developersData.map(developer => ({
                    id: developer.id,
                    type: 'developer',
                    title: developer.name,
                    subtitle: '개발자'
                }));
                break;
        }

        container.innerHTML = items.map(item => `
            <div class="batch-item">
                <label>
                    <input type="checkbox" value="${item.id}" onchange="utilityFeatures.batchManager.toggleSelection('${item.id}')">
                    <div class="item-info">
                        <div class="item-title">${item.title}</div>
                        <div class="item-subtitle">${item.subtitle}</div>
                    </div>
                </label>
            </div>
        `).join('');
    }

    toggleSelection(itemId) {
        if (this.selectedItems.has(itemId)) {
            this.selectedItems.delete(itemId);
        } else {
            this.selectedItems.add(itemId);
        }
        this.updateSelectionCount();
    }

    selectAll() {
        const checkboxes = document.querySelectorAll('#batchItemsList input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedItems.add(checkbox.value);
        });
        this.updateSelectionCount();
    }

    selectNone() {
        const checkboxes = document.querySelectorAll('#batchItemsList input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedItems.clear();
        this.updateSelectionCount();
    }

    updateSelectionCount() {
        document.getElementById('selectedCount').textContent = this.selectedItems.size;
    }

    async executeBatchOperation() {
        const operation = document.getElementById('batchOperation').value;
        if (!operation || this.selectedItems.size === 0) {
            showToast('작업과 항목을 선택해주세요.', 'warning');
            return;
        }

        const confirmed = confirm(`선택된 ${this.selectedItems.size}개 항목에 대해 ${this.operations[operation]} 작업을 실행하시겠습니까?`);
        if (!confirmed) return;

        try {
            switch (operation) {
                case 'delete':
                    await this.batchDelete();
                    break;
                case 'export':
                    await this.batchExport();
                    break;
                case 'move':
                    await this.batchMove();
                    break;
            }
            
            showToast('일괄 작업이 완료되었습니다.', 'success');
            this.closeBatchOperations();
            
            // 데이터 새로고침
            await loadAllData();
            displayMemories();
            displayStudents();
            displayDevelopers();
            
        } catch (error) {
            handleError(error, 'batchOperation');
        }
    }

    async batchDelete() {
        const promises = Array.from(this.selectedItems).map(async (itemId) => {
            const currentTab = document.querySelector('.tab-btn.active').textContent.trim();
            switch (currentTab) {
                case '추억':
                    return deleteMemory(itemId);
                case '학생 목록':
                    return deleteStudent(itemId);
                case '개발자':
                    return deleteDeveloper(itemId);
            }
        });

        await Promise.all(promises);
    }

    async batchExport() {
        const data = Array.from(this.selectedItems).map(itemId => {
            const currentTab = document.querySelector('.tab-btn.active').textContent.trim();
            switch (currentTab) {
                case '추억':
                    return memoriesData.find(m => m.id === itemId);
                case '학생 목록':
                    return studentsData.find(s => s.id === itemId);
                case '개발자':
                    return developersData.find(d => d.id === itemId);
            }
        }).filter(Boolean);

        utilityFeatures.dataManager.exportData(data, 'selected_items');
    }

    async batchMove() {
        // 저장소 이동 로직 (추억 항목만 해당)
        const targetRepo = prompt('이동할 저장소를 입력하세요 (DS-1 ~ DS-20):');
        if (!targetRepo || !targetRepo.match(/^DS-([1-9]|1[0-9]|20)$/)) {
            showToast('올바른 저장소 이름을 입력해주세요.', 'warning');
            return;
        }

        // 이동 로직 구현
        console.log(`Moving items to ${targetRepo}`);
    }

    setupSelectionMode() {
        // 선택 모드 토글 기능
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.openBatchOperations();
            }
        });
    }
}

// 데이터 관리자
class DataManager {
    constructor() {
        this.exportFormats = {
            json: 'JSON',
            csv: 'CSV',
            xlsx: 'Excel'
        };
    }

    init() {
        this.createExportDialog();
        this.createImportDialog();
    }

    createExportDialog() {
        const exportModal = document.createElement('div');
        exportModal.id = 'exportModal';
        exportModal.className = 'modal';
        exportModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>데이터 내보내기</h3>
                    <span class="close" onclick="utilityFeatures.dataManager.closeExportDialog()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <div class="form-group">
                            <label>내보낼 데이터:</label>
                            <div class="checkbox-group">
                                <label><input type="checkbox" id="exportMemories" checked> 추억</label>
                                <label><input type="checkbox" id="exportStudents" checked> 학생 목록</label>
                                <label><input type="checkbox" id="exportDevelopers" checked> 개발자</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>파일 형식:</label>
                            <select id="exportFormat">
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label><input type="checkbox" id="includeImages"> 이미지 포함</label>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button onclick="utilityFeatures.dataManager.executeExport()">내보내기</button>
                        <button onclick="utilityFeatures.dataManager.closeExportDialog()">취소</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(exportModal);
    }

    createImportDialog() {
        const importModal = document.createElement('div');
        importModal.id = 'importModal';
        importModal.className = 'modal';
        importModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>데이터 가져오기</h3>
                    <span class="close" onclick="utilityFeatures.dataManager.closeImportDialog()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="import-options">
                        <div class="form-group">
                            <label>파일 선택:</label>
                            <input type="file" id="importFile" accept=".json,.csv" onchange="utilityFeatures.dataManager.previewImport()">
                        </div>
                        <div class="form-group">
                            <label><input type="checkbox" id="mergeData" checked> 기존 데이터와 병합</label>
                            <small>체크 해제 시 기존 데이터를 모두 삭제하고 가져옵니다.</small>
                        </div>
                        <div id="importPreview" class="import-preview"></div>
                    </div>
                    <div class="modal-actions">
                        <button id="executeImport" onclick="utilityFeatures.dataManager.executeImport()" disabled>가져오기</button>
                        <button onclick="utilityFeatures.dataManager.closeImportDialog()">취소</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(importModal);
    }

    openExportDialog() {
        document.getElementById('exportModal').style.display = 'block';
    }

    closeExportDialog() {
        document.getElementById('exportModal').style.display = 'none';
    }

    openImportDialog() {
        document.getElementById('importModal').style.display = 'block';
    }

    closeImportDialog() {
        document.getElementById('importModal').style.display = 'none';
    }

    async executeExport() {
        const includeMemories = document.getElementById('exportMemories').checked;
        const includeStudents = document.getElementById('exportStudents').checked;
        const includeDevelopers = document.getElementById('exportDevelopers').checked;
        const format = document.getElementById('exportFormat').value;
        const includeImages = document.getElementById('includeImages').checked;

        const exportData = {};

        if (includeMemories) exportData.memories = memoriesData;
        if (includeStudents) exportData.students = studentsData;
        if (includeDevelopers) exportData.developers = developersData;

        exportData.metadata = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            includeImages: includeImages
        };

        this.exportData(exportData, 'memory_storage_backup', format);
        this.closeExportDialog();
    }

    exportData(data, filename, format = 'json') {
        let content, mimeType, extension;

        switch (format) {
            case 'json':
                content = JSON.stringify(data, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'csv':
                content = this.convertToCSV(data);
                mimeType = 'text/csv';
                extension = 'csv';
                break;
            default:
                throw new Error('Unsupported export format');
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('데이터가 성공적으로 내보내졌습니다.', 'success');
    }

    convertToCSV(data) {
        const csvData = [];
        
        // 헤더
        csvData.push(['Type', 'ID', 'Title/Name', 'Author', 'Date', 'Additional Info']);
        
        // 추억 데이터
        if (data.memories) {
            data.memories.forEach(memory => {
                csvData.push([
                    'Memory',
                    memory.id,
                    memory.title,
                    memory.author,
                    memory.date,
                    memory.repository
                ]);
            });
        }
        
        // 학생 데이터
        if (data.students) {
            data.students.forEach(student => {
                csvData.push([
                    'Student',
                    student.id,
                    student.name,
                    '',
                    '',
                    student.type
                ]);
            });
        }
        
        // 개발자 데이터
        if (data.developers) {
            data.developers.forEach(developer => {
                csvData.push([
                    'Developer',
                    developer.id,
                    developer.name,
                    '',
                    '',
                    'Developer'
                ]);
            });
        }
        
        return csvData.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    async previewImport() {
        const file = document.getElementById('importFile').files[0];
        if (!file) return;

        try {
            const content = await this.readFile(file);
            let data;

            if (file.name.endsWith('.json')) {
                data = JSON.parse(content);
            } else if (file.name.endsWith('.csv')) {
                data = this.parseCSV(content);
            }

            this.showImportPreview(data);
            document.getElementById('executeImport').disabled = false;

        } catch (error) {
            showToast('파일을 읽는 중 오류가 발생했습니다.', 'error');
            console.error('Import preview error:', error);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    parseCSV(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const data = { memories: [], students: [], developers: [] };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
            if (values.length < headers.length) continue;

            const type = values[0].toLowerCase();
            const item = {
                id: values[1],
                name: values[2] || values[2], // Title/Name
                author: values[3],
                date: values[4],
                additionalInfo: values[5]
            };

            if (type === 'memory') {
                data.memories.push({
                    id: item.id,
                    title: item.name,
                    author: item.author,
                    date: item.date,
                    repository: item.additionalInfo
                });
            } else if (type === 'student') {
                data.students.push({
                    id: item.id,
                    name: item.name,
                    type: item.additionalInfo
                });
            } else if (type === 'developer') {
                data.developers.push({
                    id: item.id,
                    name: item.name
                });
            }
        }

        return data;
    }

    showImportPreview(data) {
        const preview = document.getElementById('importPreview');
        const memoriesCount = data.memories?.length || 0;
        const studentsCount = data.students?.length || 0;
        const developersCount = data.developers?.length || 0;

        preview.innerHTML = `
            <h4>가져올 데이터 미리보기:</h4>
            <ul>
                <li>추억: ${memoriesCount}개</li>
                <li>학생: ${studentsCount}개</li>
                <li>개발자: ${developersCount}개</li>
            </ul>
        `;
    }

    async executeImport() {
        const file = document.getElementById('importFile').files[0];
        const mergeData = document.getElementById('mergeData').checked;

        if (!file) {
            showToast('파일을 선택해주세요.', 'warning');
            return;
        }

        try {
            const content = await this.readFile(file);
            let importData;

            if (file.name.endsWith('.json')) {
                importData = JSON.parse(content);
            } else if (file.name.endsWith('.csv')) {
                importData = this.parseCSV(content);
            }

            if (!mergeData) {
                // 기존 데이터 삭제
                memoriesData.length = 0;
                studentsData.length = 0;
                developersData.length = 0;
            }

            // 데이터 병합
            if (importData.memories) {
                memoriesData.push(...importData.memories);
            }
            if (importData.students) {
                studentsData.push(...importData.students);
            }
            if (importData.developers) {
                developersData.push(...importData.developers);
            }

            // 화면 업데이트
            displayMemories();
            displayStudents();
            displayDevelopers();

            showToast('데이터가 성공적으로 가져와졌습니다.', 'success');
            this.closeImportDialog();

        } catch (error) {
            handleError(error, 'importData');
        }
    }
}

// 백업 관리자
class BackupManager {
    constructor() {
        this.autoBackupEnabled = localStorage.getItem('autoBackup') === 'true';
        this.backupInterval = parseInt(localStorage.getItem('backupInterval')) || 24; // 시간
    }

    init() {
        this.createBackupDialog();
        if (this.autoBackupEnabled) {
            this.scheduleAutoBackup();
        }
    }

    createBackupDialog() {
        const backupModal = document.createElement('div');
        backupModal.id = 'backupModal';
        backupModal.className = 'modal';
        backupModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>백업 및 복원</h3>
                    <span class="close" onclick="utilityFeatures.backupManager.closeBackupDialog()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="backup-section">
                        <h4>백업 생성</h4>
                        <div class="form-group">
                            <label>백업 이름:</label>
                            <input type="text" id="backupName" placeholder="백업 이름을 입력하세요">
                        </div>
                        <button onclick="utilityFeatures.backupManager.createBackup()">백업 생성</button>
                    </div>
                    
                    <div class="backup-section">
                        <h4>자동 백업 설정</h4>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="autoBackupEnabled" ${this.autoBackupEnabled ? 'checked' : ''}>
                                자동 백업 활성화
                            </label>
                        </div>
                        <div class="form-group">
                            <label>백업 주기 (시간):</label>
                            <input type="number" id="backupInterval" value="${this.backupInterval}" min="1" max="168">
                        </div>
                        <button onclick="utilityFeatures.backupManager.saveBackupSettings()">설정 저장</button>
                    </div>
                    
                    <div class="backup-section">
                        <h4>백업 복원</h4>
                        <input type="file" id="restoreFile" accept=".json">
                        <button onclick="utilityFeatures.backupManager.restoreBackup()">복원</button>
                    </div>
                    
                    <div class="backup-section">
                        <h4>백업 기록</h4>
                        <div id="backupHistory"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(backupModal);
    }

    openBackupDialog() {
        this.loadBackupHistory();
        document.getElementById('backupModal').style.display = 'block';
    }

    closeBackupDialog() {
        document.getElementById('backupModal').style.display = 'none';
    }

    async createBackup() {
        const backupName = document.getElementById('backupName').value.trim() || 
                          `backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

        const backupData = {
            metadata: {
                name: backupName,
                created: new Date().toISOString(),
                version: '1.0'
            },
            data: {
                memories: memoriesData,
                students: studentsData,
                developers: developersData,
                settings: this.getSettings()
            }
        };

        // 로컬 스토리지에 백업 저장
        this.saveBackupToStorage(backupData);

        // 파일로 다운로드
        utilityFeatures.dataManager.exportData(backupData, backupName, 'json');

        showToast('백업이 생성되었습니다.', 'success');
        this.loadBackupHistory();
    }

    saveBackupToStorage(backupData) {
        const backups = JSON.parse(localStorage.getItem('backups') || '[]');
        backups.push({
            name: backupData.metadata.name,
            created: backupData.metadata.created,
            size: JSON.stringify(backupData).length
        });

        // 최대 10개 백업만 유지
        if (backups.length > 10) {
            backups.shift();
        }

        localStorage.setItem('backups', JSON.stringify(backups));
        localStorage.setItem(`backup_${backupData.metadata.name}`, JSON.stringify(backupData));
    }

    loadBackupHistory() {
        const backups = JSON.parse(localStorage.getItem('backups') || '[]');
        const historyContainer = document.getElementById('backupHistory');

        if (backups.length === 0) {
            historyContainer.innerHTML = '<p>백업 기록이 없습니다.</p>';
            return;
        }

        historyContainer.innerHTML = backups.map(backup => `
            <div class="backup-item">
                <div class="backup-info">
                    <strong>${backup.name}</strong>
                    <small>${new Date(backup.created).toLocaleString()}</small>
                    <small>${(backup.size / 1024).toFixed(2)} KB</small>
                </div>
                <div class="backup-actions">
                    <button onclick="utilityFeatures.backupManager.restoreFromStorage('${backup.name}')">복원</button>
                    <button onclick="utilityFeatures.backupManager.deleteBackup('${backup.name}')">삭제</button>
                </div>
            </div>
        `).join('');
    }

    async restoreBackup() {
        const file = document.getElementById('restoreFile').files[0];
        if (!file) {
            showToast('복원할 백업 파일을 선택해주세요.', 'warning');
            return;
        }

        try {
            const content = await utilityFeatures.dataManager.readFile(file);
            const backupData = JSON.parse(content);

            if (!backupData.data) {
                throw new Error('올바른 백업 파일이 아닙니다.');
            }

            const confirmed = confirm('현재 데이터가 모두 삭제되고 백업 데이터로 복원됩니다. 계속하시겠습니까?');
            if (!confirmed) return;

            // 데이터 복원
            memoriesData.length = 0;
            studentsData.length = 0;
            developersData.length = 0;

            if (backupData.data.memories) memoriesData.push(...backupData.data.memories);
            if (backupData.data.students) studentsData.push(...backupData.data.students);
            if (backupData.data.developers) developersData.push(...backupData.data.developers);

            // 설정 복원
            if (backupData.data.settings) {
                this.restoreSettings(backupData.data.settings);
            }

            // 화면 업데이트
            displayMemories();
            displayStudents();
            displayDevelopers();

            showToast('백업이 성공적으로 복원되었습니다.', 'success');
            this.closeBackupDialog();

        } catch (error) {
            handleError(error, 'restoreBackup');
        }
    }

    restoreFromStorage(backupName) {
        const backupData = JSON.parse(localStorage.getItem(`backup_${backupName}`));
        if (!backupData) {
            showToast('백업 데이터를 찾을 수 없습니다.', 'error');
            return;
        }

        const confirmed = confirm(`'${backupName}' 백업으로 복원하시겠습니까?`);
        if (!confirmed) return;

        // 복원 로직 (위와 동일)
        memoriesData.length = 0;
        studentsData.length = 0;
        developersData.length = 0;

        if (backupData.data.memories) memoriesData.push(...backupData.data.memories);
        if (backupData.data.students) studentsData.push(...backupData.data.students);
        if (backupData.data.developers) developersData.push(...backupData.data.developers);

        displayMemories();
        displayStudents();
        displayDevelopers();

        showToast('백업이 복원되었습니다.', 'success');
    }

    deleteBackup(backupName) {
        const confirmed = confirm(`'${backupName}' 백업을 삭제하시겠습니까?`);
        if (!confirmed) return;

        const backups = JSON.parse(localStorage.getItem('backups') || '[]');
        const updatedBackups = backups.filter(backup => backup.name !== backupName);
        
        localStorage.setItem('backups', JSON.stringify(updatedBackups));
        localStorage.removeItem(`backup_${backupName}`);

        this.loadBackupHistory();
        showToast('백업이 삭제되었습니다.', 'success');
    }

    saveBackupSettings() {
        const autoBackupEnabled = document.getElementById('autoBackupEnabled').checked;
        const backupInterval = parseInt(document.getElementById('backupInterval').value);

        this.autoBackupEnabled = autoBackupEnabled;
        this.backupInterval = backupInterval;

        localStorage.setItem('autoBackup', autoBackupEnabled.toString());
        localStorage.setItem('backupInterval', backupInterval.toString());

        if (autoBackupEnabled) {
            this.scheduleAutoBackup();
        } else {
            this.cancelAutoBackup();
        }

        showToast('백업 설정이 저장되었습니다.', 'success');
    }

    scheduleAutoBackup() {
        this.cancelAutoBackup(); // 기존 스케줄 취소
        
        this.autoBackupTimer = setInterval(() => {
            this.createAutoBackup();
        }, this.backupInterval * 60 * 60 * 1000); // 시간을 밀리초로 변환
    }

    cancelAutoBackup() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
        }
    }

    async createAutoBackup() {
        const backupName = `auto_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
        
        const backupData = {
            metadata: {
                name: backupName,
                created: new Date().toISOString(),
                version: '1.0',
                auto: true
            },
            data: {
                memories: memoriesData,
                students: studentsData,
                developers: developersData,
                settings: this.getSettings()
            }
        };

        this.saveBackupToStorage(backupData);
        console.log('Auto backup created:', backupName);
    }

    getSettings() {
        return {
            theme: localStorage.getItem('theme'),
            autoBackup: localStorage.getItem('autoBackup'),
            backupInterval: localStorage.getItem('backupInterval')
        };
    }

    restoreSettings(settings) {
        if (settings.theme) {
            localStorage.setItem('theme', settings.theme);
            advancedUI.applyTheme(settings.theme);
        }
        if (settings.autoBackup) {
            localStorage.setItem('autoBackup', settings.autoBackup);
        }
        if (settings.backupInterval) {
            localStorage.setItem('backupInterval', settings.backupInterval);
        }
    }
}

// 통계 관리자
class StatisticsManager {
    constructor() {
        this.stats = {
            memories: {},
            students: {},
            developers: {},
            usage: {}
        };
    }

    init() {
        this.createDashboard();
        this.calculateStats();
    }

    createDashboard() {
        const dashboardModal = document.createElement('div');
        dashboardModal.id = 'statisticsModal';
        dashboardModal.className = 'modal';
        dashboardModal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>통계 대시보드</h3>
                    <span class="close" onclick="utilityFeatures.statisticsManager.closeDashboard()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h4>추억 통계</h4>
                            <div id="memoriesStats"></div>
                        </div>
                        <div class="stat-card">
                            <h4>학생 통계</h4>
                            <div id="studentsStats"></div>
                        </div>
                        <div class="stat-card">
                            <h4>개발자 통계</h4>
                            <div id="developersStats"></div>
                        </div>
                        <div class="stat-card">
                            <h4>사용량 통계</h4>
                            <div id="usageStats"></div>
                        </div>
                    </div>
                    <div class="charts-section">
                        <div class="chart-container">
                            <canvas id="memoriesChart"></canvas>
                        </div>
                        <div class="chart-container">
                            <canvas id="repositoryChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dashboardModal);
    }

    openDashboard() {
        this.calculateStats();
        this.displayStats();
        this.createCharts();
        document.getElementById('statisticsModal').style.display = 'block';
    }

    closeDashboard() {
        document.getElementById('statisticsModal').style.display = 'none';
    }

    calculateStats() {
        // 추억 통계
        this.stats.memories = {
            total: memoriesData.length,
            byAuthor: this.groupBy(memoriesData, 'author'),
            byRepository: this.groupBy(memoriesData, 'repository'),
            byMonth: this.groupByMonth(memoriesData),
            totalImages: memoriesData.reduce((sum, memory) => sum + (memory.images?.length || 0), 0)
        };

        // 학생 통계
        this.stats.students = {
            total: studentsData.length,
            teachers: studentsData.filter(s => s.type === 'teacher').length,
            students: studentsData.filter(s => s.type === 'student').length
        };

        // 개발자 통계
        this.stats.developers = {
            total: developersData.length
        };

        // 사용량 통계
        this.stats.usage = {
            cacheSize: this.getCacheSize(),
            performanceMetrics: performanceOptimizer.getPerformanceStats(),
            errorCount: securityManager.errorLogger.errors.length
        };
    }

    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const value = item[key];
            groups[value] = (groups[value] || 0) + 1;
            return groups;
        }, {});
    }

    groupByMonth(memories) {
        return memories.reduce((groups, memory) => {
            const month = memory.date.substring(0, 7); // YYYY-MM
            groups[month] = (groups[month] || 0) + 1;
            return groups;
        }, {});
    }

    getCacheSize() {
        const stats = cacheManager.getStats();
        return {
            itemCount: stats.itemCount,
            totalSize: stats.totalSize,
            usage: stats.usage
        };
    }

    displayStats() {
        // 추억 통계 표시
        document.getElementById('memoriesStats').innerHTML = `
            <div class="stat-item">
                <span class="stat-label">총 추억:</span>
                <span class="stat-value">${this.stats.memories.total}개</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">총 이미지:</span>
                <span class="stat-value">${this.stats.memories.totalImages}개</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">가장 활발한 작성자:</span>
                <span class="stat-value">${this.getMostActive(this.stats.memories.byAuthor)}</span>
            </div>
        `;

        // 학생 통계 표시
        document.getElementById('studentsStats').innerHTML = `
            <div class="stat-item">
                <span class="stat-label">총 인원:</span>
                <span class="stat-value">${this.stats.students.total}명</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">선생님:</span>
                <span class="stat-value">${this.stats.students.teachers}명</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">학생:</span>
                <span class="stat-value">${this.stats.students.students}명</span>
            </div>
        `;

        // 개발자 통계 표시
        document.getElementById('developersStats').innerHTML = `
            <div class="stat-item">
                <span class="stat-label">총 개발자:</span>
                <span class="stat-value">${this.stats.developers.total}명</span>
            </div>
        `;

        // 사용량 통계 표시
        document.getElementById('usageStats').innerHTML = `
            <div class="stat-item">
                <span class="stat-label">캐시 사용량:</span>
                <span class="stat-value">${this.stats.usage.cacheSize.usage}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">평균 렌더링 시간:</span>
                <span class="stat-value">${this.stats.usage.performanceMetrics.renderTime.avg?.toFixed(2) || 0}ms</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">에러 발생:</span>
                <span class="stat-value">${this.stats.usage.errorCount}건</span>
            </div>
        `;
    }

    getMostActive(groups) {
        let maxCount = 0;
        let mostActive = '없음';
        
        for (const [key, count] of Object.entries(groups)) {
            if (count > maxCount) {
                maxCount = count;
                mostActive = key;
            }
        }
        
        return `${mostActive} (${maxCount}개)`;
    }

    createCharts() {
        // 간단한 차트 구현 (실제로는 Chart.js 등을 사용할 수 있음)
        this.createMemoriesChart();
        this.createRepositoryChart();
    }

    createMemoriesChart() {
        const canvas = document.getElementById('memoriesChart');
        const ctx = canvas.getContext('2d');
        
        // 월별 추억 데이터
        const monthlyData = this.stats.memories.byMonth;
        const months = Object.keys(monthlyData).sort();
        const values = months.map(month => monthlyData[month]);
        
        // 간단한 막대 차트
        canvas.width = 400;
        canvas.height = 200;
        
        ctx.fillStyle = '#667eea';
        const barWidth = canvas.width / months.length;
        const maxValue = Math.max(...values);
        
        values.forEach((value, index) => {
            const barHeight = (value / maxValue) * (canvas.height - 40);
            ctx.fillRect(index * barWidth, canvas.height - barHeight - 20, barWidth - 2, barHeight);
            
            // 라벨
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.fillText(months[index].substring(5), index * barWidth + 5, canvas.height - 5);
            ctx.fillText(value.toString(), index * barWidth + 5, canvas.height - barHeight - 25);
            ctx.fillStyle = '#667eea';
        });
    }

    createRepositoryChart() {
        const canvas = document.getElementById('repositoryChart');
        const ctx = canvas.getContext('2d');
        
        // 저장소별 사용량 데이터
        const repoData = this.stats.memories.byRepository;
        const repos = Object.keys(repoData);
        const values = Object.values(repoData);
        
        // 간단한 파이 차트
        canvas.width = 200;
        canvas.height = 200;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 80;
        
        let currentAngle = 0;
        const total = values.reduce((sum, value) => sum + value, 0);
        
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
        
        values.forEach((value, index) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            
            currentAngle += sliceAngle;
        });
    }
}

// 알림 관리자
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.permission = 'default';
    }

    async init() {
        await this.requestPermission();
        this.createNotificationCenter();
    }

    async requestPermission() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
        }
    }

    createNotificationCenter() {
        const notificationCenter = document.createElement('div');
        notificationCenter.className = 'notification-center';
        notificationCenter.innerHTML = `
            <button class="notification-toggle" onclick="utilityFeatures.notificationManager.toggleCenter()">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" id="notificationBadge">0</span>
            </button>
            <div class="notification-dropdown" id="notificationDropdown">
                <div class="notification-header">
                    <h4>알림</h4>
                    <button onclick="utilityFeatures.notificationManager.clearAll()">모두 지우기</button>
                </div>
                <div class="notification-list" id="notificationList">
                    <div class="no-notifications">알림이 없습니다.</div>
                </div>
            </div>
        `;

        // 헤더에 추가
        const header = document.querySelector('.main-header');
        if (header) {
            header.appendChild(notificationCenter);
        }
    }

    toggleCenter() {
        const dropdown = document.getElementById('notificationDropdown');
        dropdown.classList.toggle('show');
    }

    addNotification(title, message, type = 'info', persistent = false) {
        const notification = {
            id: Date.now().toString(),
            title,
            message,
            type,
            timestamp: new Date(),
            read: false,
            persistent
        };

        this.notifications.unshift(notification);
        this.updateNotificationCenter();

        // 브라우저 알림
        if (this.permission === 'granted' && !persistent) {
            new Notification(title, {
                body: message,
                icon: '/favicon.ico'
            });
        }

        // 자동 제거 (persistent가 아닌 경우)
        if (!persistent) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, 5000);
        }
    }

    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.updateNotificationCenter();
    }

    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.updateNotificationCenter();
        }
    }

    clearAll() {
        this.notifications = [];
        this.updateNotificationCenter();
    }

    updateNotificationCenter() {
        const badge = document.getElementById('notificationBadge');
        const list = document.getElementById('notificationList');
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';

        if (this.notifications.length === 0) {
            list.innerHTML = '<div class="no-notifications">알림이 없습니다.</div>';
            return;
        }

        list.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" onclick="utilityFeatures.notificationManager.markAsRead('${notification.id}')">
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
                </div>
                <button class="notification-close" onclick="event.stopPropagation(); utilityFeatures.notificationManager.removeNotification('${notification.id}')">×</button>
            </div>
        `).join('');
    }

    formatTime(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        return `${days}일 전`;
    }
}

// 설정 관리자
class SettingsManager {
    constructor() {
        this.settings = {
            theme: localStorage.getItem('theme') || 'light',
            autoSave: localStorage.getItem('autoSave') === 'true',
            notifications: localStorage.getItem('notifications') !== 'false',
            language: localStorage.getItem('language') || 'ko',
            cacheEnabled: localStorage.getItem('cacheEnabled') !== 'false'
        };
    }

    init() {
        this.createSettingsDialog();
    }

    createSettingsDialog() {
        const settingsModal = document.createElement('div');
        settingsModal.id = 'settingsModal';
        settingsModal.className = 'modal';
        settingsModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>설정</h3>
                    <span class="close" onclick="utilityFeatures.settingsManager.closeSettings()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="settings-section">
                        <h4>일반 설정</h4>
                        <div class="form-group">
                            <label>테마:</label>
                            <select id="themeSetting">
                                <option value="light">라이트</option>
                                <option value="dark">다크</option>
                                <option value="auto">시스템 설정</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="autoSaveSetting">
                                자동 저장
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="notificationsSetting">
                                알림 활성화
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h4>성능 설정</h4>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="cacheEnabledSetting">
                                캐시 활성화
                            </label>
                        </div>
                        <div class="form-group">
                            <label>이미지 품질:</label>
                            <select id="imageQualitySetting">
                                <option value="high">높음</option>
                                <option value="medium">보통</option>
                                <option value="low">낮음</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h4>데이터 관리</h4>
                        <button onclick="utilityFeatures.settingsManager.clearCache()">캐시 지우기</button>
                        <button onclick="utilityFeatures.settingsManager.resetSettings()">설정 초기화</button>
                        <button onclick="utilityFeatures.settingsManager.exportSettings()">설정 내보내기</button>
                    </div>
                </div>
                <div class="modal-actions">
                    <button onclick="utilityFeatures.settingsManager.saveSettings()">저장</button>
                    <button onclick="utilityFeatures.settingsManager.closeSettings()">취소</button>
                </div>
            </div>
        `;

        document.body.appendChild(settingsModal);
    }

    openSettings() {
        this.loadCurrentSettings();
        document.getElementById('settingsModal').style.display = 'block';
    }

    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    loadCurrentSettings() {
        document.getElementById('themeSetting').value = this.settings.theme;
        document.getElementById('autoSaveSetting').checked = this.settings.autoSave;
        document.getElementById('notificationsSetting').checked = this.settings.notifications;
        document.getElementById('cacheEnabledSetting').checked = this.settings.cacheEnabled;
    }

    saveSettings() {
        this.settings.theme = document.getElementById('themeSetting').value;
        this.settings.autoSave = document.getElementById('autoSaveSetting').checked;
        this.settings.notifications = document.getElementById('notificationsSetting').checked;
        this.settings.cacheEnabled = document.getElementById('cacheEnabledSetting').checked;

        // 로컬 스토리지에 저장
        Object.keys(this.settings).forEach(key => {
            localStorage.setItem(key, this.settings[key].toString());
        });

        // 설정 적용
        this.applySettings();

        showToast('설정이 저장되었습니다.', 'success');
        this.closeSettings();
    }

    applySettings() {
        // 테마 적용
        if (this.settings.theme !== 'auto') {
            advancedUI.applyTheme(this.settings.theme);
        }

        // 캐시 설정 적용
        cacheManager.compressionEnabled = this.settings.cacheEnabled;
    }

    clearCache() {
        const confirmed = confirm('모든 캐시 데이터를 삭제하시겠습니까?');
        if (confirmed) {
            cacheManager.clear();
            showToast('캐시가 삭제되었습니다.', 'success');
        }
    }

    resetSettings() {
        const confirmed = confirm('모든 설정을 초기화하시겠습니까?');
        if (confirmed) {
            Object.keys(this.settings).forEach(key => {
                localStorage.removeItem(key);
            });
            
            // 기본값으로 재설정
            this.settings = {
                theme: 'light',
                autoSave: false,
                notifications: true,
                language: 'ko',
                cacheEnabled: true
            };
            
            this.loadCurrentSettings();
            showToast('설정이 초기화되었습니다.', 'success');
        }
    }

    exportSettings() {
        const settingsData = {
            settings: this.settings,
            exportDate: new Date().toISOString()
        };

        utilityFeatures.dataManager.exportData(settingsData, 'settings', 'json');
    }
}

// 전역 인스턴스
const utilityFeatures = new UtilityFeatures();

// 문서 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
    if (!e.target.closest('.utility-menu')) {
        const dropdown = document.getElementById('utilityDropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
    
    if (!e.target.closest('.notification-center')) {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
});


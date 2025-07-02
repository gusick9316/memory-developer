// 추억 관리 전용 모듈
class MemoryManager {
    constructor(githubAPI) {
        this.githubAPI = githubAPI;
        this.memories = [];
    }

    // 모든 추억 데이터 로드
    async loadAllMemories() {
        this.memories = [];
        
        for (const repo of GITHUB_CONFIG.repositories) {
            try {
                const contents = await this.githubAPI.getFolderContents(repo);
                for (const item of contents) {
                    if (item.type === 'dir') {
                        try {
                            const memoryData = await this.githubAPI.loadJSON(repo, `${item.name}/data.json`);
                            if (memoryData) {
                                memoryData.id = item.name;
                                memoryData.repository = repo;
                                this.memories.push(memoryData);
                            }
                        } catch (error) {
                            console.warn(`추억 데이터 로드 실패: ${repo}/${item.name}`, error);
                        }
                    }
                }
            } catch (error) {
                console.warn(`저장소 ${repo} 접근 실패:`, error);
            }
        }
        
        // 날짜순 정렬 (오래된 순)
        this.memories.sort((a, b) => new Date(a.date) - new Date(b.date));
        return this.memories;
    }

    // 새 추억 추가
    async addMemory(memoryData, imageFile) {
        try {
            // 저장소 용량 확인
            const storageSize = await this.githubAPI.getRepositorySize(memoryData.repository);
            if (isStorageNearFull(storageSize)) {
                throw new Error('선택한 저장소의 용량이 부족합니다. 다른 저장소를 선택해주세요.');
            }

            // 파일 크기 확인
            if (imageFile && !validateFileSize(imageFile)) {
                throw new Error('이미지 파일은 25MB 이하여야 합니다.');
            }

            // 고유 폴더 ID 생성
            const folderId = sanitizeFileName(memoryData.title) + '_' + generateUniqueId();
            
            // JSON 데이터 준비
            const jsonData = {
                title: memoryData.title,
                author: memoryData.author,
                date: memoryData.date,
                hasImage: !!imageFile,
                imageFileName: imageFile ? imageFile.name : null,
                createdAt: new Date().toISOString()
            };

            // GitHub에 JSON 파일 저장
            await this.githubAPI.saveJSON(
                memoryData.repository, 
                `${folderId}/data.json`, 
                jsonData, 
                `Add memory: ${memoryData.title}`
            );

            // 이미지 파일 업로드 (있는 경우)
            if (imageFile) {
                const imageExtension = imageFile.name.split('.').pop();
                await this.githubAPI.uploadBinaryFile(
                    memoryData.repository, 
                    `${folderId}/image.${imageExtension}`, 
                    imageFile, 
                    `Add image for: ${memoryData.title}`
                );
            }

            // 로컬 상태 업데이트
            jsonData.id = folderId;
            jsonData.repository = memoryData.repository;
            this.memories.push(jsonData);
            this.memories.sort((a, b) => new Date(a.date) - new Date(b.date));

            return jsonData;

        } catch (error) {
            console.error('추억 추가 실패:', error);
            throw error;
        }
    }

    // 추억 수정
    async updateMemory(memoryId, updatedData) {
        try {
            const memory = this.memories.find(m => m.id === memoryId);
            if (!memory) {
                throw new Error('추억을 찾을 수 없습니다.');
            }

            // 수정된 데이터 준비
            const updatedMemory = {
                ...memory,
                title: updatedData.title || memory.title,
                author: updatedData.author || memory.author,
                date: updatedData.date || memory.date,
                updatedAt: new Date().toISOString()
            };

            // GitHub에 업데이트된 JSON 저장
            await this.githubAPI.saveJSON(
                memory.repository,
                `${memory.id}/data.json`,
                updatedMemory,
                `Update memory: ${updatedMemory.title}`
            );

            // 로컬 상태 업데이트
            const index = this.memories.findIndex(m => m.id === memoryId);
            this.memories[index] = updatedMemory;
            this.memories.sort((a, b) => new Date(a.date) - new Date(b.date));

            return updatedMemory;

        } catch (error) {
            console.error('추억 수정 실패:', error);
            throw error;
        }
    }

    // 추억 삭제
    async deleteMemory(memoryId) {
        try {
            const memory = this.memories.find(m => m.id === memoryId);
            if (!memory) {
                throw new Error('추억을 찾을 수 없습니다.');
            }

            // GitHub에서 폴더 전체 삭제
            await this.githubAPI.deleteFolder(memory.repository, memory.id);

            // 로컬 상태 업데이트
            this.memories = this.memories.filter(m => m.id !== memoryId);

            return true;

        } catch (error) {
            console.error('추억 삭제 실패:', error);
            throw error;
        }
    }

    // 추억 검색
    searchMemories(query) {
        if (!query) return this.memories;
        
        const lowerQuery = query.toLowerCase();
        return this.memories.filter(memory => 
            memory.title.toLowerCase().includes(lowerQuery) ||
            memory.author.toLowerCase().includes(lowerQuery) ||
            memory.date.includes(query)
        );
    }

    // 특정 저장소의 추억들 가져오기
    getMemoriesByRepository(repository) {
        return this.memories.filter(memory => memory.repository === repository);
    }

    // 특정 작성자의 추억들 가져오기
    getMemoriesByAuthor(author) {
        return this.memories.filter(memory => memory.author === author);
    }

    // 날짜 범위로 추억 필터링
    getMemoriesByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return this.memories.filter(memory => {
            const memoryDate = new Date(memory.date);
            return memoryDate >= start && memoryDate <= end;
        });
    }

    // 추억 통계 정보
    getStatistics() {
        const stats = {
            totalMemories: this.memories.length,
            repositoryStats: {},
            authorStats: {},
            monthlyStats: {}
        };

        // 저장소별 통계
        GITHUB_CONFIG.repositories.forEach(repo => {
            stats.repositoryStats[repo] = this.getMemoriesByRepository(repo).length;
        });

        // 작성자별 통계
        this.memories.forEach(memory => {
            stats.authorStats[memory.author] = (stats.authorStats[memory.author] || 0) + 1;
        });

        // 월별 통계
        this.memories.forEach(memory => {
            const month = memory.date.substring(0, 7); // YYYY-MM 형식
            stats.monthlyStats[month] = (stats.monthlyStats[month] || 0) + 1;
        });

        return stats;
    }
}

// 추억 UI 관리 클래스
class MemoryUI {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.currentEditingId = null;
    }

    // 추억 목록 렌더링
    renderMemoriesList(memories = null) {
        const container = document.getElementById('memoriesList');
        const memoriesToRender = memories || this.memoryManager.memories;
        
        container.innerHTML = '';

        if (memoriesToRender.length === 0) {
            container.innerHTML = '<div class="no-content">아직 추억이 없습니다. 첫 번째 추억을 작성해보세요!</div>';
            return;
        }

        memoriesToRender.forEach(memory => {
            const memoryElement = this.createMemoryElement(memory);
            container.appendChild(memoryElement);
        });
    }

    // 개별 추억 요소 생성 (이미지 클릭 기능 추가)
    createMemoryElement(memory) {
        const div = document.createElement('div');
        div.className = 'memory-item fade-in';
        div.setAttribute('data-memory-id', memory.id);

        const imageUrl = memory.hasImage ? 
            `https://raw.githubusercontent.com/${GITHUB_CONFIG.username}/${memory.repository}/main/${memory.id}/image.${memory.imageFileName.split('.').pop()}` : '';

        div.innerHTML = `
            <h3>${this.escapeHtml(memory.title)}</h3>
            <div class="memory-meta">
                <span class="author">${this.escapeHtml(memory.author)}</span> • 
                <span class="date">${memory.date}</span> • 
                <span class="repository">${memory.repository}</span>
            </div>
            ${memory.hasImage ? `<img src="${imageUrl}" alt="${this.escapeHtml(memory.title)}" class="memory-image" loading="lazy" onclick="showImageModal('${imageUrl}', '${this.escapeHtml(memory.title)}')" onerror="handleImageError(this)">` : ''}
            <div class="item-actions">
                <button class="edit-btn" onclick="memoryUI.showEditModal('${memory.id}')">수정</button>
                <button class="delete-btn" onclick="memoryUI.confirmDelete('${memory.id}')">삭제</button>
            </div>
        `;

        return div;
    }

    // 수정 모달 표시
    showEditModal(memoryId) {
        const memory = this.memoryManager.memories.find(m => m.id === memoryId);
        if (!memory) return;

        this.currentEditingId = memoryId;
        const modal = document.getElementById('editModal');
        const modalContent = document.getElementById('editModalContent');

        const [year, month, day] = memory.date.split('-');

        modalContent.innerHTML = `
            <h3>추억 수정</h3>
            <div class="form-group">
                <label>제목</label>
                <input type="text" id="editTitle" value="${this.escapeHtml(memory.title)}">
            </div>
            <div class="form-group">
                <label>작성자</label>
                <input type="text" id="editAuthor" value="${this.escapeHtml(memory.author)}">
            </div>
            <div class="form-group">
                <label>날짜</label>
                <div class="date-inputs">
                    <input type="number" id="editYear" value="${year}" min="2000" max="2030">
                    <input type="number" id="editMonth" value="${parseInt(month)}" min="1" max="12">
                    <input type="number" id="editDay" value="${parseInt(day)}" min="1" max="31">
                </div>
            </div>
            <div class="form-actions">
                <button onclick="memoryUI.saveEdit()">저장</button>
                <button onclick="memoryUI.closeEditModal()">취소</button>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    // 수정 저장
    async saveEdit() {
        if (!this.currentEditingId) return;

        const title = document.getElementById('editTitle').value.trim();
        const author = document.getElementById('editAuthor').value.trim();
        const year = document.getElementById('editYear').value;
        const month = document.getElementById('editMonth').value.padStart(2, '0');
        const day = document.getElementById('editDay').value.padStart(2, '0');

        if (!title || !author || !year || !month || !day) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        try {
            const updatedData = {
                title,
                author,
                date: `${year}-${month}-${day}`
            };

            await this.memoryManager.updateMemory(this.currentEditingId, updatedData);
            this.renderMemoriesList();
            this.closeEditModal();
            
            showNotification('추억이 성공적으로 수정되었습니다!', 'success');

        } catch (error) {
            console.error('수정 실패:', error);
            alert('수정에 실패했습니다: ' + error.message);
        }
    }

    // 삭제 확인
    confirmDelete(memoryId) {
        const memory = this.memoryManager.memories.find(m => m.id === memoryId);
        if (!memory) return;

        if (confirm(`정말로 "${memory.title}" 추억을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
            this.deleteMemory(memoryId);
        }
    }

    // 추억 삭제
    async deleteMemory(memoryId) {
        try {
            await this.memoryManager.deleteMemory(memoryId);
            this.renderMemoriesList();
            
            showNotification('추억이 삭제되었습니다.', 'success');

        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제에 실패했습니다: ' + error.message);
        }
    }

    // 모달 닫기
    closeEditModal() {
        document.getElementById('editModal').classList.add('hidden');
        this.currentEditingId = null;
    }

    // HTML 이스케이프
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 알림 표시 함수
function showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // 스타일 적용
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;

    // 타입별 색상
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    // DOM에 추가
    document.body.appendChild(notification);

    // 3초 후 자동 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// CSS 애니메이션 추가
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .no-content {
            text-align: center;
            padding: 3rem;
            color: #666;
            font-size: 1.1rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(style);
}


// 추억 관리 기능
class MemoriesManager {
    constructor() {
        this.memories = [];
        this.editingMemory = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 추억 추가 버튼
        document.getElementById('add-memory-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        // 추억 폼 제출
        document.getElementById('memory-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // 삭제 버튼
        document.getElementById('memory-delete').addEventListener('click', () => {
            this.handleDelete();
        });
    }

    showAddModal() {
        this.editingMemory = null;
        window.uiManager.showModal('memory-modal', '추억 추가');
        
        // 폼 초기화
        const form = document.getElementById('memory-form');
        form.reset();
        
        // 버튼 텍스트 변경
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '추가';
        
        // 삭제 버튼 숨기기
        document.getElementById('memory-delete').style.display = 'none';
    }

    showEditModal(memory) {
        this.editingMemory = memory;
        window.uiManager.showModal('memory-modal', '추억 수정');
        
        // 폼에 기존 데이터 채우기
        document.getElementById('memory-title').value = memory.title;
        document.getElementById('memory-author').value = memory.author;
        document.getElementById('memory-year').value = memory.year;
        document.getElementById('memory-month').value = memory.month;
        document.getElementById('memory-day').value = memory.day;
        
        // 버튼 텍스트 변경
        const submitBtn = document.querySelector('#memory-form button[type="submit"]');
        submitBtn.textContent = '수정';
        
        // 삭제 버튼 표시
        document.getElementById('memory-delete').style.display = 'block';
        
        // 이미지 파일 입력은 선택사항으로 변경
        const imageInput = document.getElementById('memory-image');
        imageInput.required = false;
    }

    async handleSubmit() {
        const form = document.getElementById('memory-form');
        
        const title = document.getElementById('memory-title').value.trim();
        const author = document.getElementById('memory-author').value.trim();
        const year = parseInt(document.getElementById('memory-year').value);
        const month = parseInt(document.getElementById('memory-month').value);
        const day = parseInt(document.getElementById('memory-day').value);
        const imageFile = document.getElementById('memory-image').files[0];

        // 유효성 검사
        if (!title || !author || !year || !month || !day) {
            window.uiManager.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        if (month < 1 || month > 12) {
            window.uiManager.showNotification('월은 1-12 사이의 값이어야 합니다.', 'error');
            return;
        }

        if (day < 1 || day > 31) {
            window.uiManager.showNotification('일은 1-31 사이의 값이어야 합니다.', 'error');
            return;
        }

        // 새 추억 추가 시 이미지 필수
        if (!this.editingMemory && (!imageFile || imageFile.size === 0)) {
            window.uiManager.showNotification('이미지를 선택해주세요.', 'error');
            return;
        }

        // 이미지 파일 유효성 검사 (파일이 있는 경우)
        if (imageFile && imageFile.size > 0) {
            if (!window.uiManager.validateImageFile(imageFile)) {
                return;
            }
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            if (this.editingMemory) {
                await this.updateMemory(title, author, year, month, day, imageFile);
            } else {
                await this.addMemory(title, author, year, month, day, imageFile);
            }
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('추억이 저장되었습니다.', 'success');
            await this.loadMemories();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to save memory:', error);
            window.uiManager.showNotification('저장에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async addMemory(title, author, year, month, day, imageFile) {
        const folderName = window.githubAPI.sanitizeFolderName(title);
        const date = window.githubAPI.formatDate(year, month, day);
        
        // 이미지 업로드
        const imageData = await window.githubAPI.fileToBase64(imageFile);
        const imageExtension = imageFile.name.split('.').pop();
        const imagePath = `추억/${folderName}/image.${imageExtension}`;
        
        await window.githubAPI.uploadImage(
            imagePath,
            imageData,
            `Add memory image: ${title}`
        );

        // 메타데이터 저장
        const memoryData = {
            title,
            author,
            year,
            month,
            day,
            date,
            imagePath,
            createdAt: new Date().toISOString()
        };

        await window.githubAPI.createOrUpdateFile(
            `추억/${folderName}/data.json`,
            memoryData,
            `Add memory: ${title}`
        );
    }

    async updateMemory(title, author, year, month, day, imageFile) {
        const memory = this.editingMemory;
        const oldFolderName = window.githubAPI.sanitizeFolderName(memory.title);
        const newFolderName = window.githubAPI.sanitizeFolderName(title);
        const date = window.githubAPI.formatDate(year, month, day);

        let imagePath = memory.imagePath;

        // 이미지가 변경된 경우
        if (imageFile && imageFile.size > 0) {
            const imageData = await window.githubAPI.fileToBase64(imageFile);
            const imageExtension = imageFile.name.split('.').pop();
            imagePath = `추억/${newFolderName}/image.${imageExtension}`;
            
            await window.githubAPI.uploadImage(
                imagePath,
                imageData,
                `Update memory image: ${title}`
            );
        } else if (oldFolderName !== newFolderName) {
            // 폴더명이 변경되었지만 이미지는 그대로인 경우
            const imageExtension = memory.imagePath.split('.').pop();
            imagePath = `추억/${newFolderName}/image.${imageExtension}`;
        }

        // 메타데이터 업데이트
        const memoryData = {
            title,
            author,
            year,
            month,
            day,
            date,
            imagePath,
            createdAt: memory.createdAt,
            updatedAt: new Date().toISOString()
        };

        await window.githubAPI.createOrUpdateFile(
            `추억/${newFolderName}/data.json`,
            memoryData,
            `Update memory: ${title}`
        );

        // 폴더명이 변경된 경우 기존 폴더 삭제
        if (oldFolderName !== newFolderName) {
            await window.githubAPI.deleteFolder(`추억/${oldFolderName}`);
        }
    }

    async handleDelete() {
        if (!this.editingMemory) return;

        if (!confirm('정말로 이 추억을 삭제하시겠습니까?')) {
            return;
        }

        const deleteBtn = document.getElementById('memory-delete');
        const stopLoading = window.uiManager.showLoading(deleteBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(this.editingMemory.title);
            await window.githubAPI.deleteFolder(`추억/${folderName}`);
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('추억이 삭제되었습니다.', 'success');
            await this.loadMemories();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to delete memory:', error);
            window.uiManager.showNotification('삭제에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async loadMemories() {
        try {
            const folders = await window.githubAPI.listFolderContents('추억');
            this.memories = [];

            for (const folder of folders) {
                if (folder.type === 'dir') {
                    const memoryData = await window.githubAPI.getFileContent(`추억/${folder.name}/data.json`);
                    if (memoryData) {
                        this.memories.push(memoryData);
                    }
                }
            }

            // 날짜순 정렬 (오래된 것부터)
            this.memories.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            this.renderMemories();
            
        } catch (error) {
            console.error('Failed to load memories:', error);
        }
    }

    async renderMemories() {
        const container = document.getElementById('memories-list');
        container.innerHTML = '';

        if (this.memories.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #718096;">
                    <p>아직 추억이 없습니다.</p>
                    <p>첫 번째 추억을 추가해보세요!</p>
                </div>
            `;
            return;
        }

        for (const memory of this.memories) {
            const memoryElement = await this.createMemoryElement(memory);
            container.appendChild(memoryElement);
        }
    }

    async createMemoryElement(memory) {
        const div = document.createElement('div');
        div.className = 'memory-item fade-in';
        
        const imageUrl = await window.githubAPI.getImageUrl(memory.imagePath);
        
        div.innerHTML = `
            <div class="memory-header">
                <h3 class="memory-title">${memory.title}</h3>
                <div class="memory-meta">${memory.author}, ${memory.date}</div>
            </div>
            <img src="${imageUrl}" alt="${memory.title}" class="memory-image" loading="lazy" />
            <div class="memory-actions">
                <button class="edit-btn" onclick="window.memoriesManager.showEditModal(${JSON.stringify(memory).replace(/"/g, '&quot;')})">
                    수정
                </button>
            </div>
        `;

        return div;
    }
}

// 전역 추억 매니저 인스턴스
window.memoriesManager = new MemoriesManager();


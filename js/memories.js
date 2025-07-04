class MemoriesManager {
    constructor() {
        this.memories = [];
        this.editingMemory = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('add-memory-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        document.getElementById('memory-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingMemory) {
                this.handleUpdate();
            } else {
                this.handleAdd();
            }
        });

        document.getElementById('memory-delete').addEventListener('click', () => {
            this.handleDelete();
        });

        document.getElementById('memory-image').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    showAddModal() {
        this.editingMemory = null;
        document.getElementById('memory-modal-title').textContent = '추억 추가';
        document.getElementById('memory-form').reset();
        document.getElementById('memory-image-preview').innerHTML = '';
        document.getElementById('memory-delete').style.display = 'none';
        document.querySelector('#memory-form button[type="submit"]').textContent = '추가';
        
        // 현재 날짜로 기본값 설정
        const now = new Date();
        document.getElementById('memory-year').value = now.getFullYear();
        document.getElementById('memory-month').value = (now.getMonth() + 1).toString().padStart(2, '0');
        document.getElementById('memory-day').value = now.getDate().toString().padStart(2, '0');
        
        window.uiManager.showModal('memory-modal');
    }

    showEditModal(memory) {
        this.editingMemory = memory;
        document.getElementById('memory-modal-title').textContent = '추억 수정';
        
        // 폼에 데이터 채우기
        document.getElementById('memory-title').value = memory.title;
        document.getElementById('memory-author').value = memory.author;
        document.getElementById('memory-year').value = memory.year || memory.date.split('-')[0];
        document.getElementById('memory-month').value = memory.month || memory.date.split('-')[1];
        document.getElementById('memory-day').value = memory.day || memory.date.split('-')[2];
        
        // 이미지 미리보기 설정
        const previewContainer = document.getElementById('memory-image-preview');
        previewContainer.innerHTML = '';
        
        if (memory.imagePath) {
            const img = document.createElement('img');
            img.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${memory.imagePath}`;
            previewContainer.appendChild(img);
        }
        
        // 삭제 버튼 표시
        document.getElementById('memory-delete').style.display = 'block';
        
        // 제출 버튼 텍스트 변경
        document.querySelector('#memory-form button[type="submit"]').textContent = '수정';
        
        window.uiManager.showModal('memory-modal');
    }

    async handleAdd() {
        const title = document.getElementById('memory-title').value.trim();
        const author = document.getElementById('memory-author').value.trim();
        const year = document.getElementById('memory-year').value;
        const month = document.getElementById('memory-month').value;
        const day = document.getElementById('memory-day').value;
        const imageFile = document.getElementById('memory-image').files[0];

        if (!title || !author || !year || !month || !day || !imageFile) {
            window.uiManager.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        if (imageFile.size > 10 * 1024 * 1024) {
            window.uiManager.showNotification('이미지 크기는 10MB를 초과할 수 없습니다.', 'error');
            return;
        }

        const submitBtn = document.querySelector('#memory-form button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
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
            
            // 메타데이터 생성
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
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('추억이 추가되었습니다.', 'success');
            await this.loadMemories();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to add memory:', error);
            window.uiManager.showNotification('추가에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async handleUpdate() {
        const title = document.getElementById('memory-title').value.trim();
        const author = document.getElementById('memory-author').value.trim();
        const year = document.getElementById('memory-year').value;
        const month = document.getElementById('memory-month').value;
        const day = document.getElementById('memory-day').value;
        const imageFile = document.getElementById('memory-image').files[0];

        if (!title || !author || !year || !month || !day) {
            window.uiManager.showNotification('제목, 작성자, 날짜는 필수 입력 항목입니다.', 'error');
            return;
        }

        const submitBtn = document.querySelector('#memory-form button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            const memory = this.editingMemory;
            const oldFolderName = window.githubAPI.sanitizeFolderName(memory.title);
            const newFolderName = window.githubAPI.sanitizeFolderName(title);
            const date = window.githubAPI.formatDate(year, month, day);

            // 중요: 폴더명이 변경되더라도 기존 폴더는 유지하고 새 폴더에 파일 생성
            let imagePath = memory.imagePath;

            // 이미지가 변경된 경우
            if (imageFile && imageFile.size > 0) {
                const imageData = await window.githubAPI.fileToBase64(imageFile);
                const imageExtension = imageFile.name.split('.').pop();
                
                // 폴더명이 변경된 경우 새 폴더에 이미지 저장
                if (oldFolderName !== newFolderName) {
                    imagePath = `추억/${newFolderName}/image.${imageExtension}`;
                } else {
                    // 폴더명이 같은 경우 기존 폴더에 이미지 덮어쓰기
                    imagePath = `추억/${oldFolderName}/image.${imageExtension}`;
                }
                
                await window.githubAPI.uploadImage(
                    imagePath,
                    imageData,
                    `Update memory image: ${title}`
                );
            } else if (oldFolderName !== newFolderName) {
                // 폴더명이 변경되었지만 이미지는 그대로인 경우
                // 기존 이미지를 새 폴더로 복사
                const imageExtension = memory.imagePath.split('.').pop();
                const newImagePath = `추억/${newFolderName}/image.${imageExtension}`;
                
                // 기존 이미지 내용 가져오기
                const oldImageContent = await window.githubAPI.getFileContent(memory.imagePath);
                
                if (oldImageContent) {
                    // 새 폴더에 이미지 복사
                    await window.githubAPI.uploadImage(
                        newImagePath,
                        oldImageContent,
                        `Copy memory image: ${title}`
                    );
                    imagePath = newImagePath;
                }
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

            // 새 폴더에 데이터 저장
            await window.githubAPI.createOrUpdateFile(
                `추억/${newFolderName}/data.json`,
                memoryData,
                `Update memory: ${title}`
            );

            window.uiManager.closeModal();
            window.uiManager.showNotification('추억이 수정되었습니다.', 'success');
            await this.loadMemories();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to update memory:', error);
            window.uiManager.showNotification('수정에 실패했습니다.', 'error');
        } finally {
            stopLoading();
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

    handleImagePreview(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            window.uiManager.showNotification('이미지 크기는 10MB를 초과할 수 없습니다.', 'error');
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const previewContainer = document.getElementById('memory-image-preview');
            previewContainer.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    async loadMemories() {
        try {
            const folders = await window.githubAPI.listFolderContents('추억');
            this.memories = [];
            
            for (const folder of folders) {
                if (folder.type === 'dir') {
                    try {
                        const dataPath = `${folder.path}/data.json`;
                        const memory = await window.githubAPI.getFileContent(dataPath);
                        if (memory) {
                            this.memories.push(memory);
                        }
                    } catch (error) {
                        console.error(`Failed to load memory from ${folder.path}:`, error);
                    }
                }
            }
            
            // 정렬: 최신순 (날짜 기준)
            this.memories.sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });
            
            this.renderMemories();
        } catch (error) {
            console.error('Failed to load memories:', error);
            window.uiManager.showNotification('추억을 불러오는데 실패했습니다.', 'error');
        }
    }

    renderMemories() {
        const container = document.getElementById('memories-list');
        container.innerHTML = '';
        
        if (this.memories.length === 0) {
            container.innerHTML = '<div class="empty-message">추억이 없습니다. 새로운 추억을 추가해보세요!</div>';
            return;
        }
        
        for (const memory of this.memories) {
            const memoryElement = document.createElement('div');
            memoryElement.className = 'memory-item';
            
            const header = document.createElement('div');
            header.className = 'memory-header';
            
            const title = document.createElement('h3');
            title.className = 'memory-title';
            title.textContent = memory.title;
            
            const meta = document.createElement('div');
            meta.className = 'memory-meta';
            meta.textContent = `${memory.author} · ${memory.date}`;
            
            header.appendChild(title);
            header.appendChild(meta);
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'memory-image-container';
            
            if (memory.imagePath) {
                const image = document.createElement('img');
                image.className = 'memory-image';
                image.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${memory.imagePath}`;
                image.alt = memory.title;
                image.loading = 'lazy';
                imageContainer.appendChild(image);
            }
            
            const actions = document.createElement('div');
            actions.className = 'memory-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '수정';
            editBtn.addEventListener('click', () => {
                this.showEditModal(memory);
            });
            
            actions.appendChild(editBtn);
            
            memoryElement.appendChild(header);
            memoryElement.appendChild(imageContainer);
            memoryElement.appendChild(actions);
            
            container.appendChild(memoryElement);
        }
    }
}

window.memoriesManager = new MemoriesManager();


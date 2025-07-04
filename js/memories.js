class MemoriesManager {
    constructor() {
        this.memories = [];
        this.editingMemory = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 추가 버튼 이벤트
        document.getElementById('add-memory-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        // 폼 제출 이벤트
        document.getElementById('memory-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingMemory) {
                this.handleUpdate();
            } else {
                this.handleAdd();
            }
        });

        // 삭제 버튼 이벤트
        document.getElementById('memory-delete').addEventListener('click', () => {
            this.handleDelete();
        });

        // 이미지 미리보기
        document.getElementById('memory-image').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    showAddModal() {
        this.editingMemory = null;
        window.uiManager.showModal('memory-modal', '추억 추가');
        
        // 현재 날짜로 기본값 설정
        const now = new Date();
        document.getElementById('memory-year').value = now.getFullYear();
        document.getElementById('memory-month').value = now.getMonth() + 1;
        document.getElementById('memory-day').value = now.getDate();
    }

    showEditModal(memory) {
        this.editingMemory = memory;
        window.uiManager.showModal('memory-modal', '추억 수정');

        // 폼에 데이터 채우기
        document.getElementById('memory-title').value = memory.title;
        document.getElementById('memory-author').value = memory.author;
        
        // 날짜 파싱
        const dateParts = memory.date.split('-');
        document.getElementById('memory-year').value = dateParts[0];
        document.getElementById('memory-month').value = dateParts[1];
        document.getElementById('memory-day').value = dateParts[2];

        // 이미지 미리보기 설정
        const previewContainer = document.getElementById('memory-image-preview');
        previewContainer.innerHTML = '';
        
        if (memory.imagePath) {
            const img = document.createElement('img');
            img.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${memory.imagePath}`;
            previewContainer.appendChild(img);
        }

        // 파일 입력 라벨 변경
        const fileLabel = document.querySelector('label[for="memory-image"]');
        fileLabel.textContent = '사진 변경 (최대 10MB)';

        // 삭제 버튼 표시
        document.getElementById('memory-delete').style.display = 'block';
        
        // 제출 버튼 텍스트 변경
        document.querySelector('#memory-form button[type="submit"]').textContent = '수정';
    }

    async handleAdd() {
        try {
            const title = document.getElementById('memory-title').value.trim();
            const author = document.getElementById('memory-author').value.trim();
            const year = document.getElementById('memory-year').value.padStart(4, '0');
            const month = document.getElementById('memory-month').value.padStart(2, '0');
            const day = document.getElementById('memory-day').value.padStart(2, '0');
            const date = `${year}-${month}-${day}`;
            const imageFile = document.getElementById('memory-image').files[0];

            if (!title || !author || !year || !month || !day || !imageFile) {
                alert('모든 필드를 입력해주세요.');
                return;
            }

            // 이미지 크기 확인 (10MB 제한)
            if (imageFile.size > 10 * 1024 * 1024) {
                alert('이미지 크기는 10MB를 초과할 수 없습니다.');
                return;
            }

            // 로딩 상태 표시
            const submitBtn = document.querySelector('#memory-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '처리 중...';
            submitBtn.disabled = true;

            // 폴더명 생성
            const folderName = window.githubAPI.sanitizeFolderName(title);
            
            // 이미지 확장자 추출
            const imageExtension = imageFile.name.split('.').pop().toLowerCase();
            
            // 이미지 Base64로 변환
            const imageBase64 = await this.readFileAsBase64(imageFile);
            
            // 이미지 업로드
            const imagePath = `추억/${folderName}/image.${imageExtension}`;
            await window.githubAPI.uploadImage(imagePath, imageBase64, `Add memory image: ${title}`);
            
            // 메모리 데이터 생성
            const memory = {
                title,
                author,
                date,
                imagePath,
                createdAt: new Date().toISOString()
            };
            
            // JSON 파일 업로드
            await window.githubAPI.uploadFile(
                `추억/${folderName}/data.json`,
                JSON.stringify(memory, null, 2),
                `Add memory data: ${title}`
            );
            
            // 메모리 목록에 추가
            this.memories.push(memory);
            
            // UI 업데이트
            this.renderMemories();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('추억이 추가되었습니다.', 'success');
            
            // 저장소 크기 업데이트
            this.updateStorageUsage();
        } catch (error) {
            console.error('추억 추가 오류:', error);
            alert('추억을 추가하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = document.querySelector('#memory-form button[type="submit"]');
            submitBtn.textContent = '추가';
            submitBtn.disabled = false;
        }
    }

    async handleUpdate() {
        try {
            const title = document.getElementById('memory-title').value.trim();
            const author = document.getElementById('memory-author').value.trim();
            const year = document.getElementById('memory-year').value.padStart(4, '0');
            const month = document.getElementById('memory-month').value.padStart(2, '0');
            const day = document.getElementById('memory-day').value.padStart(2, '0');
            const date = `${year}-${month}-${day}`;
            const imageFile = document.getElementById('memory-image').files[0];

            if (!title || !author || !year || !month || !day) {
                alert('제목, 작성자, 날짜는 필수 입력 항목입니다.');
                return;
            }

            // 로딩 상태 표시
            const submitBtn = document.querySelector('#memory-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '처리 중...';
            submitBtn.disabled = true;

            // 기존 폴더명
            const oldFolderName = window.githubAPI.sanitizeFolderName(this.editingMemory.title);
            
            // 새 폴더명
            const newFolderName = window.githubAPI.sanitizeFolderName(title);
            
            // 이미지 경로 설정
            let imagePath = this.editingMemory.imagePath;
            
            // 이미지가 변경된 경우
            if (imageFile) {
                // 이미지 크기 확인 (10MB 제한)
                if (imageFile.size > 10 * 1024 * 1024) {
                    alert('이미지 크기는 10MB를 초과할 수 없습니다.');
                    return;
                }
                
                // 이미지 확장자 추출
                const imageExtension = imageFile.name.split('.').pop().toLowerCase();
                
                // 이미지 Base64로 변환
                const imageBase64 = await this.readFileAsBase64(imageFile);
                
                // 이미지 업로드 (폴더명이 변경된 경우 새 경로에 업로드)
                imagePath = `추억/${newFolderName}/image.${imageExtension}`;
                await window.githubAPI.uploadImage(imagePath, imageBase64, `Update memory image: ${title}`);
            } 
            // 폴더명이 변경된 경우에만 이미지 경로 업데이트
            else if (oldFolderName !== newFolderName && this.editingMemory.imagePath) {
                // 이미지 확장자 추출
                const imageExtension = this.editingMemory.imagePath.split('.').pop();
                
                // 기존 이미지 내용 가져오기
                const oldImageContent = await window.githubAPI.getFileContent(this.editingMemory.imagePath);
                
                if (oldImageContent) {
                    // 새 경로에 이미지 업로드
                    imagePath = `추억/${newFolderName}/image.${imageExtension}`;
                    await window.githubAPI.uploadImage(imagePath, oldImageContent, `Move memory image: ${title}`);
                }
            }
            
            // 메모리 데이터 업데이트
            const updatedMemory = {
                ...this.editingMemory,
                title,
                author,
                date,
                imagePath,
                updatedAt: new Date().toISOString()
            };
            
            // JSON 파일 업로드
            await window.githubAPI.uploadFile(
                `추억/${newFolderName}/data.json`,
                JSON.stringify(updatedMemory, null, 2),
                `Update memory data: ${title}`
            );
            
            // 메모리 목록 업데이트
            const index = this.memories.findIndex(m => 
                m.title === this.editingMemory.title && 
                m.author === this.editingMemory.author
            );
            
            if (index !== -1) {
                this.memories[index] = updatedMemory;
            }
            
            // UI 업데이트
            this.renderMemories();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('추억이 수정되었습니다.', 'success');
            
            // 저장소 크기 업데이트
            this.updateStorageUsage();
        } catch (error) {
            console.error('추억 수정 오류:', error);
            alert('추억을 수정하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = document.querySelector('#memory-form button[type="submit"]');
            submitBtn.textContent = '수정';
            submitBtn.disabled = false;
        }
    }

    async handleDelete() {
        if (!this.editingMemory) return;
        
        if (!confirm('정말로 이 추억을 삭제하시겠습니까?')) {
            return;
        }
        
        try {
            // 로딩 상태 표시
            const deleteBtn = document.getElementById('memory-delete');
            const originalText = deleteBtn.textContent;
            deleteBtn.textContent = '삭제 중...';
            deleteBtn.disabled = true;
            
            // 폴더명 생성
            const folderName = window.githubAPI.sanitizeFolderName(this.editingMemory.title);
            
            // 폴더 삭제
            await window.githubAPI.deleteFolder(`추억/${folderName}`);
            
            // 메모리 목록에서 제거
            this.memories = this.memories.filter(m => 
                m.title !== this.editingMemory.title || 
                m.author !== this.editingMemory.author
            );
            
            // UI 업데이트
            this.renderMemories();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('추억이 삭제되었습니다.', 'success');
            
            // 저장소 크기 업데이트
            this.updateStorageUsage();
        } catch (error) {
            console.error('추억 삭제 오류:', error);
            alert('추억을 삭제하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const deleteBtn = document.getElementById('memory-delete');
            deleteBtn.textContent = '삭제';
            deleteBtn.disabled = false;
        }
    }

    handleImagePreview(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 이미지 크기 확인 (10MB 제한)
        if (file.size > 10 * 1024 * 1024) {
            alert('이미지 크기는 10MB를 초과할 수 없습니다.');
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
            // 추억 폴더 내용 가져오기
            const contents = await window.githubAPI.listFolderContents('추억');
            
            // 폴더만 필터링
            const folders = contents.filter(item => item.type === 'dir');
            
            this.memories = [];
            
            // 각 폴더에서 data.json 파일 가져오기
            for (const folder of folders) {
                try {
                    const dataContent = await window.githubAPI.getFileContent(`${folder.path}/data.json`);
                    if (dataContent) {
                        const memory = JSON.parse(dataContent);
                        this.memories.push(memory);
                    }
                } catch (error) {
                    console.error(`${folder.path} 데이터 로드 오류:`, error);
                }
            }
            
            // 정렬: 오래된 순 (createdAt 기준)
            this.memories.sort((a, b) => {
                return new Date(a.createdAt) - new Date(b.createdAt);
            });
            
            // UI 업데이트
            this.renderMemories();
        } catch (error) {
            console.error('추억 목록 로드 오류:', error);
            throw error;
        }
    }

    renderMemories() {
        const container = document.getElementById('memories-list');
        container.innerHTML = '';
        
        if (this.memories.length === 0) {
            container.innerHTML = '<div class="empty-message">추억이 없습니다. 새로운 추억을 추가해보세요!</div>';
            return;
        }
        
        this.memories.forEach(memory => {
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
        });
    }

    async updateStorageUsage() {
        try {
            const repoSize = await window.githubAPI.getRepoSize();
            const storageElement = document.getElementById('storage-usage');
            storageElement.textContent = `${repoSize}MB`;
            
            if (repoSize > 700) {
                storageElement.style.color = '#e53e3e';
            } else {
                storageElement.style.color = '';
            }
        } catch (error) {
            console.error('저장소 크기 업데이트 오류:', error);
        }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// 전역 인스턴스 생성
window.memoriesManager = new MemoriesManager();


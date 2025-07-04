class DevelopersManager {
    constructor() {
        this.developers = [];
        this.editingDeveloper = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('add-developer-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        document.getElementById('developer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingDeveloper) {
                this.handleUpdate();
            } else {
                this.handleAdd();
            }
        });

        document.getElementById('developer-delete').addEventListener('click', () => {
            this.handleDelete();
        });

        document.getElementById('developer-image').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    showAddModal() {
        this.editingDeveloper = null;
        document.getElementById('developer-modal-title').textContent = '개발자 추가';
        document.getElementById('developer-form').reset();
        document.getElementById('developer-image-preview').innerHTML = '';
        document.getElementById('developer-delete').style.display = 'none';
        document.querySelector('#developer-form button[type="submit"]').textContent = '추가';
        
        window.uiManager.showModal('developer-modal');
    }

    showEditModal(developer) {
        this.editingDeveloper = developer;
        document.getElementById('developer-modal-title').textContent = '개발자 수정';
        
        // 폼에 데이터 채우기
        document.getElementById('developer-name').value = developer.name;
        
        // 이미지 미리보기 설정
        const previewContainer = document.getElementById('developer-image-preview');
        previewContainer.innerHTML = '';
        
        if (developer.imagePath) {
            const img = document.createElement('img');
            img.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${developer.imagePath}`;
            previewContainer.appendChild(img);
        }
        
        // 삭제 버튼 표시
        document.getElementById('developer-delete').style.display = 'block';
        
        // 제출 버튼 텍스트 변경
        document.querySelector('#developer-form button[type="submit"]').textContent = '수정';
        
        window.uiManager.showModal('developer-modal');
    }

    async handleAdd() {
        const name = document.getElementById('developer-name').value.trim();
        const imageFile = document.getElementById('developer-image').files[0];

        if (!name || !imageFile) {
            window.uiManager.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        if (imageFile.size > 10 * 1024 * 1024) {
            window.uiManager.showNotification('이미지 크기는 10MB를 초과할 수 없습니다.', 'error');
            return;
        }

        const submitBtn = document.querySelector('#developer-form button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(name);
            
            // 이미지 업로드
            const imageData = await window.githubAPI.fileToBase64(imageFile);
            const imageExtension = imageFile.name.split('.').pop();
            const imagePath = `개발자/${folderName}/image.${imageExtension}`;
            
            await window.githubAPI.uploadImage(
                imagePath,
                imageData,
                `Add developer image: ${name}`
            );
            
            // 메타데이터 생성
            const developerData = {
                name,
                imagePath,
                order: this.getNextOrder(),
                createdAt: new Date().toISOString()
            };
            
            await window.githubAPI.createOrUpdateFile(
                `개발자/${folderName}/data.json`,
                developerData,
                `Add developer: ${name}`
            );
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('개발자가 추가되었습니다.', 'success');
            await this.loadDevelopers();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to add developer:', error);
            window.uiManager.showNotification('추가에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async handleUpdate() {
        const name = document.getElementById('developer-name').value.trim();
        const imageFile = document.getElementById('developer-image').files[0];

        if (!name) {
            window.uiManager.showNotification('이름은 필수 입력 항목입니다.', 'error');
            return;
        }

        const submitBtn = document.querySelector('#developer-form button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            const developer = this.editingDeveloper;
            const oldFolderName = window.githubAPI.sanitizeFolderName(developer.name);
            const newFolderName = window.githubAPI.sanitizeFolderName(name);

            // 중요: 폴더명이 변경되더라도 기존 폴더는 유지하고 새 폴더에 파일 생성
            let imagePath = developer.imagePath;

            // 이미지가 변경된 경우
            if (imageFile && imageFile.size > 0) {
                const imageData = await window.githubAPI.fileToBase64(imageFile);
                const imageExtension = imageFile.name.split('.').pop();
                
                // 폴더명이 변경된 경우 새 폴더에 이미지 저장
                if (oldFolderName !== newFolderName) {
                    imagePath = `개발자/${newFolderName}/image.${imageExtension}`;
                } else {
                    // 폴더명이 같은 경우 기존 폴더에 이미지 덮어쓰기
                    imagePath = `개발자/${oldFolderName}/image.${imageExtension}`;
                }
                
                await window.githubAPI.uploadImage(
                    imagePath,
                    imageData,
                    `Update developer image: ${name}`
                );
            } else if (oldFolderName !== newFolderName) {
                // 폴더명이 변경되었지만 이미지는 그대로인 경우
                // 기존 이미지를 새 폴더로 복사
                const imageExtension = developer.imagePath.split('.').pop();
                const newImagePath = `개발자/${newFolderName}/image.${imageExtension}`;
                
                // 기존 이미지 내용 가져오기
                const oldImageContent = await window.githubAPI.getFileContent(developer.imagePath);
                
                if (oldImageContent) {
                    // 새 폴더에 이미지 복사
                    await window.githubAPI.uploadImage(
                        newImagePath,
                        oldImageContent,
                        `Copy developer image: ${name}`
                    );
                    imagePath = newImagePath;
                }
            }

            // 메타데이터 업데이트
            const developerData = {
                name,
                imagePath,
                order: developer.order,
                createdAt: developer.createdAt,
                updatedAt: new Date().toISOString()
            };

            // 새 폴더에 데이터 저장
            await window.githubAPI.createOrUpdateFile(
                `개발자/${newFolderName}/data.json`,
                developerData,
                `Update developer: ${name}`
            );

            window.uiManager.closeModal();
            window.uiManager.showNotification('개발자 정보가 수정되었습니다.', 'success');
            await this.loadDevelopers();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to update developer:', error);
            window.uiManager.showNotification('수정에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async handleDelete() {
        if (!this.editingDeveloper) return;

        if (!confirm('정말로 이 개발자 정보를 삭제하시겠습니까?')) {
            return;
        }

        const deleteBtn = document.getElementById('developer-delete');
        const stopLoading = window.uiManager.showLoading(deleteBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(this.editingDeveloper.name);
            await window.githubAPI.deleteFolder(`개발자/${folderName}`);
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('개발자 정보가 삭제되었습니다.', 'success');
            await this.loadDevelopers();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to delete developer:', error);
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
            const previewContainer = document.getElementById('developer-image-preview');
            previewContainer.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    async moveDeveloper(developer, direction) {
        try {
            const currentIndex = this.developers.findIndex(d => d.name === developer.name);
            
            // 이동할 수 없는 경우
            if ((direction === 'up' && currentIndex === 0) || 
                (direction === 'down' && currentIndex === this.developers.length - 1)) {
                window.uiManager.showNotification(`이미 ${direction === 'up' ? '맨 위' : '맨 아래'}에 있습니다.`, 'info');
                return;
            }
            
            // 교환할 개발자 인덱스
            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            const targetDeveloper = this.developers[targetIndex];
            
            // 순서 교환
            const tempOrder = developer.order;
            developer.order = targetDeveloper.order;
            targetDeveloper.order = tempOrder;
            
            // 두 개발자의 데이터 업데이트
            const developerFolderName = window.githubAPI.sanitizeFolderName(developer.name);
            const targetFolderName = window.githubAPI.sanitizeFolderName(targetDeveloper.name);
            
            await window.githubAPI.createOrUpdateFile(
                `개발자/${developerFolderName}/data.json`,
                developer,
                `Update developer order: ${developer.name}`
            );
            
            await window.githubAPI.createOrUpdateFile(
                `개발자/${targetFolderName}/data.json`,
                targetDeveloper,
                `Update developer order: ${targetDeveloper.name}`
            );
            
            window.uiManager.showNotification('개발자 순서가 변경되었습니다.', 'success');
            await this.loadDevelopers();
            
        } catch (error) {
            console.error('Failed to move developer:', error);
            window.uiManager.showNotification('순서 변경에 실패했습니다.', 'error');
        }
    }

    getNextOrder() {
        // 순서대로 정렬
        this.developers.sort((a, b) => a.order - b.order);
        
        // 마지막 개발자의 순서 + 1 또는 0
        return this.developers.length > 0 ? this.developers[this.developers.length - 1].order + 1 : 0;
    }

    async loadDevelopers() {
        try {
            const folders = await window.githubAPI.listFolderContents('개발자');
            this.developers = [];
            
            for (const folder of folders) {
                if (folder.type === 'dir') {
                    try {
                        const dataPath = `${folder.path}/data.json`;
                        const developer = await window.githubAPI.getFileContent(dataPath);
                        if (developer) {
                            this.developers.push(developer);
                        }
                    } catch (error) {
                        console.error(`Failed to load developer from ${folder.path}:`, error);
                    }
                }
            }
            
            // 순서대로 정렬
            this.developers.sort((a, b) => a.order - b.order);
            
            this.renderDevelopers();
        } catch (error) {
            console.error('Failed to load developers:', error);
            window.uiManager.showNotification('개발자 목록을 불러오는데 실패했습니다.', 'error');
        }
    }

    renderDevelopers() {
        const container = document.getElementById('developers-list');
        container.innerHTML = '';
        
        if (this.developers.length === 0) {
            container.innerHTML = '<div class="empty-message">개발자가 없습니다. 새로운 개발자를 추가해보세요!</div>';
            return;
        }
        
        const developersGrid = document.createElement('div');
        developersGrid.className = 'album-view';
        
        for (const developer of this.developers) {
            const developerElement = document.createElement('div');
            developerElement.className = 'developer-item';
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'developer-image-container';
            
            if (developer.imagePath) {
                const image = document.createElement('img');
                image.className = 'developer-image';
                image.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${developer.imagePath}`;
                image.alt = developer.name;
                image.loading = 'lazy';
                imageContainer.appendChild(image);
            }
            
            const info = document.createElement('div');
            info.className = 'developer-info';
            
            const name = document.createElement('h3');
            name.className = 'developer-name';
            name.textContent = developer.name;
            
            info.appendChild(name);
            
            const actions = document.createElement('div');
            actions.className = 'developer-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '수정';
            editBtn.addEventListener('click', () => {
                this.showEditModal(developer);
            });
            
            const upBtn = document.createElement('button');
            upBtn.className = 'order-btn';
            upBtn.textContent = '⬆';
            upBtn.addEventListener('click', () => {
                this.moveDeveloper(developer, 'up');
            });
            
            const downBtn = document.createElement('button');
            downBtn.className = 'order-btn';
            downBtn.textContent = '⬇';
            downBtn.addEventListener('click', () => {
                this.moveDeveloper(developer, 'down');
            });
            
            actions.appendChild(editBtn);
            actions.appendChild(upBtn);
            actions.appendChild(downBtn);
            
            developerElement.appendChild(imageContainer);
            developerElement.appendChild(info);
            developerElement.appendChild(actions);
            
            developersGrid.appendChild(developerElement);
        }
        
        container.appendChild(developersGrid);
    }
}

window.developersManager = new DevelopersManager();


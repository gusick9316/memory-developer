class StudentsManager {
    constructor() {
        this.students = [];
        this.editingStudent = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('add-student-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        document.getElementById('student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingStudent) {
                this.handleUpdate();
            } else {
                this.handleAdd();
            }
        });

        document.getElementById('student-delete').addEventListener('click', () => {
            this.handleDelete();
        });

        document.getElementById('student-image').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    showAddModal() {
        this.editingStudent = null;
        document.getElementById('student-modal-title').textContent = '학생 추가';
        document.getElementById('student-form').reset();
        document.getElementById('student-image-preview').innerHTML = '';
        document.getElementById('student-delete').style.display = 'none';
        document.querySelector('#student-form button[type="submit"]').textContent = '추가';
        
        window.uiManager.showModal('student-modal');
    }

    showEditModal(student) {
        this.editingStudent = student;
        document.getElementById('student-modal-title').textContent = '학생 수정';
        
        // 폼에 데이터 채우기
        document.getElementById('student-name').value = student.name;
        document.getElementById('student-type').value = student.type;
        
        // 이미지 미리보기 설정
        const previewContainer = document.getElementById('student-image-preview');
        previewContainer.innerHTML = '';
        
        if (student.imagePath) {
            const img = document.createElement('img');
            img.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${student.imagePath}`;
            previewContainer.appendChild(img);
        }
        
        // 삭제 버튼 표시
        document.getElementById('student-delete').style.display = 'block';
        
        // 제출 버튼 텍스트 변경
        document.querySelector('#student-form button[type="submit"]').textContent = '수정';
        
        window.uiManager.showModal('student-modal');
    }

    async handleAdd() {
        const name = document.getElementById('student-name').value.trim();
        const type = document.getElementById('student-type').value;
        const imageFile = document.getElementById('student-image').files[0];

        if (!name || !type || !imageFile) {
            window.uiManager.showNotification('모든 필드를 입력해주세요.', 'error');
            return;
        }

        if (imageFile.size > 10 * 1024 * 1024) {
            window.uiManager.showNotification('이미지 크기는 10MB를 초과할 수 없습니다.', 'error');
            return;
        }

        const submitBtn = document.querySelector('#student-form button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(name);
            
            // 이미지 업로드
            const imageData = await window.githubAPI.fileToBase64(imageFile);
            const imageExtension = imageFile.name.split('.').pop();
            const imagePath = `학생목록/${folderName}/image.${imageExtension}`;
            
            await window.githubAPI.uploadImage(
                imagePath,
                imageData,
                `Add student image: ${name}`
            );
            
            // 메타데이터 생성
            const studentData = {
                name,
                type,
                imagePath,
                order: this.getNextOrder(type),
                createdAt: new Date().toISOString()
            };
            
            await window.githubAPI.createOrUpdateFile(
                `학생목록/${folderName}/data.json`,
                studentData,
                `Add student: ${name}`
            );
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('학생이 추가되었습니다.', 'success');
            await this.loadStudents();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to add student:', error);
            window.uiManager.showNotification('추가에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async handleUpdate() {
        const name = document.getElementById('student-name').value.trim();
        const type = document.getElementById('student-type').value;
        const imageFile = document.getElementById('student-image').files[0];

        if (!name || !type) {
            window.uiManager.showNotification('이름과 유형은 필수 입력 항목입니다.', 'error');
            return;
        }

        const submitBtn = document.querySelector('#student-form button[type="submit"]');
        const stopLoading = window.uiManager.showLoading(submitBtn);

        try {
            const student = this.editingStudent;
            const oldFolderName = window.githubAPI.sanitizeFolderName(student.name);
            const newFolderName = window.githubAPI.sanitizeFolderName(name);

            // 중요: 폴더명이 변경되더라도 기존 폴더는 유지하고 새 폴더에 파일 생성
            let imagePath = student.imagePath;

            // 이미지가 변경된 경우
            if (imageFile && imageFile.size > 0) {
                const imageData = await window.githubAPI.fileToBase64(imageFile);
                const imageExtension = imageFile.name.split('.').pop();
                
                // 폴더명이 변경된 경우 새 폴더에 이미지 저장
                if (oldFolderName !== newFolderName) {
                    imagePath = `학생목록/${newFolderName}/image.${imageExtension}`;
                } else {
                    // 폴더명이 같은 경우 기존 폴더에 이미지 덮어쓰기
                    imagePath = `학생목록/${oldFolderName}/image.${imageExtension}`;
                }
                
                await window.githubAPI.uploadImage(
                    imagePath,
                    imageData,
                    `Update student image: ${name}`
                );
            } else if (oldFolderName !== newFolderName) {
                // 폴더명이 변경되었지만 이미지는 그대로인 경우
                // 기존 이미지를 새 폴더로 복사
                const imageExtension = student.imagePath.split('.').pop();
                const newImagePath = `학생목록/${newFolderName}/image.${imageExtension}`;
                
                // 기존 이미지 내용 가져오기
                const oldImageContent = await window.githubAPI.getFileContent(student.imagePath);
                
                if (oldImageContent) {
                    // 새 폴더에 이미지 복사
                    await window.githubAPI.uploadImage(
                        newImagePath,
                        oldImageContent,
                        `Copy student image: ${name}`
                    );
                    imagePath = newImagePath;
                }
            }

            // 유형이 변경된 경우 순서 재설정
            let order = student.order;
            if (type !== student.type) {
                order = this.getNextOrder(type);
            }

            // 메타데이터 업데이트
            const studentData = {
                name,
                type,
                imagePath,
                order,
                createdAt: student.createdAt,
                updatedAt: new Date().toISOString()
            };

            // 새 폴더에 데이터 저장
            await window.githubAPI.createOrUpdateFile(
                `학생목록/${newFolderName}/data.json`,
                studentData,
                `Update student: ${name}`
            );

            window.uiManager.closeModal();
            window.uiManager.showNotification('학생 정보가 수정되었습니다.', 'success');
            await this.loadStudents();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to update student:', error);
            window.uiManager.showNotification('수정에 실패했습니다.', 'error');
        } finally {
            stopLoading();
        }
    }

    async handleDelete() {
        if (!this.editingStudent) return;

        if (!confirm('정말로 이 학생 정보를 삭제하시겠습니까?')) {
            return;
        }

        const deleteBtn = document.getElementById('student-delete');
        const stopLoading = window.uiManager.showLoading(deleteBtn);

        try {
            const folderName = window.githubAPI.sanitizeFolderName(this.editingStudent.name);
            await window.githubAPI.deleteFolder(`학생목록/${folderName}`);
            
            window.uiManager.closeModal();
            window.uiManager.showNotification('학생 정보가 삭제되었습니다.', 'success');
            await this.loadStudents();
            await window.uiManager.updateStorageInfo();
            
        } catch (error) {
            console.error('Failed to delete student:', error);
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
            const previewContainer = document.getElementById('student-image-preview');
            previewContainer.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    async moveStudent(student, direction) {
        try {
            // 같은 유형의 학생들 필터링
            const sameTypeStudents = this.students.filter(s => s.type === student.type);
            
            // 순서대로 정렬
            sameTypeStudents.sort((a, b) => a.order - b.order);
            
            // 현재 학생의 인덱스 찾기
            const currentIndex = sameTypeStudents.findIndex(s => s.name === student.name);
            
            // 이동할 수 없는 경우
            if ((direction === 'up' && currentIndex === 0) || 
                (direction === 'down' && currentIndex === sameTypeStudents.length - 1)) {
                window.uiManager.showNotification(`이미 ${direction === 'up' ? '맨 위' : '맨 아래'}에 있습니다.`, 'info');
                return;
            }
            
            // 교환할 학생 인덱스
            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            const targetStudent = sameTypeStudents[targetIndex];
            
            // 순서 교환
            const tempOrder = student.order;
            student.order = targetStudent.order;
            targetStudent.order = tempOrder;
            
            // 두 학생의 데이터 업데이트
            const studentFolderName = window.githubAPI.sanitizeFolderName(student.name);
            const targetFolderName = window.githubAPI.sanitizeFolderName(targetStudent.name);
            
            await window.githubAPI.createOrUpdateFile(
                `학생목록/${studentFolderName}/data.json`,
                student,
                `Update student order: ${student.name}`
            );
            
            await window.githubAPI.createOrUpdateFile(
                `학생목록/${targetFolderName}/data.json`,
                targetStudent,
                `Update student order: ${targetStudent.name}`
            );
            
            window.uiManager.showNotification('학생 순서가 변경되었습니다.', 'success');
            await this.loadStudents();
            
        } catch (error) {
            console.error('Failed to move student:', error);
            window.uiManager.showNotification('순서 변경에 실패했습니다.', 'error');
        }
    }

    getNextOrder(type) {
        // 같은 유형의 학생들 필터링
        const sameTypeStudents = this.students.filter(s => s.type === type);
        
        // 순서대로 정렬
        sameTypeStudents.sort((a, b) => a.order - b.order);
        
        // 마지막 학생의 순서 + 1 또는 0
        return sameTypeStudents.length > 0 ? sameTypeStudents[sameTypeStudents.length - 1].order + 1 : 0;
    }

    async loadStudents() {
        try {
            const folders = await window.githubAPI.listFolderContents('학생목록');
            this.students = [];
            
            for (const folder of folders) {
                if (folder.type === 'dir') {
                    try {
                        const dataPath = `${folder.path}/data.json`;
                        const student = await window.githubAPI.getFileContent(dataPath);
                        if (student) {
                            this.students.push(student);
                        }
                    } catch (error) {
                        console.error(`Failed to load student from ${folder.path}:`, error);
                    }
                }
            }
            
            this.renderStudents();
        } catch (error) {
            console.error('Failed to load students:', error);
            window.uiManager.showNotification('학생 목록을 불러오는데 실패했습니다.', 'error');
        }
    }

    renderStudents() {
        const container = document.getElementById('students-list');
        container.innerHTML = '';
        
        if (this.students.length === 0) {
            container.innerHTML = '<div class="empty-message">학생이 없습니다. 새로운 학생을 추가해보세요!</div>';
            return;
        }
        
        // 선생님과 학생 분리
        const teachers = this.students.filter(s => s.type === 'teacher');
        const students = this.students.filter(s => s.type === 'student');
        
        // 순서대로 정렬
        teachers.sort((a, b) => a.order - b.order);
        students.sort((a, b) => a.order - b.order);
        
        // 선생님 섹션
        if (teachers.length > 0) {
            const teachersSection = document.createElement('div');
            teachersSection.className = 'students-section';
            
            const teachersTitle = document.createElement('h3');
            teachersTitle.textContent = '선생님';
            teachersSection.appendChild(teachersTitle);
            
            const teachersGrid = document.createElement('div');
            teachersGrid.className = 'album-view';
            
            for (const teacher of teachers) {
                const teacherElement = this.createStudentElement(teacher);
                teachersGrid.appendChild(teacherElement);
            }
            
            teachersSection.appendChild(teachersGrid);
            container.appendChild(teachersSection);
        }
        
        // 학생 섹션
        if (students.length > 0) {
            const studentsSection = document.createElement('div');
            studentsSection.className = 'students-section';
            
            const studentsTitle = document.createElement('h3');
            studentsTitle.textContent = '학생';
            studentsSection.appendChild(studentsTitle);
            
            const studentsGrid = document.createElement('div');
            studentsGrid.className = 'album-view';
            
            for (const student of students) {
                const studentElement = this.createStudentElement(student);
                studentsGrid.appendChild(studentElement);
            }
            
            studentsSection.appendChild(studentsGrid);
            container.appendChild(studentsSection);
        }
    }

    createStudentElement(student) {
        const studentElement = document.createElement('div');
        studentElement.className = 'student-item';
        
        // 선생님인 경우 추가 스타일
        if (student.type === 'teacher') {
            studentElement.classList.add('teacher-item');
        }
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'student-image-container';
        
        if (student.imagePath) {
            const image = document.createElement('img');
            image.className = 'student-image';
            image.src = `https://raw.githubusercontent.com/${window.authManager.githubUsername}/${window.authManager.githubRepo}/main/${student.imagePath}`;
            image.alt = student.name;
            image.loading = 'lazy';
            imageContainer.appendChild(image);
        }
        
        const info = document.createElement('div');
        info.className = 'student-info';
        
        const name = document.createElement('h3');
        name.className = 'student-name';
        name.textContent = student.name;
        
        const type = document.createElement('div');
        type.className = 'student-type';
        type.textContent = student.type === 'teacher' ? '선생님' : '학생';
        
        info.appendChild(name);
        info.appendChild(type);
        
        const actions = document.createElement('div');
        actions.className = 'student-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '수정';
        editBtn.addEventListener('click', () => {
            this.showEditModal(student);
        });
        
        const upBtn = document.createElement('button');
        upBtn.className = 'order-btn';
        upBtn.textContent = '⬆';
        upBtn.addEventListener('click', () => {
            this.moveStudent(student, 'up');
        });
        
        const downBtn = document.createElement('button');
        downBtn.className = 'order-btn';
        downBtn.textContent = '⬇';
        downBtn.addEventListener('click', () => {
            this.moveStudent(student, 'down');
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        
        studentElement.appendChild(imageContainer);
        studentElement.appendChild(info);
        studentElement.appendChild(actions);
        
        return studentElement;
    }
}

window.studentsManager = new StudentsManager();


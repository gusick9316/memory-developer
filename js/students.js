class StudentsManager {
    constructor() {
        this.students = [];
        this.editingStudent = null;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 추가 버튼 이벤트
        document.getElementById('add-student-btn').addEventListener('click', () => {
            this.showAddModal();
        });

        // 폼 제출 이벤트
        document.getElementById('student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.editingStudent) {
                this.handleUpdate();
            } else {
                this.handleAdd();
            }
        });

        // 삭제 버튼 이벤트
        document.getElementById('student-delete').addEventListener('click', () => {
            this.handleDelete();
        });

        // 이미지 미리보기
        document.getElementById('student-image').addEventListener('change', (e) => {
            this.handleImagePreview(e);
        });
    }

    showAddModal() {
        this.editingStudent = null;
        window.uiManager.showModal('student-modal', '학생 추가');
    }

    showEditModal(student) {
        this.editingStudent = student;
        window.uiManager.showModal('student-modal', '학생 수정');

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

        // 파일 입력 라벨 변경
        const fileLabel = document.querySelector('label[for="student-image"]');
        fileLabel.textContent = '사진 변경 (최대 10MB)';

        // 삭제 버튼 표시
        document.getElementById('student-delete').style.display = 'block';
        
        // 제출 버튼 텍스트 변경
        document.querySelector('#student-form button[type="submit"]').textContent = '수정';
    }

    async handleAdd() {
        try {
            const name = document.getElementById('student-name').value.trim();
            const type = document.getElementById('student-type').value;
            const imageFile = document.getElementById('student-image').files[0];

            if (!name || !type || !imageFile) {
                alert('모든 필드를 입력해주세요.');
                return;
            }

            // 이미지 크기 확인 (10MB 제한)
            if (imageFile.size > 10 * 1024 * 1024) {
                alert('이미지 크기는 10MB를 초과할 수 없습니다.');
                return;
            }

            // 로딩 상태 표시
            const submitBtn = document.querySelector('#student-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '처리 중...';
            submitBtn.disabled = true;

            // 폴더명 생성
            const folderName = window.githubAPI.sanitizeFolderName(name);
            
            // 이미지 확장자 추출
            const imageExtension = imageFile.name.split('.').pop().toLowerCase();
            
            // 이미지 Base64로 변환
            const imageBase64 = await this.readFileAsBase64(imageFile);
            
            // 이미지 업로드
            const imagePath = `학생목록/${folderName}/image.${imageExtension}`;
            await window.githubAPI.uploadImage(imagePath, imageBase64, `Add student image: ${name}`);
            
            // 학생 데이터 생성
            const student = {
                name,
                type,
                imagePath,
                order: this.getNextOrder(type),
                createdAt: new Date().toISOString()
            };
            
            // JSON 파일 업로드
            await window.githubAPI.uploadFile(
                `학생목록/${folderName}/data.json`,
                JSON.stringify(student, null, 2),
                `Add student data: ${name}`
            );
            
            // 학생 목록에 추가
            this.students.push(student);
            
            // UI 업데이트
            this.renderStudents();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('학생이 추가되었습니다.', 'success');
        } catch (error) {
            console.error('학생 추가 오류:', error);
            alert('학생을 추가하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = document.querySelector('#student-form button[type="submit"]');
            submitBtn.textContent = '추가';
            submitBtn.disabled = false;
        }
    }

    async handleUpdate() {
        try {
            const name = document.getElementById('student-name').value.trim();
            const type = document.getElementById('student-type').value;
            const imageFile = document.getElementById('student-image').files[0];

            if (!name || !type) {
                alert('이름과 유형은 필수 입력 항목입니다.');
                return;
            }

            // 로딩 상태 표시
            const submitBtn = document.querySelector('#student-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '처리 중...';
            submitBtn.disabled = true;

            // 기존 폴더명
            const oldFolderName = window.githubAPI.sanitizeFolderName(this.editingStudent.name);
            
            // 새 폴더명
            const newFolderName = window.githubAPI.sanitizeFolderName(name);
            
            // 이미지 경로 설정
            let imagePath = this.editingStudent.imagePath;
            
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
                imagePath = `학생목록/${newFolderName}/image.${imageExtension}`;
                await window.githubAPI.uploadImage(imagePath, imageBase64, `Update student image: ${name}`);
            } 
            // 폴더명이 변경된 경우에만 이미지 경로 업데이트
            else if (oldFolderName !== newFolderName && this.editingStudent.imagePath) {
                // 이미지 확장자 추출
                const imageExtension = this.editingStudent.imagePath.split('.').pop();
                
                // 기존 이미지 내용 가져오기
                const oldImageContent = await window.githubAPI.getFileContent(this.editingStudent.imagePath);
                
                if (oldImageContent) {
                    // 새 경로에 이미지 업로드
                    imagePath = `학생목록/${newFolderName}/image.${imageExtension}`;
                    await window.githubAPI.uploadImage(imagePath, oldImageContent, `Move student image: ${name}`);
                }
            }
            
            // 유형이 변경된 경우 순서 재설정
            let order = this.editingStudent.order;
            if (type !== this.editingStudent.type) {
                order = this.getNextOrder(type);
            }
            
            // 학생 데이터 업데이트
            const updatedStudent = {
                ...this.editingStudent,
                name,
                type,
                imagePath,
                order,
                updatedAt: new Date().toISOString()
            };
            
            // JSON 파일 업로드
            await window.githubAPI.uploadFile(
                `학생목록/${newFolderName}/data.json`,
                JSON.stringify(updatedStudent, null, 2),
                `Update student data: ${name}`
            );
            
            // 학생 목록 업데이트
            const index = this.students.findIndex(s => 
                s.name === this.editingStudent.name && 
                s.type === this.editingStudent.type
            );
            
            if (index !== -1) {
                this.students[index] = updatedStudent;
            }
            
            // UI 업데이트
            this.renderStudents();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('학생 정보가 수정되었습니다.', 'success');
        } catch (error) {
            console.error('학생 수정 오류:', error);
            alert('학생 정보를 수정하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const submitBtn = document.querySelector('#student-form button[type="submit"]');
            submitBtn.textContent = '수정';
            submitBtn.disabled = false;
        }
    }

    async handleDelete() {
        if (!this.editingStudent) return;
        
        if (!confirm('정말로 이 학생을 삭제하시겠습니까?')) {
            return;
        }
        
        try {
            // 로딩 상태 표시
            const deleteBtn = document.getElementById('student-delete');
            const originalText = deleteBtn.textContent;
            deleteBtn.textContent = '삭제 중...';
            deleteBtn.disabled = true;
            
            // 폴더명 생성
            const folderName = window.githubAPI.sanitizeFolderName(this.editingStudent.name);
            
            // 폴더 삭제
            await window.githubAPI.deleteFolder(`학생목록/${folderName}`);
            
            // 학생 목록에서 제거
            this.students = this.students.filter(s => 
                s.name !== this.editingStudent.name || 
                s.type !== this.editingStudent.type
            );
            
            // UI 업데이트
            this.renderStudents();
            
            // 모달 닫기
            window.uiManager.closeModal();
            
            // 알림 표시
            window.uiManager.showNotification('학생이 삭제되었습니다.', 'success');
        } catch (error) {
            console.error('학생 삭제 오류:', error);
            alert('학생을 삭제하는 중 오류가 발생했습니다.');
        } finally {
            // 버튼 상태 복원
            const deleteBtn = document.getElementById('student-delete');
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
            const previewContainer = document.getElementById('student-image-preview');
            previewContainer.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    async moveStudentUp(student) {
        try {
            // 같은 유형의 학생들 필터링
            const sameTypeStudents = this.students.filter(s => s.type === student.type);
            
            // 순서대로 정렬
            sameTypeStudents.sort((a, b) => a.order - b.order);
            
            // 현재 학생의 인덱스 찾기
            const currentIndex = sameTypeStudents.findIndex(s => s.name === student.name);
            
            // 이미 맨 위에 있는 경우
            if (currentIndex === 0) {
                window.uiManager.showNotification('이미 맨 위에 있습니다.', 'info');
                return;
            }
            
            // 위에 있는 학생과 순서 교환
            const prevStudent = sameTypeStudents[currentIndex - 1];
            const tempOrder = student.order;
            
            // 순서 업데이트
            student.order = prevStudent.order;
            prevStudent.order = tempOrder;
            
            // 두 학생의 데이터 업데이트
            await this.updateStudentData(student);
            await this.updateStudentData(prevStudent);
            
            // UI 업데이트
            this.renderStudents();
            
            // 알림 표시
            window.uiManager.showNotification('학생 순서가 변경되었습니다.', 'success');
        } catch (error) {
            console.error('학생 순서 변경 오류:', error);
            alert('학생 순서를 변경하는 중 오류가 발생했습니다.');
        }
    }

    async moveStudentDown(student) {
        try {
            // 같은 유형의 학생들 필터링
            const sameTypeStudents = this.students.filter(s => s.type === student.type);
            
            // 순서대로 정렬
            sameTypeStudents.sort((a, b) => a.order - b.order);
            
            // 현재 학생의 인덱스 찾기
            const currentIndex = sameTypeStudents.findIndex(s => s.name === student.name);
            
            // 이미 맨 아래에 있는 경우
            if (currentIndex === sameTypeStudents.length - 1) {
                window.uiManager.showNotification('이미 맨 아래에 있습니다.', 'info');
                return;
            }
            
            // 아래에 있는 학생과 순서 교환
            const nextStudent = sameTypeStudents[currentIndex + 1];
            const tempOrder = student.order;
            
            // 순서 업데이트
            student.order = nextStudent.order;
            nextStudent.order = tempOrder;
            
            // 두 학생의 데이터 업데이트
            await this.updateStudentData(student);
            await this.updateStudentData(nextStudent);
            
            // UI 업데이트
            this.renderStudents();
            
            // 알림 표시
            window.uiManager.showNotification('학생 순서가 변경되었습니다.', 'success');
        } catch (error) {
            console.error('학생 순서 변경 오류:', error);
            alert('학생 순서를 변경하는 중 오류가 발생했습니다.');
        }
    }

    async updateStudentData(student) {
        // 폴더명 생성
        const folderName = window.githubAPI.sanitizeFolderName(student.name);
        
        // JSON 파일 업로드
        await window.githubAPI.uploadFile(
            `학생목록/${folderName}/data.json`,
            JSON.stringify(student, null, 2),
            `Update student order: ${student.name}`
        );
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
            // 학생목록 폴더 내용 가져오기
            const contents = await window.githubAPI.listFolderContents('학생목록');
            
            // 폴더만 필터링
            const folders = contents.filter(item => item.type === 'dir');
            
            this.students = [];
            
            // 각 폴더에서 data.json 파일 가져오기
            for (const folder of folders) {
                try {
                    const dataContent = await window.githubAPI.getFileContent(`${folder.path}/data.json`);
                    if (dataContent) {
                        const student = JSON.parse(dataContent);
                        this.students.push(student);
                    }
                } catch (error) {
                    console.error(`${folder.path} 데이터 로드 오류:`, error);
                }
            }
            
            // UI 업데이트
            this.renderStudents();
        } catch (error) {
            console.error('학생 목록 로드 오류:', error);
            throw error;
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
            
            teachers.forEach(teacher => {
                const teacherElement = this.createStudentElement(teacher);
                teachersGrid.appendChild(teacherElement);
            });
            
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
            
            students.forEach(student => {
                const studentElement = this.createStudentElement(student);
                studentsGrid.appendChild(studentElement);
            });
            
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
            studentElement.style.border = '2px solid #d69e2e';
            studentElement.style.transform = 'scale(1.05)';
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
            this.moveStudentUp(student);
        });
        
        const downBtn = document.createElement('button');
        downBtn.className = 'order-btn';
        downBtn.textContent = '⬇';
        downBtn.addEventListener('click', () => {
            this.moveStudentDown(student);
        });
        
        actions.appendChild(editBtn);
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        
        studentElement.appendChild(imageContainer);
        studentElement.appendChild(info);
        studentElement.appendChild(actions);
        
        return studentElement;
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
window.studentsManager = new StudentsManager();


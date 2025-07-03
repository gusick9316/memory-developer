// 고급 UI/UX 기능 모듈
class AdvancedUI {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.dragDropManager = new DragDropManager();
        this.imageEditor = new ImageEditor();
        // this.searchManager = new SearchManager(); // 검색 기능 비활성화
        this.keyboardManager = new KeyboardManager();
        this.init();
    }

    init() {
        this.initTheme();
        this.initDragDrop();
        this.initImageEditor();
        // this.initSearch(); // 검색 기능 비활성화
        this.initKeyboardNavigation();
        this.initInfiniteScroll();
    }

    // 테마 관리
    initTheme() {
        this.applyTheme(this.theme);
        this.createThemeToggle();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.theme = theme;
        localStorage.setItem('theme', theme);
    }

    createThemeToggle() {
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = this.theme === 'dark' ? '라이트 모드' : '다크 모드';
        themeToggle.onclick = () => this.toggleTheme();

        // 헤더에 추가
        const header = document.querySelector('.main-header');
        if (header) {
            header.appendChild(themeToggle);
        }
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            toggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
            toggle.title = newTheme === 'dark' ? '라이트 모드' : '다크 모드';
        }
    }

    // 드래그 앤 드롭 초기화
    initDragDrop() {
        this.dragDropManager.init();
    }

    // 이미지 편집기 초기화
    initImageEditor() {
        this.imageEditor.init();
    }

    // 검색 기능 초기화
    initSearch() {
        this.searchManager.init();
    }

    // 키보드 네비게이션 초기화
    initKeyboardNavigation() {
        this.keyboardManager.init();
    }

    // 무한 스크롤 초기화
    initInfiniteScroll() {
        const containers = document.querySelectorAll('.memories-list, .students-list, .developers-list');
        containers.forEach(container => {
            this.setupInfiniteScroll(container);
        });
    }

    setupInfiniteScroll(container) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadMoreContent(container);
                }
            });
        }, { threshold: 0.1 });

        // 센티넬 요소 생성
        const sentinel = document.createElement('div');
        sentinel.className = 'infinite-scroll-sentinel';
        sentinel.style.height = '1px';
        container.appendChild(sentinel);
        observer.observe(sentinel);
    }

    loadMoreContent(container) {
        // 추가 콘텐츠 로딩 로직
        console.log('Loading more content for:', container.className);
    }
}

// 드래그 앤 드롭 매니저
class DragDropManager {
    constructor() {
        this.dropZones = [];
        this.draggedElement = null;
    }

    init() {
        this.setupFileDropZones();
        this.setupSortableLists();
    }

    // 파일 드롭 존 설정
    setupFileDropZones() {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            this.createDropZone(input);
        });
    }

    createDropZone(input) {
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        dropZone.innerHTML = `
            <div class="drop-zone-content">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>파일을 여기에 드래그하거나 클릭하여 선택하세요</p>
                <small>최대 25MB까지 지원</small>
            </div>
        `;

        // 이벤트 리스너
        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        dropZone.addEventListener('drop', (e) => this.handleDrop(e, input));
        dropZone.addEventListener('click', () => input.click());

        // 기존 input 숨기기
        input.style.display = 'none';
        input.parentNode.insertBefore(dropZone, input);

        this.dropZones.push({ dropZone, input });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, input) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        const validFiles = files.filter(file => file.type.startsWith('image/'));

        if (validFiles.length > 0) {
            // FileList 객체 생성
            const dt = new DataTransfer();
            validFiles.forEach(file => dt.items.add(file));
            input.files = dt.files;

            // change 이벤트 발생
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            this.showDropSuccess(e.currentTarget, validFiles.length);
        }
    }

    showDropSuccess(dropZone, fileCount) {
        const content = dropZone.querySelector('.drop-zone-content');
        const originalContent = content.innerHTML;
        
        content.innerHTML = `
            <i class="fas fa-check-circle" style="color: #27ae60;"></i>
            <p>${fileCount}개 파일이 선택되었습니다</p>
        `;

        setTimeout(() => {
            content.innerHTML = originalContent;
        }, 2000);
    }

    // 정렬 가능한 리스트 설정
    setupSortableLists() {
        const sortableLists = document.querySelectorAll('.students-list');
        sortableLists.forEach(list => {
            this.makeSortable(list);
        });
    }

    makeSortable(list) {
        list.addEventListener('dragstart', this.handleDragStart.bind(this));
        list.addEventListener('dragover', this.handleSortDragOver.bind(this));
        list.addEventListener('drop', this.handleSortDrop.bind(this));
        list.addEventListener('dragend', this.handleDragEnd.bind(this));

        // 모든 아이템을 드래그 가능하게 설정
        const items = list.querySelectorAll('.student-item');
        items.forEach(item => {
            item.draggable = true;
        });
    }

    handleDragStart(e) {
        this.draggedElement = e.target.closest('.student-item');
        if (this.draggedElement) {
            this.draggedElement.classList.add('dragging');
        }
    }

    handleSortDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(e.currentTarget, e.clientY);
        if (afterElement == null) {
            e.currentTarget.appendChild(this.draggedElement);
        } else {
            e.currentTarget.insertBefore(this.draggedElement, afterElement);
        }
    }

    handleSortDrop(e) {
        e.preventDefault();
        // 순서 업데이트 로직
        this.updateItemOrder(e.currentTarget);
    }

    handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
            this.draggedElement = null;
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.student-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateItemOrder(container) {
        const items = container.querySelectorAll('.student-item');
        items.forEach((item, index) => {
            // 순서 업데이트 API 호출
            console.log(`Item ${item.dataset.id} moved to position ${index}`);
        });
    }
}

// 이미지 편집기
class ImageEditor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentImage = null;
        this.history = [];
        this.historyIndex = -1;
    }

    init() {
        this.createEditor();
    }

    createEditor() {
        // 이미지 편집 모달 생성
        const editorModal = document.createElement('div');
        editorModal.id = 'imageEditorModal';
        editorModal.className = 'modal';
        editorModal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>이미지 편집</h3>
                    <span class="close" onclick="advancedUI.imageEditor.close()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="image-editor">
                        <div class="editor-toolbar">
                            <button onclick="advancedUI.imageEditor.crop()">자르기</button>
                            <button onclick="advancedUI.imageEditor.rotate(90)">회전</button>
                            <button onclick="advancedUI.imageEditor.flip('horizontal')">좌우 반전</button>
                            <button onclick="advancedUI.imageEditor.flip('vertical')">상하 반전</button>
                            <button onclick="advancedUI.imageEditor.undo()">실행 취소</button>
                            <button onclick="advancedUI.imageEditor.redo()">다시 실행</button>
                        </div>
                        <div class="editor-canvas-container">
                            <canvas id="imageEditorCanvas"></canvas>
                        </div>
                        <div class="editor-controls">
                            <label>밝기: <input type="range" id="brightness" min="-100" max="100" value="0"></label>
                            <label>대비: <input type="range" id="contrast" min="-100" max="100" value="0"></label>
                            <label>채도: <input type="range" id="saturation" min="-100" max="100" value="0"></label>
                        </div>
                        <div class="editor-actions">
                            <button onclick="advancedUI.imageEditor.save()">저장</button>
                            <button onclick="advancedUI.imageEditor.cancel()">취소</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(editorModal);
        this.canvas = document.getElementById('imageEditorCanvas');
        this.ctx = this.canvas.getContext('2d');

        // 컨트롤 이벤트 리스너
        this.setupControls();
    }

    setupControls() {
        const controls = ['brightness', 'contrast', 'saturation'];
        controls.forEach(control => {
            const slider = document.getElementById(control);
            if (slider) {
                slider.addEventListener('input', () => this.applyFilters());
            }
        });
    }

    open(imageFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.currentImage = img;
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.drawImage();
                    this.saveState();
                    document.getElementById('imageEditorModal').style.display = 'block';
                    resolve();
                };
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }

    close() {
        document.getElementById('imageEditorModal').style.display = 'none';
        this.reset();
    }

    drawImage() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.currentImage, 0, 0);
    }

    crop() {
        // 간단한 크롭 구현 (중앙 50% 영역)
        const newWidth = this.canvas.width * 0.5;
        const newHeight = this.canvas.height * 0.5;
        const x = (this.canvas.width - newWidth) / 2;
        const y = (this.canvas.height - newHeight) / 2;

        const imageData = this.ctx.getImageData(x, y, newWidth, newHeight);
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.ctx.putImageData(imageData, 0, 0);
        this.saveState();
    }

    rotate(degrees) {
        const radians = degrees * Math.PI / 180;
        const newCanvas = document.createElement('canvas');
        const newCtx = newCanvas.getContext('2d');

        if (degrees === 90 || degrees === 270) {
            newCanvas.width = this.canvas.height;
            newCanvas.height = this.canvas.width;
        } else {
            newCanvas.width = this.canvas.width;
            newCanvas.height = this.canvas.height;
        }

        newCtx.translate(newCanvas.width / 2, newCanvas.height / 2);
        newCtx.rotate(radians);
        newCtx.drawImage(this.canvas, -this.canvas.width / 2, -this.canvas.height / 2);

        this.canvas.width = newCanvas.width;
        this.canvas.height = newCanvas.height;
        this.ctx.drawImage(newCanvas, 0, 0);
        this.saveState();
    }

    flip(direction) {
        const newCanvas = document.createElement('canvas');
        const newCtx = newCanvas.getContext('2d');
        newCanvas.width = this.canvas.width;
        newCanvas.height = this.canvas.height;

        if (direction === 'horizontal') {
            newCtx.scale(-1, 1);
            newCtx.drawImage(this.canvas, -this.canvas.width, 0);
        } else {
            newCtx.scale(1, -1);
            newCtx.drawImage(this.canvas, 0, -this.canvas.height);
        }

        this.ctx.drawImage(newCanvas, 0, 0);
        this.saveState();
    }

    applyFilters() {
        const brightness = document.getElementById('brightness').value;
        const contrast = document.getElementById('contrast').value;
        const saturation = document.getElementById('saturation').value;

        this.ctx.filter = `brightness(${100 + parseInt(brightness)}%) contrast(${100 + parseInt(contrast)}%) saturate(${100 + parseInt(saturation)}%)`;
        this.drawImage();
        this.ctx.filter = 'none';
    }

    saveState() {
        this.historyIndex++;
        this.history = this.history.slice(0, this.historyIndex);
        this.history.push(this.canvas.toDataURL());
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadState(this.history[this.historyIndex]);
        }
    }

    loadState(dataURL) {
        const img = new Image();
        img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataURL;
    }

    save() {
        this.canvas.toBlob((blob) => {
            const file = new File([blob], 'edited_image.png', { type: 'image/png' });
            // 편집된 이미지를 원래 input에 설정
            this.replaceOriginalFile(file);
            this.close();
        });
    }

    replaceOriginalFile(file) {
        // 현재 활성화된 파일 input 찾기
        const activeInput = document.querySelector('input[type="file"]:focus, input[type="file"][data-editing="true"]');
        if (activeInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            activeInput.files = dt.files;
            activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    cancel() {
        this.close();
    }

    reset() {
        this.currentImage = null;
        this.history = [];
        this.historyIndex = -1;
        
        // 컨트롤 리셋
        document.getElementById('brightness').value = 0;
        document.getElementById('contrast').value = 0;
        document.getElementById('saturation').value = 0;
    }
}

// 검색 매니저
class SearchManager {
    constructor() {
        this.searchIndex = new Map();
        this.searchResults = [];
        this.currentQuery = '';
    }

    init() {
        this.createSearchInterface();
        this.buildSearchIndex();
    }

    createSearchInterface() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.innerHTML = `
            <div class="search-box">
                <input type="text" id="globalSearch" placeholder="검색어를 입력하세요...">
                <button onclick="advancedUI.searchManager.search()">
                    <i class="fas fa-search"></i>
                </button>
                <button onclick="advancedUI.searchManager.showAdvancedSearch()">
                    <i class="fas fa-filter"></i>
                </button>
            </div>
            <div id="searchResults" class="search-results"></div>
        `;

        // 헤더에 추가
        const header = document.querySelector('.main-header');
        if (header) {
            header.appendChild(searchContainer);
        }

        // 검색 이벤트 리스너
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', performanceOptimizer.debounce(() => {
                this.search();
            }, 300));
        }
    }

    buildSearchIndex() {
        // 추억 데이터 인덱싱
        memoriesData.forEach(memory => {
            this.addToIndex(memory.id, {
                type: 'memory',
                title: memory.title,
                author: memory.author,
                date: memory.date,
                content: `${memory.title} ${memory.author}`,
                data: memory
            });
        });

        // 학생 데이터 인덱싱
        studentsData.forEach(student => {
            this.addToIndex(student.id, {
                type: 'student',
                name: student.name,
                content: student.name,
                data: student
            });
        });

        // 개발자 데이터 인덱싱
        developersData.forEach(developer => {
            this.addToIndex(developer.id, {
                type: 'developer',
                name: developer.name,
                content: developer.name,
                data: developer
            });
        });
    }

    addToIndex(id, item) {
        this.searchIndex.set(id, item);
    }

    search(query = null) {
        const searchQuery = query || document.getElementById('globalSearch').value.trim();
        this.currentQuery = searchQuery;

        if (!searchQuery) {
            this.clearResults();
            return;
        }

        const results = this.performSearch(searchQuery);
        this.displayResults(results);
    }

    performSearch(query) {
        const results = [];
        const queryLower = query.toLowerCase();

        this.searchIndex.forEach((item, id) => {
            const contentLower = item.content.toLowerCase();
            if (contentLower.includes(queryLower)) {
                const relevance = this.calculateRelevance(queryLower, contentLower);
                results.push({ ...item, relevance });
            }
        });

        return results.sort((a, b) => b.relevance - a.relevance);
    }

    calculateRelevance(query, content) {
        let score = 0;
        
        // 정확한 일치
        if (content === query) score += 100;
        
        // 시작 부분 일치
        if (content.startsWith(query)) score += 50;
        
        // 포함 여부
        if (content.includes(query)) score += 25;
        
        // 길이에 따른 가중치
        score += Math.max(0, 10 - Math.abs(content.length - query.length));
        
        return score;
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
            resultsContainer.style.display = 'block';
            return;
        }

        const resultsHTML = results.map(result => {
            return `
                <div class="search-result-item" onclick="advancedUI.searchManager.selectResult('${result.data.id}', '${result.type}')">
                    <div class="result-type">${this.getTypeLabel(result.type)}</div>
                    <div class="result-title">${this.highlightQuery(result.title || result.name, this.currentQuery)}</div>
                    <div class="result-meta">${this.getResultMeta(result)}</div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.style.display = 'block';
    }

    getTypeLabel(type) {
        const labels = {
            memory: '추억',
            student: '학생',
            developer: '개발자'
        };
        return labels[type] || type;
    }

    highlightQuery(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    getResultMeta(result) {
        switch (result.type) {
            case 'memory':
                return `${result.author} • ${result.date}`;
            case 'student':
                return result.data.type === 'teacher' ? '선생님' : '학생';
            case 'developer':
                return '개발자';
            default:
                return '';
        }
    }

    selectResult(id, type) {
        // 해당 탭으로 이동하고 항목 강조
        switch (type) {
            case 'memory':
                switchTab('memories');
                this.highlightMemory(id);
                break;
            case 'student':
                switchTab('students');
                this.highlightStudent(id);
                break;
            case 'developer':
                switchTab('developers');
                this.highlightDeveloper(id);
                break;
        }
        
        this.clearResults();
    }

    highlightMemory(id) {
        setTimeout(() => {
            const memory = memoriesData.find(m => m.id === id);
            if (memory) {
                showMemoryDetail(memory);
            }
        }, 300);
    }

    highlightStudent(id) {
        setTimeout(() => {
            const element = document.querySelector(`[data-id="${id}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlighted');
                setTimeout(() => element.classList.remove('highlighted'), 2000);
            }
        }, 300);
    }

    highlightDeveloper(id) {
        this.highlightStudent(id); // 같은 로직 사용
    }

    clearResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
        }
    }

    showAdvancedSearch() {
        // 고급 검색 모달 표시
        console.log('Advanced search modal');
    }
}

// 키보드 매니저
class KeyboardManager {
    constructor() {
        this.shortcuts = new Map();
        this.focusableElements = [];
        this.currentFocusIndex = -1;
    }

    init() {
        this.registerShortcuts();
        this.setupTabNavigation();
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    registerShortcuts() {
        // 전역 단축키
        this.shortcuts.set('ctrl+k', () => {
            document.getElementById('globalSearch')?.focus();
        });
        
        this.shortcuts.set('ctrl+1', () => switchTab('memories'));
        this.shortcuts.set('ctrl+2', () => switchTab('students'));
        this.shortcuts.set('ctrl+3', () => switchTab('developers'));
        
        this.shortcuts.set('ctrl+n', () => {
            const currentTab = document.querySelector('.tab-btn.active').textContent.trim();
            switch (currentTab) {
                case '추억':
                    openMemoryForm();
                    break;
                case '학생 목록':
                    openStudentForm();
                    break;
                case '개발자':
                    openDeveloperForm();
                    break;
            }
        });
    }

    setupTabNavigation() {
        this.updateFocusableElements();
        
        // 포커스 가능한 요소가 변경될 때마다 업데이트
        const observer = new MutationObserver(() => {
            this.updateFocusableElements();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    updateFocusableElements() {
        this.focusableElements = Array.from(document.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(el => {
            return el.offsetParent !== null; // 보이는 요소만
        });
    }

    handleKeydown(e) {
        const shortcut = this.getShortcutString(e);
        
        if (this.shortcuts.has(shortcut)) {
            e.preventDefault();
            this.shortcuts.get(shortcut)();
            return;
        }

        // Tab 네비게이션
        if (e.key === 'Tab') {
            this.handleTabNavigation(e);
        }
        
        // 방향키 네비게이션
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            this.handleArrowNavigation(e);
        }
    }

    getShortcutString(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');
        parts.push(e.key.toLowerCase());
        return parts.join('+');
    }

    handleTabNavigation(e) {
        if (this.focusableElements.length === 0) return;

        const currentElement = document.activeElement;
        const currentIndex = this.focusableElements.indexOf(currentElement);
        
        let nextIndex;
        if (e.shiftKey) {
            nextIndex = currentIndex <= 0 ? this.focusableElements.length - 1 : currentIndex - 1;
        } else {
            nextIndex = currentIndex >= this.focusableElements.length - 1 ? 0 : currentIndex + 1;
        }
        
        this.focusableElements[nextIndex]?.focus();
        this.currentFocusIndex = nextIndex;
    }

    handleArrowNavigation(e) {
        const activeElement = document.activeElement;
        
        // 그리드 네비게이션 (학생 목록, 개발자 목록)
        if (activeElement.closest('.students-list, .developers-list')) {
            this.handleGridNavigation(e, activeElement);
        }
        
        // 리스트 네비게이션 (추억 목록)
        if (activeElement.closest('.memories-list')) {
            this.handleListNavigation(e, activeElement);
        }
    }

    handleGridNavigation(e, activeElement) {
        const container = activeElement.closest('.students-list, .developers-list');
        const items = Array.from(container.children);
        const currentIndex = items.indexOf(activeElement.closest('.student-item, .developer-item'));
        
        if (currentIndex === -1) return;
        
        const containerWidth = container.offsetWidth;
        const itemWidth = items[0]?.offsetWidth || 200;
        const itemsPerRow = Math.floor(containerWidth / itemWidth);
        
        let nextIndex;
        
        switch (e.key) {
            case 'ArrowLeft':
                nextIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowRight':
                nextIndex = Math.min(items.length - 1, currentIndex + 1);
                break;
            case 'ArrowUp':
                nextIndex = Math.max(0, currentIndex - itemsPerRow);
                break;
            case 'ArrowDown':
                nextIndex = Math.min(items.length - 1, currentIndex + itemsPerRow);
                break;
        }
        
        if (nextIndex !== undefined && items[nextIndex]) {
            e.preventDefault();
            items[nextIndex].focus();
        }
    }

    handleListNavigation(e, activeElement) {
        const container = activeElement.closest('.memories-list');
        const items = Array.from(container.children);
        const currentIndex = items.indexOf(activeElement.closest('.memory-item'));
        
        if (currentIndex === -1) return;
        
        let nextIndex;
        
        switch (e.key) {
            case 'ArrowUp':
                nextIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowDown':
                nextIndex = Math.min(items.length - 1, currentIndex + 1);
                break;
        }
        
        if (nextIndex !== undefined && items[nextIndex]) {
            e.preventDefault();
            items[nextIndex].focus();
        }
    }
}

// 전역 인스턴스
const advancedUI = new AdvancedUI();


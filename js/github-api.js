// GitHub API 관련 기능
class GitHubAPI {
    constructor() {
        this.username = 'gusick9316';
        this.repository = 'memory';
        this.tokenParts = ['ghp', '_2SllyukhLwajJQdMsP0xgu9uaR5fDv2gvE0T'];
        this.baseUrl = `https://api.github.com/repos/${this.username}/${this.repository}`;
    }

    getToken() {
        return this.tokenParts.join('');
    }

    async makeRequest(url, options = {}) {
        const headers = {
            'Authorization': `token ${this.getToken()}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        const maxRetries = 3;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers,
                    timeout: 30000 // 30초 타임아웃
                });

                if (!response.ok) {
                    // GitHub API 레이트 리미트 처리
                    if (response.status === 403) {
                        const resetTime = response.headers.get('X-RateLimit-Reset');
                        if (resetTime) {
                            const waitTime = (parseInt(resetTime) * 1000) - Date.now();
                            if (waitTime > 0 && waitTime < 60000) { // 1분 이내면 대기
                                console.log(`Rate limit hit, waiting ${waitTime}ms`);
                                await new Promise(resolve => setTimeout(resolve, waitTime));
                                continue;
                            }
                        }
                    }
                    
                    // 서버 에러 (5xx) 또는 일시적 에러 (429, 502, 503, 504)는 재시도
                    if (response.status >= 500 || [429, 502, 503, 504].includes(response.status)) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    // 클라이언트 에러 (4xx)는 재시도하지 않음
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                retries++;
                console.error(`Request failed (attempt ${retries}/${maxRetries}):`, error);
                
                if (retries >= maxRetries) {
                    throw error;
                }
                
                // 지수 백오프: 1초, 2초, 4초 대기
                const waitTime = Math.pow(2, retries - 1) * 1000;
                console.log(`Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    async checkConnection() {
        try {
            const response = await this.makeRequest(`${this.baseUrl}`);
            return response && response.name === this.repository;
        } catch (error) {
            return false;
        }
    }

    async getRepositorySize() {
        try {
            const response = await this.makeRequest(`${this.baseUrl}`);
            return Math.round(response.size / 1024); // KB to MB
        } catch (error) {
            return 0;
        }
    }

    async getFileContent(path) {
        try {
            const response = await this.makeRequest(`${this.baseUrl}/contents/${path}`);
            if (response.content) {
                // Base64 디코딩 후 UTF-8 문자열로 변환
                const decodedContent = atob(response.content);
                const utf8Content = decodeURIComponent(escape(decodedContent));
                return JSON.parse(utf8Content);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async createOrUpdateFile(path, content, message, sha = null) {
        // SHA가 제공되지 않았으면 기존 파일에서 가져오기
        if (!sha) {
            try {
                const existingFile = await this.makeRequest(`${this.baseUrl}/contents/${path}`);
                if (existingFile && existingFile.sha) {
                    sha = existingFile.sha;
                }
            } catch (error) {
                // 파일이 없으면 새로 생성
            }
        }

        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
            branch: 'main'
        };

        if (sha) {
            body.sha = sha;
        }

        return await this.makeRequest(`${this.baseUrl}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async uploadImage(path, imageData, message) {
        // 이미지 데이터에서 base64 부분만 추출
        let base64Data = imageData;
        if (imageData.includes(',')) {
            base64Data = imageData.split(',')[1];
        }

        // 기존 파일이 있는지 확인하고 SHA 가져오기
        let sha = null;
        try {
            const existingFile = await this.makeRequest(`${this.baseUrl}/contents/${path}`);
            if (existingFile && existingFile.sha) {
                sha = existingFile.sha;
            }
        } catch (error) {
            // 파일이 없으면 새로 생성
        }

        const body = {
            message,
            content: base64Data,
            branch: 'main'
        };

        if (sha) {
            body.sha = sha;
        }

        return await this.makeRequest(`${this.baseUrl}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async deleteFile(path, message, sha) {
        const body = {
            message,
            sha,
            branch: 'main'
        };

        return await this.makeRequest(`${this.baseUrl}/contents/${path}`, {
            method: 'DELETE',
            body: JSON.stringify(body)
        });
    }

    async deleteFolder(folderPath) {
        try {
            // Get all files in the folder
            const contents = await this.makeRequest(`${this.baseUrl}/contents/${folderPath}`);
            
            // Delete each file
            for (const item of contents) {
                await this.deleteFile(item.path, `Delete ${item.name}`, item.sha);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to delete folder:', error);
            return false;
        }
    }

    async listFolderContents(folderPath) {
        try {
            const response = await this.makeRequest(`${this.baseUrl}/contents/${folderPath}`);
            return Array.isArray(response) ? response : [];
        } catch (error) {
            return [];
        }
    }

    async getImageUrl(path) {
        return `https://raw.githubusercontent.com/${this.username}/${this.repository}/main/${path}`;
    }

    async getMusicUrl() {
        return `https://raw.githubusercontent.com/${this.username}/${this.repository}/main/song.mp3`;
    }

    // 파일 크기 체크 (10MB 제한)
    validateFileSize(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        return file.size <= maxSize;
    }

    // 이미지를 Base64로 변환
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 폴더명 생성 (특수문자 제거)
    sanitizeFolderName(name) {
        return name.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_');
    }

    // 날짜 포맷팅
    formatDate(year, month, day) {
        const formattedMonth = month.toString().padStart(2, '0');
        const formattedDay = day.toString().padStart(2, '0');
        return `${year}-${formattedMonth}-${formattedDay}`;
    }
}

// 전역 GitHub API 인스턴스
window.githubAPI = new GitHubAPI();


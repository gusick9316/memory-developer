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

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('GitHub API request failed:', error);
            throw error;
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
                return JSON.parse(atob(response.content));
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async createOrUpdateFile(path, content, message, sha = null) {
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
        const body = {
            message,
            content: imageData.split(',')[1], // Remove data:image/... prefix
            branch: 'main'
        };

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


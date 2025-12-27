// Supabase配置（用户提供的）
const SUPABASE_URL = 'https://sabezxfwynqsrgaufyje.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hiaFdODleKPjKS8hhyOupQ_C2sTLWdz';

// 初始化Supabase客户端（带错误处理）
let supabase = null;
let supabaseConnected = false;
try {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase客户端初始化成功');
    } else {
        console.warn('Supabase库未加载，将使用本地存储');
    }
} catch (error) {
    console.error('Supabase初始化失败:', error);
}

// 全局变量
let recognition = null;
let apiConfig = {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: '',
    modelName: 'glm-4.7'
};
let isFirstTime = true;

// DOM元素
const chatContainer = document.getElementById('chatContainer');
const settingsPanel = document.getElementById('settingsPanel');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const recordingStatus = document.getElementById('recordingStatus');
const loadingIndicator = document.getElementById('loadingIndicator');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const supabaseStatus = document.getElementById('supabaseStatus');

// 表单元素
const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const saveConfigBtn = document.getElementById('saveConfigBtn');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('页面加载完成，开始初始化...');
    
    // 检查DOM元素是否存在
    if (!sendBtn) {
        console.error('发送按钮元素未找到！');
        return;
    }
    if (!messageInput) {
        console.error('消息输入框元素未找到！');
        return;
    }
    
    console.log('DOM元素检查通过');
    
    initVoiceRecognition();
    initEventListeners();
    
    // 测试Supabase连接
    await testSupabaseConnection();
    
    // 尝试从本地存储加载配置（备用方案）
    loadConfigFromLocalStorage();
    
    await loadConfig();
    
    // 检查API密钥配置
    checkApiKeyConfig();
    
    await checkFirstTime();
    
    console.log('初始化完成');
});

// 初始化语音识别
function initVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            hideRecordingStatus();
            sendMessage();
        };

        recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            hideRecordingStatus();
            showMessage('语音识别失败，请重试', 'error');
        };

        recognition.onend = () => {
            hideRecordingStatus();
        };
    } else {
        voiceBtn.style.display = 'none';
    }
}

// 测试Supabase连接
async function testSupabaseConnection() {
    if (!supabase) {
        console.error('❌ Supabase客户端未初始化');
        updateSupabaseStatus(false, 'Supabase库未加载');
        return false;
    }

    try {
        console.log('正在测试Supabase连接...');
        // 尝试查询一个简单的表来测试连接
        const { data, error } = await supabase
            .from('api_config')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (error) {
            // 检查是否是表不存在的错误
            if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
                console.error('❌ Supabase连接失败: 数据库表不存在');
                console.error('请确保已在Supabase中执行了supabase_schema.sql文件');
                updateSupabaseStatus(false, '数据库表不存在，请执行SQL脚本');
                showMessage('数据库表不存在，请在Supabase中执行supabase_schema.sql', 'error');
            } else if (error.code === 'PGRST301' || error.message.includes('JWT')) {
                console.error('❌ Supabase连接失败: API密钥无效');
                updateSupabaseStatus(false, 'API密钥无效');
                showMessage('Supabase API密钥无效，请检查配置', 'error');
            } else {
                console.error('❌ Supabase连接失败:', error);
                updateSupabaseStatus(false, '连接失败: ' + error.message);
                showMessage('Supabase连接失败: ' + error.message, 'error');
            }
            supabaseConnected = false;
            return false;
        }

        console.log('✅ Supabase连接成功');
        updateSupabaseStatus(true, '数据库连接正常');
        supabaseConnected = true;
        return true;
    } catch (error) {
        console.error('❌ Supabase连接测试异常:', error);
        updateSupabaseStatus(false, '连接异常: ' + error.message);
        showMessage('Supabase连接测试异常: ' + error.message, 'error');
        supabaseConnected = false;
        return false;
    }
}

// 更新Supabase状态指示器
function updateSupabaseStatus(connected, message) {
    if (!supabaseStatus) return;
    
    if (connected) {
        supabaseStatus.textContent = '💾';
        supabaseStatus.style.color = '#48bb78';
        supabaseStatus.title = '数据库连接正常';
    } else {
        supabaseStatus.textContent = '💾';
        supabaseStatus.style.color = '#f56565';
        supabaseStatus.title = message || '数据库连接失败';
    }
}

// 检查API密钥配置
function checkApiKeyConfig() {
    const hasApiKey = !!(apiConfig.apiKey && apiConfig.apiKey.trim().length > 0);
    
    console.log('检查API密钥配置:', {
        hasApiKey: hasApiKey,
        apiUrl: apiConfig.apiUrl,
        modelName: apiConfig.modelName
    });
    
    updateApiKeyStatus(hasApiKey);
    
    if (!hasApiKey) {
        console.warn('⚠️ API密钥未配置');
        showMessage('API密钥未配置，请先在设置中配置', 'error');
    } else {
        console.log('✅ API密钥已配置');
    }
    
    return hasApiKey;
}

// 更新API密钥状态指示器
function updateApiKeyStatus(configured) {
    if (!apiKeyStatus) return;
    
    if (configured) {
        apiKeyStatus.textContent = '🔑';
        apiKeyStatus.style.color = '#48bb78';
        apiKeyStatus.title = 'API密钥已配置';
    } else {
        apiKeyStatus.textContent = '🔑';
        apiKeyStatus.style.color = '#f56565';
        apiKeyStatus.title = 'API密钥未配置';
    }
}

// 初始化事件监听
function initEventListeners() {
    console.log('初始化事件监听器...');
    
    // 设置按钮
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            console.log('点击设置按钮');
            showSettingsPanel();
        });
    }

    // 关闭设置面板
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            console.log('点击关闭设置按钮');
            hideSettingsPanel();
        });
    }

    // 发送消息
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            console.log('点击发送按钮');
            e.preventDefault();
            sendMessage();
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                console.log('按Enter键发送');
                sendMessage();
            }
        });
    }

    // 自动调整输入框高度
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // 语音输入
    voiceBtn.addEventListener('click', startVoiceRecording);

    // 图片上传
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', handleImageUpload);

    // 保存配置
    saveConfigBtn.addEventListener('click', saveConfig);

    // 点击设置面板外部关闭
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) {
            hideSettingsPanel();
        }
    });
}

// 检查是否首次使用
async function checkFirstTime() {
    try {
        // 先检查本地存储
        const localConfig = localStorage.getItem('apiConfig');
        if (localConfig) {
            try {
                const config = JSON.parse(localConfig);
                if (config.apiKey) {
                    isFirstTime = false;
                    console.log('从本地存储检测到配置，不显示设置面板');
                    return;
                }
            } catch (e) {
                console.warn('解析本地配置失败:', e);
            }
        }

        // 如果Supabase可用，从数据库检查
        if (supabase) {
            const { data, error } = await supabase
                .from('api_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.warn('Supabase检查配置失败:', error);
                // 如果数据库检查失败，检查本地存储
                if (!localConfig) {
                    isFirstTime = true;
                    showSettingsPanel();
                }
            } else if (!data || !data.api_key) {
                // 没有配置或配置不完整，显示设置面板
                isFirstTime = true;
                showSettingsPanel();
            } else {
                isFirstTime = false;
                // 配置已存在，不显示设置面板
            }
        } else {
            // Supabase不可用，检查本地存储
            if (!localConfig) {
                isFirstTime = true;
                showSettingsPanel();
            } else {
                isFirstTime = false;
            }
        }
    } catch (error) {
        console.error('检查配置失败:', error);
        // 出错时也显示设置面板
        isFirstTime = true;
        showSettingsPanel();
    }
}

// 从本地存储加载配置（备用方案）
function loadConfigFromLocalStorage() {
    try {
        const saved = localStorage.getItem('apiConfig');
        if (saved) {
            const config = JSON.parse(saved);
            apiConfig = {
                apiUrl: config.apiUrl || apiConfig.apiUrl,
                apiKey: config.apiKey || '',
                modelName: config.modelName || apiConfig.modelName
            };
            console.log('从本地存储加载配置');
        }
    } catch (error) {
        console.error('从本地存储加载配置失败:', error);
    }
}

// 保存配置到本地存储（备用方案）
function saveConfigToLocalStorage() {
    try {
        localStorage.setItem('apiConfig', JSON.stringify(apiConfig));
        console.log('配置已保存到本地存储');
    } catch (error) {
        console.error('保存配置到本地存储失败:', error);
    }
}

// 加载配置
async function loadConfig() {
    try {
        // 先尝试从Supabase加载
        if (supabase && supabaseConnected) {
            console.log('从Supabase加载配置...');
            const { data, error } = await supabase
                .from('api_config')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                apiConfig = {
                    apiUrl: data.api_url || apiConfig.apiUrl,
                    apiKey: data.api_key || '',
                    modelName: data.model_name || apiConfig.modelName
                };
                // 更新表单显示（但不显示密钥）
                if (apiUrlInput) apiUrlInput.value = apiConfig.apiUrl;
                if (modelNameInput) modelNameInput.value = apiConfig.modelName;
                console.log('从Supabase加载配置成功');
                // 同步到本地存储
                saveConfigToLocalStorage();
                return;
            } else {
                if (error) {
                    console.warn('Supabase加载配置失败:', error);
                } else {
                    console.log('Supabase中没有配置数据');
                }
            }
        } else {
            console.log('Supabase未连接，跳过从数据库加载');
        }
        
        // 如果Supabase失败或不可用，使用本地存储
        console.log('尝试从本地存储加载配置...');
        loadConfigFromLocalStorage();
        
    } catch (error) {
        console.error('加载配置失败:', error);
        // 如果都失败，使用本地存储
        loadConfigFromLocalStorage();
    }
}

// 保存配置
async function saveConfig() {
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const modelName = modelNameInput.value.trim();

    if (!apiUrl || !apiKey || !modelName) {
        showMessage('请填写完整的配置信息', 'error');
        return;
    }

    try {
        // 如果Supabase已连接，尝试保存到数据库
        if (supabase && supabaseConnected) {
            console.log('保存配置到Supabase...');
            // 检查是否已存在配置
            const { data: existing } = await supabase
                .from('api_config')
                .select('id')
                .maybeSingle();

            const configData = {
                id: 1,
                api_url: apiUrl,
                api_key: apiKey,
                model_name: modelName,
                updated_at: new Date().toISOString()
            };

            let result;
            if (existing) {
                // 更新现有配置
                result = await supabase
                    .from('api_config')
                    .update(configData)
                    .eq('id', 1);
            } else {
                // 插入新配置
                result = await supabase
                    .from('api_config')
                    .insert([configData]);
            }

            if (result.error) {
                throw new Error('Supabase保存失败: ' + result.error.message);
            }
            console.log('配置已保存到Supabase');
        } else {
            console.warn('Supabase未连接，仅保存到本地存储');
            showMessage('Supabase未连接，配置仅保存到本地', 'error');
        }

        // 更新本地配置
        apiConfig = { apiUrl, apiKey, modelName };
        isFirstTime = false;
        
        // 同时保存到本地存储（备用）
        saveConfigToLocalStorage();
        
        // 更新API密钥状态
        checkApiKeyConfig();
        
        // 如果Supabase之前未连接，重新测试连接
        if (!supabaseConnected) {
            console.log('重新测试Supabase连接...');
            await testSupabaseConnection();
        }

        showMessage('配置保存成功', 'success');
        hideSettingsPanel();
    } catch (error) {
        console.error('保存配置失败:', error);
        showMessage('保存配置失败: ' + error.message, 'error');
    }
}

// 显示设置面板
function showSettingsPanel() {
    settingsPanel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 隐藏设置面板
function hideSettingsPanel() {
    if (!isFirstTime) {
        settingsPanel.style.display = 'none';
        document.body.style.overflow = '';
    } else {
        showMessage('请先完成配置', 'error');
    }
}

// 发送消息
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) {
        console.log('消息为空，不发送');
        return;
    }

    console.log('准备发送消息:', message);
    console.log('当前API配置:', { 
        apiUrl: apiConfig.apiUrl, 
        hasKey: !!apiConfig.apiKey, 
        modelName: apiConfig.modelName 
    });

    // 检查配置
    if (!apiConfig.apiKey) {
        console.warn('API密钥未配置');
        showMessage('请先在设置中配置API密钥', 'error');
        showSettingsPanel();
        return;
    }

    // 禁用发送按钮
    sendBtn.disabled = true;

    // 添加用户消息到界面
    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // 显示加载指示器
    showLoading();

    try {
        console.log('调用AI API...');
        // 调用AI API
        const response = await callAIAPI(message);
        console.log('AI回复:', response);
        
        // 添加AI回复到界面
        addMessage(response, 'ai');

        // 保存对话记录到数据库（不阻塞）
        saveConversation(message, response).catch(err => {
            console.error('保存对话失败:', err);
        });
    } catch (error) {
        console.error('发送消息失败:', error);
        const errorMsg = error.message || '未知错误';
        addMessage('抱歉，发生了错误：' + errorMsg, 'ai');
    } finally {
        hideLoading();
        sendBtn.disabled = false;
    }
}

// 调用AI API
async function callAIAPI(message) {
    try {
        const response = await fetch(apiConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: apiConfig.modelName,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的糖尿病健康管理助手，擅长解析医嘱、处方和病例，并给出结构化的健康建议。请用友好、易懂的语言回答用户的问题。'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 1,
                stream: false,
                thinking: {
                    type: 'enabled',
                    clear_thinking: true
                },
                do_sample: true,
                top_p: 0.95,
                tool_stream: false,
                response_format: {
                    type: 'text'
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        throw new Error(error.message || 'API调用失败');
    }
}

// 处理图片上传
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
        showMessage('图片大小不能超过10MB', 'error');
        return;
    }

    // 读取图片为base64
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const imageType = file.type;

        // 添加用户消息（显示图片）
        addMessage('', 'user', base64, imageType);

        showLoading();

        try {
            // 调用AI API分析图片
            const response = await callAIAPIWithImage(base64, imageType);
            addMessage(response, 'ai');
            await saveConversation('[图片]', response);
        } catch (error) {
            console.error('图片分析失败:', error);
            addMessage('抱歉，图片分析失败：' + error.message, 'ai');
        } finally {
            hideLoading();
        }
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
}

// 调用AI API（图片）
async function callAIAPIWithImage(imageBase64, imageType) {
    try {
        const response = await fetch(apiConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: apiConfig.modelName,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的糖尿病健康管理助手，擅长解析医嘱、处方和病例，并给出结构化的健康建议。'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: '请分析这张医疗图片（处方单或病例），提取出结构化的健康管理信息，包括饮食建议、运动建议和用药提醒。'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${imageType};base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 1,
                stream: false,
                thinking: {
                    type: 'enabled',
                    clear_thinking: true
                },
                do_sample: true,
                top_p: 0.95,
                tool_stream: false,
                response_format: {
                    type: 'text'
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        throw new Error(error.message || '图片分析失败');
    }
}

// 添加消息到界面
function addMessage(content, role, imageBase64 = null, imageType = null) {
    // 移除欢迎消息
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    messageDiv.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (imageBase64) {
        const img = document.createElement('img');
        img.src = `data:${imageType};base64,${imageBase64}`;
        img.className = 'message-image';
        img.alt = '上传的图片';
        contentDiv.appendChild(img);
    }

    if (content) {
        const textDiv = document.createElement('div');
        textDiv.textContent = content;
        contentDiv.appendChild(textDiv);
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    contentDiv.appendChild(timeDiv);

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 保存对话记录
async function saveConversation(userMessage, aiMessage) {
    try {
        if (supabase) {
            await supabase
                .from('conversations')
                .insert([
                    {
                        user_message: userMessage,
                        ai_message: aiMessage,
                        created_at: new Date().toISOString()
                    }
                ]);
        } else {
            console.log('Supabase不可用，跳过保存对话记录');
        }
    } catch (error) {
        console.error('保存对话失败:', error);
    }
}

// 开始语音录制
function startVoiceRecording() {
    if (!recognition) {
        showMessage('语音识别功能不可用', 'error');
        return;
    }

    showRecordingStatus();
    recognition.start();
}

// 显示录音状态
function showRecordingStatus() {
    recordingStatus.style.display = 'flex';
}

// 隐藏录音状态
function hideRecordingStatus() {
    recordingStatus.style.display = 'none';
}

// 显示加载指示器
function showLoading() {
    loadingIndicator.style.display = 'flex';
}

// 隐藏加载指示器
function hideLoading() {
    loadingIndicator.style.display = 'none';
}

// 显示提示消息
function showMessage(text, type = 'info') {
    // 简单的提示实现，可以后续优化为更好的UI
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : '#667eea'};
        color: white;
        border-radius: 24px;
        font-size: 14px;
        z-index: 10000;
        animation: slideDown 0.3s;
    `;
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideUp 0.3s';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

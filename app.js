// 检查是否已经加载过，避免重复执行
if (window.appInitialized) {
    console.warn('应用已经初始化，跳过重复加载');
} else {
    window.appInitialized = true;

// ============================================
// ⚙️ Supabase配置 - 需要修改这里 ⚙️
// ============================================
// 请将下面的URL和KEY替换为你的Supabase项目信息
// 获取方式：Supabase Dashboard -> Settings -> API
const SUPABASE_URL = 'https://sabezxfwynqsrgaufyje.supabase.co'; // 🔧 修改：你的Supabase Project URL
const SUPABASE_KEY = 'sb_publishable_hiaFdODleKPjKS8hhyOupQ_C2sTLWdz'; // 🔧 修改：你的Supabase Publishable Key
// ============================================

// 初始化Supabase客户端（带错误处理）
let supabase = null;
let supabaseConnected = false;

// 等待Supabase库加载
function initSupabaseClient() {
    console.log('========== 初始化Supabase客户端 ==========');
    console.log('Supabase URL:', SUPABASE_URL);
    console.log('Supabase Key:', SUPABASE_KEY.substring(0, 20) + '...');
    
    try {
        // 检查Supabase库是否加载
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Supabase库未加载');
            console.error('请检查HTML中是否引入了Supabase库:');
            console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
            updateSupabaseStatus(false, 'Supabase库未加载');
            return false;
        }

        if (!window.supabase.createClient) {
            console.error('❌ Supabase库版本不正确');
            updateSupabaseStatus(false, 'Supabase库版本错误');
            return false;
        }

        // 创建客户端
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase客户端创建成功');
        return true;
    } catch (error) {
        console.error('❌ Supabase初始化失败:', error);
        console.error('错误详情:', {
            message: error.message,
            stack: error.stack
        });
        updateSupabaseStatus(false, '初始化失败: ' + error.message);
        return false;
    }
}

// 全局变量
let recognition = null;
let apiConfig = {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: '',
    modelName: 'glm-4.7'
};
let isFirstTime = true;

// DOM元素（在DOMContentLoaded中初始化）
let chatContainer, settingsPanel, settingsBtn, closeSettingsBtn;
let messagesContainer, messageInput, sendBtn, voiceBtn, uploadBtn;
let fileInput, recordingStatus, loadingIndicator;
let apiKeyStatus, supabaseStatus;
let apiUrlInput, apiKeyInput, modelNameInput, saveConfigBtn;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('========== 页面加载完成，开始初始化 ==========');
    
    // 获取DOM元素
    chatContainer = document.getElementById('chatContainer');
    settingsPanel = document.getElementById('settingsPanel');
    settingsBtn = document.getElementById('settingsBtn');
    closeSettingsBtn = document.getElementById('closeSettingsBtn');
    messagesContainer = document.getElementById('messagesContainer');
    messageInput = document.getElementById('messageInput');
    sendBtn = document.getElementById('sendBtn');
    voiceBtn = document.getElementById('voiceBtn');
    uploadBtn = document.getElementById('uploadBtn');
    fileInput = document.getElementById('fileInput');
    recordingStatus = document.getElementById('recordingStatus');
    loadingIndicator = document.getElementById('loadingIndicator');
    apiKeyStatus = document.getElementById('apiKeyStatus');
    supabaseStatus = document.getElementById('supabaseStatus');
    apiUrlInput = document.getElementById('apiUrl');
    apiKeyInput = document.getElementById('apiKey');
    modelNameInput = document.getElementById('modelName');
    saveConfigBtn = document.getElementById('saveConfigBtn');
    
    // 检查DOM元素是否存在
    const requiredElements = {
        sendBtn: sendBtn,
        messageInput: messageInput,
        voiceBtn: voiceBtn,
        uploadBtn: uploadBtn,
        fileInput: fileInput,
        settingsBtn: settingsBtn
    };
    
    let missingElements = [];
    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            missingElements.push(name);
            console.error(`❌ ${name} 元素未找到！`);
        }
    }
    
    if (missingElements.length > 0) {
        console.error('缺少必要的DOM元素:', missingElements);
        alert('页面元素加载失败，请刷新页面重试');
        return;
    }
    
    console.log('✅ DOM元素检查通过');
    
    initVoiceRecognition();
    initEventListeners();
    
    // 初始化Supabase客户端
    console.log('检查Supabase库加载状态...');
    if (window.supabase) {
        console.log('✅ Supabase库已加载');
        initSupabaseClient();
    } else {
        console.warn('⚠️ Supabase库未加载，等待加载...');
        // 等待Supabase库加载（最多等待3秒）
        let waitCount = 0;
        const checkSupabase = setInterval(() => {
            waitCount++;
            if (window.supabase) {
                console.log('✅ Supabase库已加载（延迟加载）');
                clearInterval(checkSupabase);
                initSupabaseClient();
                testSupabaseConnection();
            } else if (waitCount >= 30) {
                console.error('❌ Supabase库加载超时');
                clearInterval(checkSupabase);
                updateSupabaseStatus(false, 'Supabase库加载超时');
            }
        }, 100);
    }
    
    // 测试Supabase连接
    if (supabase) {
        await testSupabaseConnection();
    }
    
    // 尝试从本地存储加载配置（备用方案）
    loadConfigFromLocalStorage();
    
    await loadConfig();
    
    // 检查API密钥配置
    checkApiKeyConfig();
    
    await checkFirstTime();
    
    console.log('========== 初始化完成 ==========');
    console.log('当前配置状态:', {
        hasApiKey: !!(apiConfig.apiKey && apiConfig.apiKey.trim().length > 0),
        apiUrl: apiConfig.apiUrl,
        modelName: apiConfig.modelName,
        supabaseConnected: supabaseConnected
    });
    
    // 打印调试信息
    if (typeof debugSupabaseConfig === 'function') {
        debugSupabaseConfig();
    }
    
    // 在控制台提示调试命令
    console.log('');
    console.log('💡 调试命令:');
    console.log('  - debugSupabase() : 查看Supabase配置信息');
    console.log('  - testSupabase()  : 重新测试Supabase连接');
    console.log('');
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
            console.log('语音识别结果:', transcript);
            if (messageInput) {
                messageInput.value = transcript;
            }
            hideRecordingStatus();
            // 自动发送识别结果
            setTimeout(() => {
                sendMessage();
            }, 100);
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
    console.log('========== 测试Supabase连接 ==========');
    
    if (!supabase) {
        console.error('❌ Supabase客户端未初始化');
        updateSupabaseStatus(false, 'Supabase客户端未初始化');
        return false;
    }

    try {
        console.log('步骤1: 测试基本连接...');
        console.log('URL:', SUPABASE_URL);
        console.log('Key:', SUPABASE_KEY.substring(0, 20) + '...');
        
        // 先测试一个简单的查询（不依赖表是否存在）
        console.log('步骤2: 尝试查询api_config表...');
        const { data, error } = await supabase
            .from('api_config')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('❌ 查询错误:', error);
            console.error('错误代码:', error.code);
            console.error('错误消息:', error.message);
            console.error('错误详情:', error);
            
            // 检查是否是表不存在的错误
            if (error.code === 'PGRST116' || 
                error.message.includes('relation') || 
                error.message.includes('does not exist') ||
                error.message.includes('Could not find')) {
                console.error('❌ 数据库表不存在');
                console.error('解决方案:');
                console.error('1. 登录 Supabase Dashboard');
                console.error('2. 进入 SQL Editor');
                console.error('3. 执行 supabase_schema.sql 文件中的所有SQL语句');
                updateSupabaseStatus(false, '数据库表不存在');
                showMessage('数据库表不存在！请在Supabase SQL Editor中执行supabase_schema.sql', 'error');
            } 
            // 检查是否是认证错误
            else if (error.code === 'PGRST301' || 
                     error.code === '42501' ||
                     error.message.includes('JWT') || 
                     error.message.includes('Invalid API key') ||
                     error.message.includes('permission denied')) {
                console.error('❌ API密钥无效或权限不足');
                console.error('解决方案:');
                console.error('1. 检查 SUPABASE_KEY 是否正确');
                console.error('2. 确保使用的是 Publishable Key (anon/public key)');
                console.error('3. 检查 Supabase Dashboard -> Settings -> API');
                updateSupabaseStatus(false, 'API密钥无效');
                showMessage('Supabase API密钥无效！请检查配置', 'error');
            }
            // 检查是否是RLS策略问题
            else if (error.message.includes('RLS') || 
                     error.message.includes('Row Level Security')) {
                console.error('❌ RLS策略阻止访问');
                console.error('解决方案:');
                console.error('1. 检查 supabase_schema.sql 中的RLS策略');
                console.error('2. 确保策略允许所有操作');
                updateSupabaseStatus(false, 'RLS策略阻止访问');
                showMessage('RLS策略阻止访问！请检查数据库策略', 'error');
            }
            else {
                console.error('❌ 未知错误:', error);
                updateSupabaseStatus(false, '连接失败: ' + error.message);
                showMessage('Supabase连接失败: ' + error.message, 'error');
            }
            supabaseConnected = false;
            return false;
        }

        console.log('✅ Supabase连接成功！');
        console.log('查询结果:', data);
        updateSupabaseStatus(true, '数据库连接正常');
        supabaseConnected = true;
        return true;
    } catch (error) {
        console.error('❌ Supabase连接测试异常:', error);
        console.error('异常详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
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

// 调试工具：打印Supabase配置信息
function debugSupabaseConfig() {
    console.log('========== Supabase配置调试信息 ==========');
    console.log('1. Supabase库加载状态:', typeof window.supabase !== 'undefined' ? '✅ 已加载' : '❌ 未加载');
    console.log('2. Supabase客户端状态:', supabase ? '✅ 已创建' : '❌ 未创建');
    console.log('3. 连接状态:', supabaseConnected ? '✅ 已连接' : '❌ 未连接');
    console.log('4. Project URL:', SUPABASE_URL);
    console.log('5. API Key (前20字符):', SUPABASE_KEY.substring(0, 20) + '...');
    console.log('6. API Key长度:', SUPABASE_KEY.length);
    console.log('==========================================');
    
    // 检查配置格式
    if (!SUPABASE_URL.startsWith('https://')) {
        console.error('❌ URL格式错误: 应该以 https:// 开头');
    }
    if (!SUPABASE_KEY.startsWith('sb_')) {
        console.warn('⚠️ API Key格式可能不正确: 通常以 sb_ 开头');
    }
    
    return {
        libraryLoaded: typeof window.supabase !== 'undefined',
        clientCreated: !!supabase,
        connected: supabaseConnected,
        url: SUPABASE_URL,
        keyLength: SUPABASE_KEY.length
    };
}

// 在控制台暴露调试函数
window.debugSupabase = debugSupabaseConfig;
window.testSupabase = testSupabaseConnection;

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
    console.log('========== 初始化事件监听器 ==========');
    
    // 设置按钮
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ 点击设置按钮');
            showSettingsPanel();
        });
        console.log('✅ 设置按钮事件绑定成功');
    } else {
        console.error('❌ 设置按钮元素未找到');
    }

    // 关闭设置面板
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ 点击关闭设置按钮');
            hideSettingsPanel();
        });
        console.log('✅ 关闭设置按钮事件绑定成功');
    } else {
        console.error('❌ 关闭设置按钮元素未找到');
    }

    // 发送消息
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ 点击发送按钮');
            sendMessage();
        });
        console.log('✅ 发送按钮事件绑定成功');
    } else {
        console.error('❌ 发送按钮元素未找到');
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                console.log('✅ 按Enter键发送');
                sendMessage();
            }
        });
        console.log('✅ 输入框事件绑定成功');
    } else {
        console.error('❌ 输入框元素未找到');
    }

    // 自动调整输入框高度
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });

    // 语音输入
    if (voiceBtn) {
        voiceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ 点击语音按钮');
            startVoiceRecording();
        });
        console.log('✅ 语音按钮事件绑定成功');
    } else {
        console.error('❌ 语音按钮元素未找到');
    }

    // 图片上传
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ 点击图片上传按钮');
            if (fileInput) {
                fileInput.click();
            } else {
                console.error('❌ 文件输入元素未找到');
            }
        });
        console.log('✅ 图片上传按钮事件绑定成功');
    } else {
        console.error('❌ 图片上传按钮元素未找到');
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            console.log('✅ 文件选择改变');
            handleImageUpload(e);
        });
        console.log('✅ 文件输入事件绑定成功');
    } else {
        console.error('❌ 文件输入元素未找到');
    }

    // 保存配置
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('✅ 点击保存配置按钮');
            saveConfig();
        });
        console.log('✅ 保存配置按钮事件绑定成功');
    } else {
        console.error('❌ 保存配置按钮元素未找到');
    }
    
    console.log('========== 事件监听器初始化完成 ==========');

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
    console.log('sendMessage函数被调用');
    
    const message = messageInput.value.trim();
    if (!message) {
        console.log('消息为空，不发送');
        showMessage('请输入消息内容', 'error');
        return;
    }

    console.log('准备发送消息:', message);
    console.log('当前API配置:', { 
        apiUrl: apiConfig.apiUrl, 
        hasKey: !!apiConfig.apiKey, 
        apiKeyLength: apiConfig.apiKey ? apiConfig.apiKey.length : 0,
        modelName: apiConfig.modelName 
    });

    // 检查配置
    if (!apiConfig.apiKey || apiConfig.apiKey.trim().length === 0) {
        console.warn('API密钥未配置');
        showMessage('请先在设置中配置API密钥！点击右上角设置按钮进行配置', 'error');
        showSettingsPanel();
        return;
    }

    // 禁用发送按钮
    if (sendBtn) {
        sendBtn.disabled = true;
    }

    // 添加用户消息到界面
    addMessage(message, 'user');
    if (messageInput) {
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }

    // 显示加载指示器
    showLoading();

    try {
        console.log('开始调用AI API...');
        // 调用AI API
        const response = await callAIAPI(message);
        console.log('AI回复成功:', response);
        
        // 添加AI回复到界面
        addMessage(response, 'ai');

        // 保存对话记录到数据库（不阻塞）
        saveConversation(message, response).catch(err => {
            console.error('保存对话失败:', err);
        });
    } catch (error) {
        console.error('发送消息失败:', error);
        const errorMsg = error.message || '未知错误';
        console.error('错误详情:', error);
        addMessage('抱歉，发生了错误：' + errorMsg + '\n\n请检查：\n1. API密钥是否正确配置\n2. 网络连接是否正常\n3. API服务是否可用', 'ai');
    } finally {
        hideLoading();
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
}

// 调用AI API
async function callAIAPI(message) {
    try {
        console.log('准备调用智谱API:', {
            url: apiConfig.apiUrl,
            model: apiConfig.modelName,
            messageLength: message.length
        });

        const requestBody = {
            model: apiConfig.modelName,
            messages: [
                {
                    role: 'system',
                    content: `你是一个专业的糖尿病健康管理助手，擅长解析医嘱、处方和病例，并给出结构化的健康建议。

请遵循以下格式要求：
1. 使用清晰的段落分隔，每个段落之间空一行
2. 使用列表时，每个项目单独一行
3. 重要信息使用加粗标记（**文本**）
4. 保持每段文字长度适中，避免过长的段落
5. 使用友好的语气，语言简洁易懂

请用友好、易懂的语言回答用户的问题，确保格式清晰美观。`
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
        };

        console.log('请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(apiConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        console.log('API响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误响应:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API响应数据:', data);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API返回数据格式不正确');
        }

        return data.choices[0].message.content;
    } catch (error) {
        console.error('API调用异常:', error);
        throw new Error(error.message || 'API调用失败');
    }
}

// 处理图片上传
async function handleImageUpload(event) {
    console.log('handleImageUpload被调用');
    const file = event.target.files[0];
    if (!file) {
        console.log('未选择文件');
        return;
    }

    console.log('选择的文件:', file.name, file.type, file.size);

    // 检查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
        showMessage('图片大小不能超过10MB', 'error');
        return;
    }

    // 检查配置
    if (!apiConfig.apiKey || apiConfig.apiKey.trim().length === 0) {
        showMessage('请先在设置中配置API密钥！', 'error');
        showSettingsPanel();
        if (fileInput) fileInput.value = '';
        return;
    }

    // 读取图片为base64
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const base64 = e.target.result.split(',')[1];
            const imageType = file.type;

            console.log('图片读取完成，开始分析...');

            // 添加用户消息（显示图片）
            addMessage('', 'user', base64, imageType);

            showLoading();

            // 调用AI API分析图片
            const response = await callAIAPIWithImage(base64, imageType);
            addMessage(response, 'ai');
            await saveConversation('[图片]', response);
        } catch (error) {
            console.error('图片分析失败:', error);
            addMessage('抱歉，图片分析失败：' + error.message + '\n\n请检查：\n1. API密钥是否正确配置\n2. 网络连接是否正常\n3. 图片格式是否支持', 'ai');
        } finally {
            hideLoading();
        }
    };
    
    reader.onerror = (error) => {
        console.error('文件读取失败:', error);
        showMessage('图片读取失败，请重试', 'error');
    };
    
    reader.readAsDataURL(file);
    if (fileInput) fileInput.value = '';
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
                        content: `你是一个专业的糖尿病健康管理助手，擅长解析医嘱、处方和病例，并给出结构化的健康建议。

请遵循以下格式要求：
1. 使用清晰的段落分隔，每个段落之间空一行
2. 使用列表时，每个项目单独一行
3. 重要信息使用加粗标记（**文本**）
4. 保持每段文字长度适中，避免过长的段落
5. 使用友好的语气，语言简洁易懂

请用友好、易懂的语言回答用户的问题，确保格式清晰美观。`
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
        textDiv.className = 'message-text';
        
        // 处理文本格式：支持换行和Markdown格式
        let formattedContent = content;
        
        // 先转义HTML特殊字符
        formattedContent = formattedContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // 处理Markdown加粗 **文本**
        formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 按行分割处理
        const lines = formattedContent.split('\n');
        let htmlLines = [];
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过空行（用于段落分隔）
            if (!line) {
                if (inList) {
                    htmlLines.push('</ul>');
                    inList = false;
                }
                continue;
            }
            
            // 检查是否是列表项（以 *、- 或 • 开头）
            const listMatch = line.match(/^[\*\-\•]\s+(.+)$/);
            
            if (listMatch) {
                if (!inList) {
                    htmlLines.push('<ul>');
                    inList = true;
                }
                htmlLines.push(`<li>${listMatch[1]}</li>`);
            } else {
                if (inList) {
                    htmlLines.push('</ul>');
                    inList = false;
                }
                // 普通文本行，用段落包裹
                htmlLines.push(`<p>${line}</p>`);
            }
        }
        
        // 关闭未关闭的列表
        if (inList) {
            htmlLines.push('</ul>');
        }
        
        // 如果没有内容，至少添加一个段落
        if (htmlLines.length === 0) {
            htmlLines.push('<p></p>');
        }
        
        textDiv.innerHTML = htmlLines.join('');
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
    console.log('startVoiceRecording被调用');
    
    if (!recognition) {
        console.error('语音识别功能不可用');
        showMessage('语音识别功能不可用，请使用Chrome或Edge浏览器', 'error');
        return;
    }

    // 检查配置
    if (!apiConfig.apiKey || apiConfig.apiKey.trim().length === 0) {
        showMessage('请先在设置中配置API密钥！', 'error');
        showSettingsPanel();
        return;
    }

    console.log('开始语音识别...');
    showRecordingStatus();
    
    try {
        recognition.start();
    } catch (error) {
        console.error('启动语音识别失败:', error);
        hideRecordingStatus();
        showMessage('语音识别启动失败，请重试', 'error');
    }
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

} // 结束初始化检查

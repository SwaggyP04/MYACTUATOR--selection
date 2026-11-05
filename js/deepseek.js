// ============================================================
// DeepSeek 大模型集成模块
// 功能：API封装、流式输出、Function Calling、多轮对话管理
// 创建日期：2026-08-15
// ============================================================

// ===== DeepSeek API 配置 =====
const DEEPSEEK_CONFIG = {
  baseURL: 'https://api.deepseek.com/v1',
  models: {
    chat: 'deepseek-chat',
    coder: 'deepseek-coder',
  },
  defaultParams: {
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 0.9,
    frequency_penalty: 0.3,
    presence_penalty: 0.2,
  },
  // 对话历史窗口大小（最近N轮）
  historyWindow: 10,
};

// ===== 对话历史管理 =====
let deepseekChatHistory = [];

// 获取API Key（优先用户配置，无则返回null）
function getDeepSeekApiKey() {
  return localStorage.getItem('deepseek_api_key') || '';
}

// 获取当前使用的模型
function getDeepSeekModel() {
  return localStorage.getItem('deepseek_model') || DEEPSEEK_CONFIG.models.chat;
}

// 检查是否配置了DeepSeek API
function isDeepSeekConfigured() {
  return !!getDeepSeekApiKey();
}

// ===== 基础对话调用（非流式） =====
async function callDeepSeek(messages, options = {}) {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new Error('请先配置DeepSeek API Key');

  const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || getDeepSeekModel(),
      messages: messages,
      ...DEEPSEEK_CONFIG.defaultParams,
      ...options,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API错误: ${response.status}`);
  }

  return response.json();
}

// ===== 流式输出（SSE） =====
async function callDeepSeekStream(messages, onChunk, options = {}) {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new Error('请先配置DeepSeek API Key');

  const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || getDeepSeekModel(),
      messages: messages,
      stream: true,
      ...DEEPSEEK_CONFIG.defaultParams,
      ...options,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API错误: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          const chunk = data.choices?.[0]?.delta?.content;
          if (chunk) {
            fullContent += chunk;
            onChunk(chunk, fullContent);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return fullContent;
}

// ============================================================
// Function Calling 工具定义
// ============================================================

const DEEPSEEK_TOOLS = [
  {
    type: "function",
    function: {
      name: "select_motor",
      description: "根据扭矩需求和筛选条件推荐电机型号，返回按匹配度排序的产品列表",
      parameters: {
        type: "object",
        properties: {
          rated_torque: {
            type: "number",
            description: "额定扭矩需求，单位N·m"
          },
          peak_torque: {
            type: "number",
            description: "峰值扭矩需求，单位N·m"
          },
          motor_type: {
            type: "string",
            enum: ["行星模组", "谐波模组", "轻量谐波", "摆线模组", "中空直驱", "无框电机"],
            description: "电机类型筛选"
          },
          voltage: {
            type: "number",
            description: "工作电压，单位V，如24、48、72"
          },
          max_od: {
            type: "number",
            description: "最大外径限制，单位mm"
          },
          max_length: {
            type: "number",
            description: "最大长度限制，单位mm"
          },
          min_speed: {
            type: "number",
            description: "最低转速要求，单位rpm"
          },
        },
        required: ["rated_torque", "peak_torque"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_product",
      description: "查询指定型号电机的详细参数，包括扭矩、功率、转速、尺寸、重量、通信协议等",
      parameters: {
        type: "object",
        properties: {
          model_name: {
            type: "string",
            description: "电机型号，支持简称如X8-120、RH-20，或全称如RMD-X8-P20-120-E"
          },
        },
        required: ["model_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_robot_solution",
      description: "生成机器人整机电机选型方案，自动计算各关节扭矩需求并推荐电机",
      parameters: {
        type: "object",
        properties: {
          robot_type: {
            type: "string",
            enum: ["人形机器人", "机械臂", "四足机器人", "夹爪"],
            description: "机器人类型"
          },
          height: {
            type: "number",
            description: "机器人高度，单位cm（人形/四足适用）"
          },
          payload: {
            type: "number",
            description: "末端负载，单位kg"
          },
          arm_length: {
            type: "number",
            description: "臂展/臂长，单位cm（机械臂适用）"
          },
          speed: {
            type: "string",
            enum: ["低速", "中速", "高速"],
            description: "运动速度等级"
          },
          precision: {
            type: "string",
            enum: ["标准", "高精度", "超高精度"],
            description: "精度要求等级"
          },
        },
        required: ["robot_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_products",
      description: "对比多款电机的参数差异，生成对比表格",
      parameters: {
        type: "object",
        properties: {
          models: {
            type: "array",
            items: { type: "string" },
            description: "要对比的型号列表，如['X8-120', 'RH-25', 'CEM-45']"
          },
        },
        required: ["models"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_products_by_type",
      description: "列出指定类型的所有电机产品，返回该类型全部型号和关键参数",
      parameters: {
        type: "object",
        properties: {
          motor_type: {
            type: "string",
            enum: ["行星模组", "谐波模组", "轻量谐波", "摆线模组", "中空直驱", "无框电机"],
            description: "电机类型"
          },
        },
        required: ["motor_type"],
      },
    },
  },
];

// ============================================================
// 工具函数执行
// ============================================================

async function executeToolCall(toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  let result;

  switch (toolCall.function.name) {
    case 'select_motor':
      result = toolSelectMotor(args);
      break;
    case 'query_product':
      result = toolQueryProduct(args);
      break;
    case 'generate_robot_solution':
      result = toolGenerateRobotSolution(args);
      break;
    case 'compare_products':
      result = toolCompareProducts(args);
      break;
    case 'list_products_by_type':
      result = toolListProductsByType(args);
      break;
    default:
      result = { error: `未知工具: ${toolCall.function.name}` };
  }

  return {
    tool_call_id: toolCall.id,
    role: 'tool',
    name: toolCall.function.name,
    content: JSON.stringify(result),
  };
}

// 工具：电机选型
function toolSelectMotor(args) {
  const tolerance = 5;
  const filters = {};
  if (args.motor_type) filters.types = [args.motor_type];
  if (args.voltage) filters.voltage = String(args.voltage);
  if (args.max_od) filters.maxOd = args.max_od;
  if (args.max_length) filters.maxLength = args.max_length;
  if (args.min_speed) filters.minSpeed = args.min_speed;

  const results = selectProducts(
    args.rated_torque || 0,
    args.peak_torque || 0,
    tolerance,
    filters
  );

  // 返回Top10，精简字段
  return results.slice(0, 10).map(p => ({
    model: p.short,
    full_name: p.full,
    type: p.type,
    rated_torque: p.rated,
    peak_torque: p.peak,
    power: p.power,
    speed: p.speed,
    voltage: p.voltage,
    size: `${p.length || '-'}×${p.od}mm`,
    weight: p.weight,
    comm: p.comm,
    ratio: p.ratio,
    total_deviation: Math.round(p.totalDiff * 100) / 100,
    meets_requirement: p.meetsAll,
    match_level: getDeviationLevel(p, tolerance),
  }));
}

// 工具：产品查询
function toolQueryProduct(args) {
  const name = args.model_name.toLowerCase().trim();
  const product = PRODUCTS.find(p =>
    p.short.toLowerCase() === name ||
    p.full.toLowerCase().includes(name) ||
    p.short.toLowerCase().includes(name)
  );

  if (!product) {
    return { error: `未找到型号 "${args.model_name}"，请检查型号是否正确` };
  }

  return {
    model: product.short,
    full_name: product.full,
    type: product.type,
    rated_torque: product.rated,
    peak_torque: product.peak,
    power: product.power,
    speed: product.speed,
    voltage: product.voltage,
    outer_diameter: product.od,
    length: product.length,
    inner_diameter: product.inner || null,
    weight: product.weight,
    communication: product.comm,
    reduction_ratio: product.ratio,
    brake: product.brake,
    backlash: product.backlash,
    repeatability: product.repeatability,
    control_accuracy: product.controlAccuracy,
    encoder: product.encoder,
    axial_load: product.axialLoad,
    radial_load: product.radialLoad,
    inertia: product.inertia,
  };
}

// 工具：生成机器人方案
function toolGenerateRobotSolution(args) {
  const typeMap = {
    '人形机器人': 'humanoid',
    '机械臂': 'arm',
    '四足机器人': 'quadruped',
    '夹爪': 'gripper',
  };
  const robotType = typeMap[args.robot_type] || 'humanoid';

  // 构建参数对象
  const params = {};
  if (args.height) params.height = args.height;
  if (args.payload) params.payload = args.payload;
  if (args.arm_length) params.armLength = args.arm_length;
  if (args.speed) params.speed = args.speed;
  if (args.precision) params.precision = args.precision;

  try {
    const solution = generateRobotSolution(robotType, params);
    return {
      robot_type: args.robot_type,
      total_joints: solution.joints?.length || 0,
      joints: solution.joints?.map(j => ({
        key: j.key,
        name: j.name,
        required_rated: j.ratedTorque,
        required_peak: j.peakTorque,
        recommended_motor: j.motor?.short || null,
        motor_type: j.motor?.type || null,
      })) || [],
      total_weight: solution.totalWeight || null,
      total_power: solution.totalPower || null,
      summary: solution.summary || '',
    };
  } catch (e) {
    return { error: `方案生成失败: ${e.message}` };
  }
}

// 工具：产品对比
function toolCompareProducts(args) {
  const models = args.models || [];
  const products = models.map(m => {
    const name = m.toLowerCase().trim();
    return PRODUCTS.find(p =>
      p.short.toLowerCase() === name ||
      p.short.toLowerCase().includes(name) ||
      p.full.toLowerCase().includes(name)
    );
  }).filter(Boolean);

  if (products.length === 0) {
    return { error: '未找到任何匹配的产品' };
  }

  return products.map(p => ({
    model: p.short,
    type: p.type,
    rated_torque: p.rated,
    peak_torque: p.peak,
    power: p.power,
    speed: p.speed,
    voltage: p.voltage,
    od: p.od,
    length: p.length,
    weight: p.weight,
    backlash: p.backlash,
    repeatability: p.repeatability,
    ratio: p.ratio,
    comm: p.comm,
  }));
}

// 工具：按类型列出产品
function toolListProductsByType(args) {
  const products = PRODUCTS.filter(p => p.type === args.motor_type);
  return {
    type: args.motor_type,
    count: products.length,
    products: products.map(p => ({
      model: p.short,
      rated_torque: p.rated,
      peak_torque: p.peak,
      power: p.power,
      speed: p.speed,
      weight: p.weight,
    })),
  };
}

// ============================================================
// 带 Function Calling 的对话
// ============================================================

async function callDeepSeekWithTools(question, onStreamChunk) {
  const systemPrompt = buildDeepSeekSystemPrompt();

  // 构建消息列表（系统提示 + 历史窗口 + 当前问题）
  const messages = [
    { role: 'system', content: systemPrompt },
    ...getRecentHistory(DEEPSEEK_CONFIG.historyWindow),
    { role: 'user', content: question },
  ];

  const apiKey = getDeepSeekApiKey();
  if (!apiKey) throw new Error('请先配置DeepSeek API Key');

  // 第一次调用：带tools
  const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getDeepSeekModel(),
      messages: messages,
      tools: DEEPSEEK_TOOLS,
      tool_choice: 'auto',
      ...DEEPSEEK_CONFIG.defaultParams,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API错误: ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;

  // 如果模型要求调用工具
  if (message.tool_calls && message.tool_calls.length > 0) {
    // 执行所有工具调用
    const toolResults = [];
    for (const toolCall of message.tool_calls) {
      const result = await executeToolCall(toolCall);
      toolResults.push(result);
    }

    // 构建第二次调用的消息
    const secondMessages = [
      ...messages,
      message,
      ...toolResults,
    ];

    // 第二次调用：流式输出最终回答
    return await callDeepSeekStream(secondMessages, onStreamChunk);
  } else {
    // 没有工具调用，直接返回内容
    const content = message.content || '';
    if (onStreamChunk) {
      // 模拟流式输出
      for (let i = 0; i < content.length; i++) {
        onStreamChunk(content[i], content.slice(0, i + 1));
        await new Promise(r => setTimeout(r, 10));
      }
    }
    return content;
  }
}

// 获取最近N轮对话历史
function getRecentHistory(n) {
  if (deepseekChatHistory.length <= n) return deepseekChatHistory;
  return deepseekChatHistory.slice(-n);
}

// 添加对话到历史
function addToDeepSeekHistory(role, content) {
  deepseekChatHistory.push({ role, content });
  // 限制历史长度
  if (deepseekChatHistory.length > 50) {
    deepseekChatHistory = deepseekChatHistory.slice(-30);
  }
}

// 清空对话历史
function clearDeepSeekHistory() {
  deepseekChatHistory = [];
}

// ============================================================
// 系统提示词
// ============================================================

function buildDeepSeekSystemPrompt() {
  // 统计各类型产品数量
  const typeCounts = {};
  PRODUCTS.forEach(p => {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
  });

  return `你是脉塔智能电机选型系统的专业AI助手，服务于机器人研发工程师和自动化设备采购人员。

【身份定位】
- 你精通电机选型、机器人动力学、传动系统设计
- 你熟悉脉塔智能全系列47款产品的参数和应用场景
- 回答要专业、准确、有数据支撑，避免模糊表述
- 使用中文回答，重要参数用Markdown表格展示

【产品系列概览】
脉塔智能共有${PRODUCTS.length}款产品，分为6大系列：
1. RMD-X行星模组（${typeCounts['行星模组'] || 0}款）：扭矩0.9~145Nm，背隙10~15弧分，性价比高，适合重载、长寿命场景
2. RH谐波模组（${typeCounts['谐波模组'] || 0}款）：扭矩11~150Nm，背隙<0.5弧分，高精度，适合机器人关节
3. HM轻量谐波（${typeCounts['轻量谐波'] || 0}款）：扭矩3.5~26Nm，轻量化设计，适合小臂、腕部
4. CEM摆线模组（${typeCounts['摆线模组'] || 0}款）：扭矩9~25Nm，高刚性抗冲击，背隙约2弧分
5. H中空直驱（${typeCounts['中空直驱'] || 0}款）：扭矩0.03~1.5Nm，中空走线零背隙，适合云台、低扭矩高精度
6. FL/FLO无框电机（${typeCounts['无框电机'] || 0}款）：扭矩0.1~6Nm，超薄定制化，需外接减速器和编码器

【工具使用规范】
你拥有以下工具，请根据用户问题自动判断是否调用：
- select_motor：用户描述扭矩需求时调用，如"额定50Nm峰值100Nm推荐什么电机"
- query_product：用户询问具体型号参数时调用，如"X8-120的参数是什么"
- generate_robot_solution：用户描述机器人整机需求时调用，如"1.7米人形机器人用什么电机"
- compare_products：用户要求对比多款产品时调用，如"X8-120和RH-25哪个好"
- list_products_by_type：用户想了解某类型全部产品时调用，如"谐波模组有哪些型号"

调用工具时：
1. 参数要从用户问题中准确提取，不确定时可以追问
2. 扭矩单位统一为N·m，尺寸单位为mm
3. 工具返回结果后，基于结果用自然语言总结，不要直接输出JSON
4. 选型结果推荐Top3，并说明各自优缺点和适用场景

【选型原则】
1. 额定扭矩必须满足需求（可接受≤5Nm偏差），峰值扭矩必须满足
2. 高精度场景（机器人关节）优先谐波/摆线，背隙<1弧分
3. 成本敏感场景优先行星模组
4. 尺寸受限时优先中空直驱或无框电机
5. 安全系数默认1.5~2倍，即产品额定扭矩应为需求的1.5倍以上
6. 谐波模组（RH/HM系列）标配抱闸，行星模组（X系列）无抱闸
7. RH系列参数取100减速比高扭矩端数值

【交互规范】
- 主动调用工具获取准确数据，不要凭记忆编造参数
- 选型结果用表格展示，关键参数（扭矩、尺寸、重量）高亮
- 给出推荐理由，说明为什么选这个型号
- 不确定时主动追问细节，不要瞎猜
- 涉及竞品对比时，只基于已知数据，不贬低竞品

【注意事项】
- 所有参数必须来自产品库，不要编造型号
- 如果工具返回空或错误，如实告知用户
- 超出产品库范围的问题，建议联系脉塔销售`;
}

// ============================================================
// API 设置管理
// ============================================================

// 保存DeepSeek设置
function saveDeepSeekSettings() {
  const apiKey = document.getElementById('ds-api-key')?.value.trim() || '';
  const model = document.getElementById('ds-model')?.value || DEEPSEEK_CONFIG.models.chat;
  const useStream = document.getElementById('ds-stream')?.checked !== false;

  if (apiKey) localStorage.setItem('deepseek_api_key', apiKey);
  localStorage.setItem('deepseek_model', model);
  localStorage.setItem('deepseek_stream', useStream ? '1' : '0');

  showToast('DeepSeek设置已保存', 'success');
  updateDeepSeekStatus();
}

// 清除DeepSeek设置
function clearDeepSeekSettings() {
  localStorage.removeItem('deepseek_api_key');
  localStorage.removeItem('deepseek_model');
  localStorage.removeItem('deepseek_stream');
  if (document.getElementById('ds-api-key')) document.getElementById('ds-api-key').value = '';
  showToast('DeepSeek设置已清除', 'info');
  updateDeepSeekStatus();
}

// 更新DeepSeek状态显示
function updateDeepSeekStatus() {
  const statusEl = document.getElementById('ds-api-status');
  if (!statusEl) return;

  const apiKey = getDeepSeekApiKey();
  if (apiKey) {
    statusEl.textContent = '✓ 已配置DeepSeek API';
    statusEl.style.color = '#4CAF50';
  } else {
    statusEl.textContent = '未配置（使用本地知识库）';
    statusEl.style.color = '#FF9800';
  }
}

// 切换DeepSeek设置面板
function toggleDeepSeekSettings() {
  const settings = document.getElementById('deepseek-settings');
  if (!settings) return;

  settings.style.display = settings.style.display === 'none' ? 'block' : 'none';

  if (settings.style.display === 'block') {
    const apiKey = getDeepSeekApiKey();
    const model = getDeepSeekModel();
    const useStream = localStorage.getItem('deepseek_stream') !== '0';

    if (document.getElementById('ds-api-key')) document.getElementById('ds-api-key').value = apiKey;
    if (document.getElementById('ds-model')) document.getElementById('ds-model').value = model;
    if (document.getElementById('ds-stream')) document.getElementById('ds-stream').checked = useStream;

    updateDeepSeekStatus();
  }
}

// 测试DeepSeek API连接
async function testDeepSeekConnection() {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    showToast('请先配置API Key', 'error');
    return;
  }

  const testBtn = document.getElementById('ds-test-btn');
  if (testBtn) {
    testBtn.textContent = '测试中...';
    testBtn.disabled = true;
  }

  try {
    await callDeepSeek([
      { role: 'user', content: '请回复"连接成功"' }
    ], { max_tokens: 50 });
    showToast('DeepSeek API连接成功', 'success');
  } catch (err) {
    showToast('连接失败: ' + err.message, 'error');
  } finally {
    if (testBtn) {
      testBtn.textContent = '测试连接';
      testBtn.disabled = false;
    }
  }
}

// ============================================================
// 统一对话入口（供app.js调用）
// ============================================================

async function askDeepSeek(question) {
  // 添加用户问题到历史
  addToDeepSeekHistory('user', question);

  // 创建AI消息容器（流式输出用）
  const chatDiv = document.getElementById('ai-chat');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message chat-ai';
  messageDiv.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-content">
      <div class="chat-name">智能助手 (DeepSeek)</div>
      <div class="chat-text" id="ds-streaming-text">正在思考...</div>
    </div>
  `;
  chatDiv.appendChild(messageDiv);
  chatDiv.scrollTop = chatDiv.scrollHeight;

  const streamingEl = document.getElementById('ds-streaming-text');
  const useStream = localStorage.getItem('deepseek_stream') !== '0';

  try {
    let answer;

    if (useStream) {
      // 流式输出 + Function Calling
      answer = await callDeepSeekWithTools(question, (chunk, full) => {
        if (streamingEl) {
          streamingEl.innerHTML = formatMarkdown(full);
          chatDiv.scrollTop = chatDiv.scrollHeight;
        }
      });
    } else {
      // 非流式 + Function Calling
      answer = await callDeepSeekWithTools(question, null);
      if (streamingEl) streamingEl.innerHTML = formatMarkdown(answer);
    }

    // 添加到历史
    addToDeepSeekHistory('assistant', answer);

  } catch (err) {
    console.error('DeepSeek调用失败:', err);
    if (streamingEl) {
      streamingEl.innerHTML = `⚠️ DeepSeek API调用失败：${err.message}<br><br>已自动切换到本地知识库回答：<br><br>` + formatMarkdown(analyzeQuestion(question));
    }
    // 降级回答也加入历史
    addToDeepSeekHistory('assistant', analyzeQuestion(question));
  }
}

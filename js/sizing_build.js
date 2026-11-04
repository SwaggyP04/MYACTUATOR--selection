// ===== Sizing 选型计算 + Build-a-Bot 拼装机器人 =====
// 基于WorkBench官方选型工具的功能设计
// 数据来源：脉塔产品手册 + WorkBench 54款完整参数

// ===== Sizing 选型计算核心逻辑 =====

// 重力加速度
const GRAVITY = 9.81;

// 计算选型参数
function calculateSizing(params) {
  const {
    loadWeight,      // 负载重量 kg
    armLength,       // 力臂长度 mm
    targetSpeed,     // 目标转速 rpm
    accelTime,       // 加速时间 s
    safetyFactor,    // 安全系数
    loadInertia,     // 负载转动惯量 kg·m²（可选，默认估算）
    efficiency       // 传动效率（默认0.85）
  } = params;

  // 1. 重力扭矩（持续扭矩）
  // T_gravity = m × g × L
  const armLengthM = armLength / 1000; // 转换为米
  const gravityTorque = loadWeight * GRAVITY * armLengthM;

  // 2. 估算负载转动惯量（如果用户没提供）
  // 简化为质点：J = m × L²
  const J_load = loadInertia || (loadWeight * armLengthM * armLengthM);

  // 3. 角加速度
  // α = (2π × n) / (60 × t)  单位 rad/s²
  const angularAccel = (2 * Math.PI * targetSpeed) / (60 * accelTime);

  // 4. 加速扭矩
  // T_accel = J_total × α
  // J_total 包含负载惯量和电机转子惯量（这里先只算负载，电机惯量在匹配时考虑）
  const accelTorque = J_load * angularAccel;

  // 5. 峰值扭矩（加速时需要克服重力+加速）
  const peakTorqueRaw = gravityTorque + accelTorque;
  const peakTorque = peakTorqueRaw * safetyFactor;

  // 6. 额定扭矩（持续运行时，主要克服重力，考虑效率）
  const ratedTorque = (gravityTorque / (efficiency || 0.85)) * safetyFactor;

  // 7. 所需功率
  // P = T × ω = T × (2πn/60)
  const angularVelocity = (2 * Math.PI * targetSpeed) / 60;
  const requiredPower = peakTorque * angularVelocity;

  return {
    gravityTorque: round2(gravityTorque),
    accelTorque: round2(accelTorque),
    peakTorque: round2(peakTorque),
    ratedTorque: round2(ratedTorque),
    requiredPower: round2(requiredPower),
    angularAccel: round2(angularAccel),
    J_load: round4(J_load),
    // 详细计算过程
    details: {
      gravityFormula: `T_g = m × g × L = ${loadWeight} × 9.81 × ${armLengthM} = ${round2(gravityTorque)} Nm`,
      inertiaFormula: loadInertia 
        ? `J_load = ${loadInertia} kg·m² (用户输入)` 
        : `J_load = m × L² = ${loadWeight} × ${armLengthM}² = ${round4(J_load)} kg·m² (估算)`,
      accelFormula: `α = 2πn / (60t) = 2π × ${targetSpeed} / (60 × ${accelTime}) = ${round2(angularAccel)} rad/s²`,
      accelTorqueFormula: `T_accel = J × α = ${round4(J_load)} × ${round2(angularAccel)} = ${round2(accelTorque)} Nm`,
      peakFormula: `T_peak = (T_g + T_accel) × SF = (${round2(gravityTorque)} + ${round2(accelTorque)}) × ${safetyFactor} = ${round2(peakTorque)} Nm`,
      ratedFormula: `T_rated = T_g / η × SF = ${round2(gravityTorque)} / ${efficiency || 0.85} × ${safetyFactor} = ${round2(ratedTorque)} Nm`,
      powerFormula: `P = T_peak × ω = ${round2(peakTorque)} × ${round2(angularVelocity)} = ${round2(requiredPower)} W`
    }
  };
}

// 辅助函数
function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 10000) / 10000; }

// 执行Sizing选型
function doSizing() {
  const params = {
    loadWeight: parseFloat(document.getElementById('sz-load').value) || 0,
    armLength: parseFloat(document.getElementById('sz-arm').value) || 0,
    targetSpeed: parseFloat(document.getElementById('sz-speed').value) || 0,
    accelTime: parseFloat(document.getElementById('sz-accel').value) || 0.5,
    safetyFactor: parseFloat(document.getElementById('sz-safety').value) || 1.5,
    loadInertia: parseFloat(document.getElementById('sz-inertia').value) || null,
    efficiency: parseFloat(document.getElementById('sz-efficiency').value) || 0.85
  };

  // 校验
  if (params.loadWeight <= 0 || params.armLength <= 0 || params.targetSpeed <= 0) {
    document.getElementById('sz-result').innerHTML = 
      '<div class="card" style="border-color:#f66;"><div class="card-title" style="color:#f66;">⚠️ 参数不完整</div><p>请填写负载重量、力臂长度和目标转速</p></div>';
    return;
  }

  const calc = calculateSizing(params);

  // 筛选条件
  const filters = {
    types: getSelectedTypes('sz-types'),
    comm: document.getElementById('sz-comm').value,
    voltage: document.getElementById('sz-voltage').value,
    maxLength: parseFloat(document.getElementById('sz-length').value) || 0,
    maxOd: parseFloat(document.getElementById('sz-od').value) || 0,
    minSpeed: params.targetSpeed,
    minPower: 0
  };

  // 用现有的选型函数推荐
  const results = selectProducts(calc.ratedTorque, calc.peakTorque, 3, filters);

  // 渲染结果
  renderSizingResult(calc, results, params);
}

// 获取选中的模组类型
function getSelectedTypes(prefix) {
  const checkboxes = document.querySelectorAll(`#${prefix} input[type="checkbox"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

// 渲染Sizing结果
function renderSizingResult(calc, results, params) {
  let html = '';

  // 计算过程卡片
  html += `<div class="card" style="border-left:4px solid #4af;">
    <div class="card-title">📐 扭矩计算过程</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:15px;">
      <div style="background:rgba(74,170,255,0.08);padding:12px;border-radius:6px;">
        <div style="color:#889;font-size:12px;margin-bottom:4px;">重力扭矩 (持续)</div>
        <div style="font-size:22px;font-weight:bold;color:#4af;">${calc.gravityTorque} Nm</div>
        <div style="color:#667;font-size:11px;margin-top:4px;">${calc.details.gravityFormula}</div>
      </div>
      <div style="background:rgba(255,170,68,0.08);padding:12px;border-radius:6px;">
        <div style="color:#889;font-size:12px;margin-bottom:4px;">加速扭矩</div>
        <div style="font-size:22px;font-weight:bold;color:#fa4;">${calc.accelTorque} Nm</div>
        <div style="color:#667;font-size:11px;margin-top:4px;">${calc.details.accelTorqueFormula}</div>
      </div>
      <div style="background:rgba(255,102,102,0.08);padding:12px;border-radius:6px;">
        <div style="color:#889;font-size:12px;margin-bottom:4px;">峰值扭矩 (含安全系数${params.safetyFactor})</div>
        <div style="font-size:22px;font-weight:bold;color:#f66;">${calc.peakTorque} Nm</div>
        <div style="color:#667;font-size:11px;margin-top:4px;">${calc.details.peakFormula}</div>
      </div>
      <div style="background:rgba(102,255,170,0.08);padding:12px;border-radius:6px;">
        <div style="color:#889;font-size:12px;margin-bottom:4px;">额定扭矩 (含效率)</div>
        <div style="font-size:22px;font-weight:bold;color:#6fa;">${calc.ratedTorque} Nm</div>
        <div style="color:#667;font-size:11px;margin-top:4px;">${calc.details.ratedFormula}</div>
      </div>
    </div>
    <div style="margin-top:15px;padding:10px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:12px;color:#889;">
      <strong>负载转动惯量：</strong>${calc.details.inertiaFormula}<br>
      <strong>角加速度：</strong>${calc.details.accelFormula}<br>
      <strong>所需功率：</strong>${calc.details.powerFormula}
    </div>
  </div>`;

  // 推荐结果
  html += `<div class="card" style="margin-top:20px;">
    <div class="card-title">🎯 推荐电机 (${results.length}款匹配)</div>
    <div style="color:#889;font-size:12px;margin-bottom:15px;">按扭矩匹配度排序，绿色=完美匹配，黄色=可接受，红色=明显不足</div>`;

  if (results.length === 0) {
    html += '<p style="color:#889;">没有符合条件的电机，请调整筛选条件或降低要求</p>';
  } else {
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>匹配度</th><th>型号</th><th>类型</th><th>额定扭矩</th><th>峰值扭矩</th><th>额定转速</th><th>功率</th><th>电压</th><th>外径</th><th>总长</th><th>重量</th><th>通讯</th>' +
      '</tr></thead><tbody>';

    results.slice(0, 15).forEach(p => {
      const level = getDeviationLevel(p, 3);
      const levelText = level === 'good' ? '✅ 完美' : level === 'warn' ? '⚠️ 可接受' : '❌ 不足';
      const levelColor = level === 'good' ? '#6fa' : level === 'warn' ? '#fa4' : '#f66';
      html += `<tr style="cursor:pointer;" onclick="showProductDetail('${p.short}')">
        <td><span style="color:${levelColor};font-weight:bold;">${levelText}</span></td>
        <td><strong>${p.short}</strong><br><span style="color:#667;font-size:11px;">${p.full}</span></td>
        <td>${p.type}</td>
        <td>${p.rated} Nm${p.hasRated ? ` <span style="color:${p.meetsRated?'#6fa':'#f66'};font-size:11px;">(${p.ratedOver>=0?'+':''}${p.ratedOver})</span>` : ''}</td>
        <td>${p.peak} Nm${p.hasPeak ? ` <span style="color:${p.meetsPeak?'#6fa':'#f66'};font-size:11px;">(${p.peakOver>=0?'+':''}${p.peakOver})</span>` : ''}</td>
        <td>${p.speed} rpm</td>
        <td>${p.power} W</td>
        <td>${p.voltage}V</td>
        <td>${p.od}mm</td>
        <td>${p.length ? p.length + 'mm' : '-'}</td>
        <td>${p.weight ? p.weight + 'kg' : '-'}</td>
        <td>${p.comm}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
  }

  html += '</div>';
  document.getElementById('sz-result').innerHTML = html;
}

// 重置Sizing
function resetSizing() {
  ['sz-load','sz-arm','sz-speed','sz-accel','sz-safety','sz-inertia','sz-efficiency','sz-length','sz-od'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('sz-accel').value = 0.5;
  document.getElementById('sz-safety').value = 1.5;
  document.getElementById('sz-efficiency').value = 0.85;
  document.getElementById('sz-comm').value = 'all';
  document.getElementById('sz-voltage').value = 'all';
  document.querySelectorAll('#sz-types input[type="checkbox"]').forEach(cb => cb.checked = true);
  document.getElementById('sz-result').innerHTML = '';
}

// ===== Build-a-Bot 拼装机器人生成 =====

// 机器人构型定义
const ROBOT_CONFIGS = {
  humanoid: {
    name: '🤖 人形机器人',
    joints: [
      { id: 'j1', name: 'J1 腰部偏航', defaultMotor: 'X4-36' },
      { id: 'j2', name: 'J2 腰部俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j3', name: 'J3 左肩俯仰', defaultMotor: 'X4-36' },
      { id: 'j4', name: 'J4 左肩偏航', defaultMotor: 'X4-10' },
      { id: 'j5', name: 'J5 左肘俯仰', defaultMotor: 'X4-10' },
      { id: 'j6', name: 'J6 右肩俯仰', defaultMotor: 'X4-36' },
      { id: 'j7', name: 'J7 右肩偏航', defaultMotor: 'X4-10' },
      { id: 'j8', name: 'J8 右肘俯仰', defaultMotor: 'X4-10' },
      { id: 'j9', name: 'J9 左髋俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j10', name: 'J10 左髋偏航', defaultMotor: 'X4-36' },
      { id: 'j11', name: 'J11 左膝俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j12', name: 'J12 左踝俯仰', defaultMotor: 'X4-36' },
      { id: 'j13', name: 'J13 右髋俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j14', name: 'J14 右髋偏航', defaultMotor: 'X4-36' },
      { id: 'j15', name: 'J15 右膝俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j16', name: 'J16 右踝俯仰', defaultMotor: 'X4-36' }
    ]
  },
  arm: {
    name: '🦾 六轴机械臂',
    joints: [
      { id: 'j1', name: 'J1 底座旋转', defaultMotor: 'X6-50-L' },
      { id: 'j2', name: 'J2 大臂俯仰', defaultMotor: 'X8-150-03' },
      { id: 'j3', name: 'J3 小臂俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j4', name: 'J4 腕部偏航', defaultMotor: 'X4-36' },
      { id: 'j5', name: 'J5 腕部俯仰', defaultMotor: 'X4-36' },
      { id: 'j6', name: 'J6 末端旋转', defaultMotor: 'X4-10' }
    ]
  },
  quadruped: {
    name: '🐕 四足机器狗',
    joints: [
      { id: 'j1', name: 'J1 左前髋俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j2', name: 'J2 左前膝俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j3', name: 'J3 右前髋俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j4', name: 'J4 右前膝俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j5', name: 'J5 左后髋俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j6', name: 'J6 左后膝俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j7', name: 'J7 右后髋俯仰', defaultMotor: 'X6-50-L' },
      { id: 'j8', name: 'J8 右后膝俯仰', defaultMotor: 'X6-50-L' }
    ]
  },
  wheeled: {
    name: '🚗 轮式底盘',
    joints: [
      { id: 'j1', name: 'J1 左前轮驱动', defaultMotor: 'X4-10' },
      { id: 'j2', name: 'J2 右前轮驱动', defaultMotor: 'X4-10' },
      { id: 'j3', name: 'J3 左后轮驱动', defaultMotor: 'X4-10' },
      { id: 'j4', name: 'J4 右后轮驱动', defaultMotor: 'X4-10' }
    ]
  }
};

// 当前选中的机器人类型
let currentRobotType = 'arm';

// 初始化Build-a-Bot
function initBuildBot() {
  const typeSelect = document.getElementById('bb-type');
  typeSelect.innerHTML = '';
  Object.entries(ROBOT_CONFIGS).forEach(([key, config]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = config.name;
    typeSelect.appendChild(opt);
  });
  typeSelect.value = currentRobotType;
  renderBuildBotJoints();
}

// 渲染关节列表
function renderBuildBotJoints() {
  const config = ROBOT_CONFIGS[currentRobotType];
  const container = document.getElementById('bb-joints');
  
  let html = `<div style="margin-bottom:15px;color:#889;font-size:13px;">
    <strong>${config.name}</strong> · 共 ${config.joints.length} 个关节 · 为每个关节选择电机型号
  </div>`;
  
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">';
  
  config.joints.forEach((joint, idx) => {
    const motorOptions = PRODUCTS.map(p => 
      `<option value="${p.short}" ${p.short === joint.defaultMotor ? 'selected' : ''}>${p.short} (${p.rated}/${p.peak}Nm)</option>`
    ).join('');
    
    html += `<div style="background:rgba(255,255,255,0.03);border:1px solid #2a3038;border-radius:8px;padding:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="background:#4af;color:#000;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${idx+1}</span>
        <span style="font-size:13px;font-weight:bold;">${joint.name}</span>
      </div>
      <select id="bb-motor-${joint.id}" style="width:100%;padding:8px;background:#0d1117;border:1px solid #445;border-radius:4px;color:#e6edf3;font-size:13px;" onchange="updateBuildBotSummary()">
        ${motorOptions}
      </select>
    </div>`;
  });
  
  html += '</div>';
  container.innerHTML = html;
  updateBuildBotSummary();
}

// 更新汇总信息
function updateBuildBotSummary() {
  const config = ROBOT_CONFIGS[currentRobotType];
  let totalWeight = 0;
  let totalPower = 0;
  let totalRatedTorque = 0;
  let totalPeakTorque = 0;
  const motorCounts = {};
  
  config.joints.forEach(joint => {
    const select = document.getElementById(`bb-motor-${joint.id}`);
    if (!select) return;
    const motorShort = select.value;
    const motor = PRODUCTS.find(p => p.short === motorShort);
    if (motor) {
      totalWeight += motor.weight || 0;
      totalPower += motor.power || 0;
      totalRatedTorque += motor.rated || 0;
      totalPeakTorque += motor.peak || 0;
      motorCounts[motorShort] = (motorCounts[motorShort] || 0) + 1;
    }
  });
  
  const container = document.getElementById('bb-summary');
  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:15px;">
    <div style="background:rgba(74,170,255,0.1);padding:15px;border-radius:8px;text-align:center;">
      <div style="color:#889;font-size:12px;">关节数量</div>
      <div style="font-size:24px;font-weight:bold;color:#4af;">${config.joints.length}</div>
    </div>
    <div style="background:rgba(255,170,68,0.1);padding:15px;border-radius:8px;text-align:center;">
      <div style="color:#889;font-size:12px;">总重量</div>
      <div style="font-size:24px;font-weight:bold;color:#fa4;">${totalWeight.toFixed(2)} kg</div>
    </div>
    <div style="background:rgba(102,255,170,0.1);padding:15px;border-radius:8px;text-align:center;">
      <div style="color:#889;font-size:12px;">总功率</div>
      <div style="font-size:24px;font-weight:bold;color:#6fa;">${totalPower} W</div>
    </div>
    <div style="background:rgba(255,102,102,0.1);padding:15px;border-radius:8px;text-align:center;">
      <div style="color:#889;font-size:12px;">总峰值扭矩</div>
      <div style="font-size:24px;font-weight:bold;color:#f66;">${totalPeakTorque} Nm</div>
    </div>
  </div>`;
  
  // 电机型号统计
  html += '<div style="background:rgba(255,255,255,0.03);padding:15px;border-radius:8px;">';
  html += '<div style="color:#889;font-size:12px;margin-bottom:10px;">📦 BOM 物料清单（电机部分）</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  Object.entries(motorCounts).forEach(([model, count]) => {
    const motor = PRODUCTS.find(p => p.short === model);
    html += `<span style="background:rgba(74,170,255,0.15);border:1px solid rgba(74,170,255,0.3);padding:6px 12px;border-radius:20px;font-size:13px;">
      <strong>${model}</strong> × ${count} <span style="color:#889;font-size:11px;">(${motor ? motor.type : ''})</span>
    </span>`;
  });
  html += '</div></div>';
  
  container.innerHTML = html;
}

// 切换机器人类型
function switchRobotType() {
  currentRobotType = document.getElementById('bb-type').value;
  renderBuildBotJoints();
}

// 导出BOM清单
function exportBOM() {
  const config = ROBOT_CONFIGS[currentRobotType];
  const rows = [['序号', '关节编号', '关节名称', '电机型号', '额定扭矩(Nm)', '峰值扭矩(Nm)', '额定转速(rpm)', '功率(W)', '电压(V)', '重量(kg)', '通讯协议']];
  
  config.joints.forEach((joint, idx) => {
    const select = document.getElementById(`bb-motor-${joint.id}`);
    const motorShort = select ? select.value : '';
    const motor = PRODUCTS.find(p => p.short === motorShort);
    rows.push([
      idx + 1,
      joint.id.toUpperCase(),
      joint.name,
      motorShort,
      motor ? motor.rated : '',
      motor ? motor.peak : '',
      motor ? motor.speed : '',
      motor ? motor.power : '',
      motor ? motor.voltage : '',
      motor ? motor.weight : '',
      motor ? motor.comm : ''
    ]);
  });
  
  // 汇总行
  const totalWeight = config.joints.reduce((sum, joint) => {
    const select = document.getElementById(`bb-motor-${joint.id}`);
    const motor = select ? PRODUCTS.find(p => p.short === select.value) : null;
    return sum + (motor ? motor.weight || 0 : 0);
  }, 0);
  const totalPower = config.joints.reduce((sum, joint) => {
    const select = document.getElementById(`bb-motor-${joint.id}`);
    const motor = select ? PRODUCTS.find(p => p.short === select.value) : null;
    return sum + (motor ? motor.power || 0 : 0);
  }, 0);
  
  rows.push(['', '', '合计', '', '', '', '', totalPower + 'W', '', totalWeight.toFixed(2) + 'kg', '']);
  
  // 用现有的exportToExcel函数
  exportToExcel(rows, `${config.name.replace(/[🤖🦾🐕🚗]/g, '').trim()}_BOM清单.xlsx`);
}

// ===== 产品详情弹窗（增强版，含电气参数和堵转数据） =====
function showProductDetail(short) {
  const p = PRODUCTS.find(x => x.short === short);
  if (!p) return;
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  let electricalHtml = '';
  if (p.noLoadSpeed || p.ratedCurrent || p.efficiency) {
    electricalHtml = `
      <div style="margin-top:20px;">
        <h4 style="color:#4af;margin-bottom:10px;">⚡ 电气参数</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:13px;">
          ${p.noLoadSpeed ? `<div><span style="color:#889;">空载转速：</span>${p.noLoadSpeed} rpm</div>` : ''}
          ${p.noLoadCurrent ? `<div><span style="color:#889;">空载电流：</span>${p.noLoadCurrent} A</div>` : ''}
          ${p.ratedCurrent ? `<div><span style="color:#889;">额定电流：</span>${p.ratedCurrent} A</div>` : ''}
          ${p.peakCurrent ? `<div><span style="color:#889;">峰值电流：</span>${p.peakCurrent} A</div>` : ''}
          ${p.efficiency ? `<div><span style="color:#889;">效率：</span>${p.efficiency}%</div>` : ''}
          ${p.torqueConstant ? `<div><span style="color:#889;">扭矩常数：</span>${p.torqueConstant} Nm/A</div>` : ''}
          ${p.backEMF ? `<div><span style="color:#889;">反电势常数：</span>${p.backEMF} V/krpm</div>` : ''}
          ${p.resistance ? `<div><span style="color:#889;">线电阻：</span>${p.resistance} Ω</div>` : ''}
          ${p.inductance ? `<div><span style="color:#889;">线电感：</span>${p.inductance} mH</div>` : ''}
          ${p.polePairs ? `<div><span style="color:#889;">极对数：</span>${p.polePairs}</div>` : ''}
          ${p.wiring ? `<div><span style="color:#889;">接线方式：</span>${p.wiring} 接法</div>` : ''}
        </div>
      </div>`;
  }
  
  let stallHtml = '';
  if (p.stallData && p.stallData.length > 0) {
    stallHtml = `
      <div style="margin-top:20px;">
        <h4 style="color:#fa4;margin-bottom:10px;">🔥 堵转数据（40°C环境）</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:rgba(255,170,68,0.1);">
            <th style="padding:8px;border:1px solid #333;">堵转扭矩(Nm)</th>
            <th style="padding:8px;border:1px solid #333;">温升(°C)</th>
            <th style="padding:8px;border:1px solid #333;">堵转时间(s)</th>
            <th style="padding:8px;border:1px solid #333;">相电流(A)</th>
          </tr></thead>
          <tbody>
            ${p.stallData.map(s => `<tr>
              <td style="padding:8px;border:1px solid #333;text-align:center;">${s.torque}</td>
              <td style="padding:8px;border:1px solid #333;text-align:center;">${s.tempRise}</td>
              <td style="padding:8px;border:1px solid #333;text-align:center;">${s.time}</td>
              <td style="padding:8px;border:1px solid #333;text-align:center;">${s.current}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
  
  modal.innerHTML = `
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;max-width:800px;width:100%;max-height:85vh;overflow-y:auto;padding:25px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h2 style="color:#e6edf3;margin:0;">${p.short} <span style="color:#889;font-size:16px;font-weight:normal;">${p.full}</span></h2>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:#889;font-size:24px;cursor:pointer;">&times;</button>
      </div>
      <div style="display:inline-block;background:rgba(74,170,255,0.15);color:#4af;padding:4px 12px;border-radius:20px;font-size:13px;margin-bottom:15px;">${p.type} · ${p.series || ''}</div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:15px;">
        <div style="background:rgba(102,255,170,0.08);padding:12px;border-radius:8px;text-align:center;">
          <div style="color:#889;font-size:12px;">额定扭矩</div>
          <div style="font-size:20px;font-weight:bold;color:#6fa;">${p.rated} Nm</div>
        </div>
        <div style="background:rgba(255,102,102,0.08);padding:12px;border-radius:8px;text-align:center;">
          <div style="color:#889;font-size:12px;">峰值扭矩</div>
          <div style="font-size:20px;font-weight:bold;color:#f66;">${p.peak} Nm</div>
        </div>
        <div style="background:rgba(255,170,68,0.08);padding:12px;border-radius:8px;text-align:center;">
          <div style="color:#889;font-size:12px;">额定转速</div>
          <div style="font-size:20px;font-weight:bold;color:#fa4;">${p.speed} rpm</div>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;color:#c9d1d9;">
        <div><span style="color:#889;">额定功率：</span>${p.power} W</div>
        <div><span style="color:#889;">工作电压：</span>${p.voltage} V</div>
        <div><span style="color:#889;">外径：</span>${p.od} mm</div>
        <div><span style="color:#889;">总长：</span>${p.length ? p.length + ' mm' : '-'}</div>
        <div><span style="color:#889;">重量：</span>${p.weight ? p.weight + ' kg' : '-'}</div>
        <div><span style="color:#889;">减速比：</span>${p.ratio}</div>
        <div><span style="color:#889;">通讯协议：</span>${p.comm}</div>
        <div><span style="color:#889;">抱闸：</span>${p.brake}</div>
        <div><span style="color:#889;">背隙：</span>${p.backlash} arcmin</div>
        <div><span style="color:#889;">重复定位精度：</span>${p.repeatability} °</div>
        <div><span style="color:#889;">编码器：</span>${p.encoder}</div>
        <div><span style="color:#889;">轴向负载：</span>${p.axialLoad ? p.axialLoad + ' N' : '-'}</div>
        <div><span style="color:#889;">径向负载：</span>${p.radialLoad ? p.radialLoad + ' N' : '-'}</div>
        <div><span style="color:#889;">转动惯量：</span>${p.inertia ? p.inertia + ' ×10⁻⁶ kg·m²' : '-'}</div>
        ${p.backdriveTorque ? `<div><span style="color:#889;">反驱力矩：</span>${p.backdriveTorque} Nm</div>` : ''}
        ${p.outputBearing ? `<div><span style="color:#889;">输出轴承：</span>${p.outputBearing}</div>` : ''}
      </div>
      
      ${electricalHtml}
      ${stallHtml}
      
      <div style="margin-top:20px;padding:15px;background:rgba(74,170,255,0.05);border:1px solid rgba(74,170,255,0.2);border-radius:8px;">
        <h4 style="color:#4af;margin-bottom:10px;">📐 图纸下载</h4>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${p.drawingPdf ? `<a href="${p.drawingPdf}" target="_blank" style="display:inline-block;background:#238636;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;">📄 下载PDF尺寸图</a>` : '<span style="color:#667;font-size:13px;padding:8px 0;">PDF图纸：暂未上传</span>'}
          ${p.drawingStep ? `<a href="${p.drawingStep}" target="_blank" style="display:inline-block;background:#1f6feb;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;">📦 下载STEP 3D模型</a>` : '<span style="color:#667;font-size:13px;padding:8px 0;margin-left:10px;">STEP模型：暂未上传</span>'}
        </div>
        <div style="color:#667;font-size:11px;margin-top:8px;">💡 提示：图纸链接可在 data.js 中为每个产品配置 drawingPdf 和 drawingStep 字段</div>
      </div>
      
      <div style="margin-top:15px;">
        <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.arrow').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼';" style="cursor:pointer;color:#889;font-size:13px;padding:8px 0;user-select:none;">
          <span class="arrow" style="display:inline-block;width:16px;">▶</span> 📖 查看参数说明（中英文对照）
        </div>
        <div style="display:none;margin-top:10px;max-height:300px;overflow-y:auto;background:rgba(255,255,255,0.02);border:1px solid #2a3038;border-radius:8px;padding:15px;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:rgba(74,170,255,0.1);">
              <th style="padding:6px 8px;border:1px solid #333;text-align:left;color:#4af;">参数名</th>
              <th style="padding:6px 8px;border:1px solid #333;text-align:left;color:#4af;">英文</th>
              <th style="padding:6px 8px;border:1px solid #333;text-align:left;color:#4af;">说明</th>
            </tr></thead>
            <tbody>
              ${Object.entries(PARAM_EXPLANATIONS).map(([key, info]) => `<tr>
                <td style="padding:6px 8px;border:1px solid #333;color:#c9d1d9;">${info.zh}</td>
                <td style="padding:6px 8px;border:1px solid #333;color:#889;">${info.en}</td>
                <td style="padding:6px 8px;border:1px solid #333;color:#889;">${info.desc}${info.unit ? ' (' + info.unit + ')' : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div style="margin-top:20px;text-align:right;">
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:#238636;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;">关闭</button>
      </div>
    </div>`;
  
  document.body.appendChild(modal);
}

// ===== 故障排查库渲染 =====
function renderFaultLibrary() {
  const container = document.getElementById('fault-library');
  if (!container) return;
  
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:15px;">';
  
  FAULT_LIBRARY.forEach((fault, idx) => {
    html += `<div style="background:rgba(255,255,255,0.03);border:1px solid #2a3038;border-radius:8px;padding:15px;cursor:pointer;" onclick="toggleFaultDetail(${idx})">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="background:#f66;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">!</span>
        <strong style="font-size:14px;">${fault.title}</strong>
        <span style="color:#667;font-size:11px;margin-left:auto;">${fault.category}</span>
      </div>
      <div style="color:#889;font-size:12px;">可能原因：${fault.causes.slice(0, 3).join('、')}${fault.causes.length > 3 ? '...' : ''}</div>
      <div id="fault-detail-${idx}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #2a3038;">
        <div style="margin-bottom:10px;"><strong style="color:#fa4;font-size:12px;">🔍 排查步骤：</strong>
          <ul style="margin:5px 0 0 20px;padding:0;color:#aab;font-size:12px;">
            ${fault.checks.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
        <div><strong style="color:#6fa;font-size:12px;">✅ 解决方法：</strong>
          <ul style="margin:5px 0 0 20px;padding:0;color:#aab;font-size:12px;">
            ${fault.fixes.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>`;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function toggleFaultDetail(idx) {
  const el = document.getElementById(`fault-detail-${idx}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ===== 初始化（页面加载完成后执行） =====
document.addEventListener('DOMContentLoaded', () => {
  // 初始化Sizing的类型复选框
  const szTypes = document.getElementById('sz-types');
  if (szTypes) {
    MODULE_TYPES.forEach(type => {
      const label = document.createElement('label');
      label.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-right:12px;cursor:pointer;font-size:13px;';
      label.innerHTML = `<input type="checkbox" value="${type}" checked> ${type}`;
      szTypes.appendChild(label);
    });
  }
  
  // 初始化Build-a-Bot
  if (document.getElementById('bb-type')) {
    initBuildBot();
  }
  
  // 初始化故障排查库
  if (document.getElementById('fault-library')) {
    renderFaultLibrary();
  }
});

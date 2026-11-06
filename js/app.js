// ===== 选型核心逻辑 =====

// 计算单个产品与需求的扭矩偏差（按绝对偏差，接近优先）
function calcDeviation(product, reqRated, reqPeak) {
  // 只计算有需求值的参数
  let ratedDiff = 0, peakDiff = 0;
  let hasRated = reqRated > 0, hasPeak = reqPeak > 0;
  if (hasRated) ratedDiff = Math.abs(product.rated - reqRated);
  if (hasPeak) peakDiff = Math.abs(product.peak - reqPeak);
  // 超出偏差（产品扭矩 - 要求扭矩，正值表示超出，负值表示不足）
  const ratedOver = hasRated ? product.rated - reqRated : 0;
  const peakOver = hasPeak ? product.peak - reqPeak : 0;
  // 不足量（要求扭矩 - 产品扭矩，不足时为正，满足时为0）
  const ratedShort = hasRated ? Math.max(0, reqRated - product.rated) : 0;
  const peakShort = hasPeak ? Math.max(0, reqPeak - product.peak) : 0;
  // 最大不足量（用于判断是否"明显不足"）
  const maxShort = Math.max(ratedShort, peakShort);
  // 是否满足下限（只有有需求值的参数才判断）
  const meetsRated = !hasRated || ratedOver >= 0;
  const meetsPeak = !hasPeak || peakOver >= 0;
  const meetsAll = meetsRated && meetsPeak;
  // 总偏差（只算有需求值的参数）
  const totalDiff = ratedDiff + peakDiff;

  return {
    ratedDiff: hasRated ? Math.round(ratedDiff * 100) / 100 : "-",
    peakDiff: hasPeak ? Math.round(peakDiff * 100) / 100 : "-",
    totalDiff: totalDiff,
    ratedOver: hasRated ? Math.round(ratedOver * 100) / 100 : "-",
    peakOver: hasPeak ? Math.round(peakOver * 100) / 100 : "-",
    meetsRated: meetsRated,
    meetsPeak: meetsPeak,
    meetsAll: meetsAll,
    hasRated: hasRated,
    hasPeak: hasPeak,
    maxShort: maxShort
  };
}

// 选型：略低于要求(≤5Nm)可接受按接近排；明显不足(>5Nm)排后面；避免性能过剩
function selectProducts(reqRated, reqPeak, tolerance, filters) {
  let results = PRODUCTS.map(p => {
    const dev = calcDeviation(p, reqRated, reqPeak);
    return { ...p, ...dev };
  });

  // 模组类型筛选
  if (filters.types && filters.types.length > 0) {
    results = results.filter(p => filters.types.includes(p.type));
  }
  // 通信筛选
  if (filters.comm && filters.comm !== "all") {
    results = results.filter(p => p.comm.includes(filters.comm));
  }
  // 电压筛选
  if (filters.voltage && filters.voltage !== "all") {
    results = results.filter(p => p.voltage === parseInt(filters.voltage));
  }
  // 总长筛选（≤）
  if (filters.maxLength && filters.maxLength > 0) {
    results = results.filter(p => p.length && p.length <= filters.maxLength);
  }
  // 外径筛选（≤）
  if (filters.maxOd && filters.maxOd > 0) {
    results = results.filter(p => p.od && p.od <= filters.maxOd);
  }
  // 转速筛选（≥）
  if (filters.minSpeed && filters.minSpeed > 0) {
    results = results.filter(p => p.speed && p.speed >= filters.minSpeed);
  }
  // 功率筛选（≥）
  if (filters.minPower && filters.minPower > 0) {
    results = results.filter(p => p.power && p.power >= filters.minPower);
  }

  // 排序逻辑：
  // 1. 最大不足量≤5Nm的产品（基本满足，包括略低于要求的），按总偏差从小到大排（避免过剩）
  // 2. 最大不足量>5Nm的产品（明显不足），排到后面
  // 3. 同一组内，偏差接近（差值≤5Nm）时优先选尺寸更小、重量更轻的
  results.sort((a, b) => {
    const aOk = a.maxShort <= 5;
    const bOk = b.maxShort <= 5;
    // 一个基本满足一个明显不足，基本满足的排前面
    if (aOk && !bOk) return -1;
    if (!aOk && bOk) return 1;
    // 都基本满足或都明显不足，按总偏差排
    if (Math.abs(a.totalDiff - b.totalDiff) <= 5) {
      // 偏差接近，小尺寸优先
      if (a.od !== b.od) return a.od - b.od;
      return (a.weight || 999) - (b.weight || 999);
    }
    return a.totalDiff - b.totalDiff;
  });

  return results;
}

// 判断偏差等级（基于总绝对偏差，≤5为最佳）
function getDeviationLevel(product, tolerance) {
  if (product.totalDiff <= 5) return "good";
  if (product.totalDiff <= 10) return "warn";
  return "bad";
}

// ===== 文档解析 =====

// 表头关键词映射
const HEADER_KEYWORDS = {
  position: ["部位", "轴位", "关节", "位置", "名称", "轴", "J1", "J2", "J3", "J4", "J5", "J6", "J7", "关节号"],
  rated: ["额定扭矩", "额定转矩", "额定力矩", "额定扭距", "rated torque", "额定", "持续扭矩"],
  peak: ["峰值扭矩", "峰值转矩", "峰值力矩", "峰值扭距", "peak torque", "峰值", "瞬时扭矩", "最大扭矩"],
  power: ["功率", "额定功率", "power"],
  speed: ["转速", "额定转速", "速度", "speed", "rpm"],
  voltage: ["电压", "工作电压", "额定电压", "voltage", "V"],
  weight: ["重量", "质量", "weight", "kg"],
  od: ["外径", "直径", "尺寸", "od", "diameter"],
  length: ["总长", "长度", "厚度", "length"],
  ratio: ["减速比", "速比", "ratio", "减速"],
  comm: ["通信", "协议", "interface", "ethercat", "can", "rs485"],
  brake: ["抱闸", "刹车", "制动", "brake"],
  count: ["数量", "个数", "台数", "count", "qty"]
};

// 识别列类型
function identifyColumn(header) {
  if (!header) return null;
  const h = String(header).toLowerCase().trim();
  for (const [type, keywords] of Object.entries(HEADER_KEYWORDS)) {
    for (const kw of keywords) {
      if (h.includes(kw.toLowerCase())) return type;
    }
  }
  return null;
}

// 从单元格提取数值
function extractNumber(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  const s = String(cell).trim();
  // 匹配数字（支持小数、范围如"5.5~11"取高值、"≥60"取数值）
  const rangeMatch = s.match(/(\d+\.?\d*)\s*[~～\-到]\s*(\d+\.?\d*)/);
  if (rangeMatch) return parseFloat(rangeMatch[2]); // 范围取高值
  const numMatch = s.match(/(\d+\.?\d*)/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
}

// 解析Excel/CSV文件
function parseExcelDocument(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const allRequirements = [];

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          if (rows.length < 2) return;

          // 找表头行（前5行中找包含扭矩关键词的行）
          let headerRowIdx = 0;
          let colMap = {};
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i];
            const tempMap = {};
            let hasTorque = false;
            row.forEach((cell, idx) => {
              const type = identifyColumn(cell);
              if (type) {
                tempMap[idx] = type;
                if (type === "rated" || type === "peak") hasTorque = true;
              }
            });
            if (hasTorque) {
              headerRowIdx = i;
              colMap = tempMap;
              break;
            }
          }

          // 如果没找到明确表头，尝试第一行
          if (Object.keys(colMap).length === 0) {
            rows[0].forEach((cell, idx) => {
              const type = identifyColumn(cell);
              if (type) colMap[idx] = type;
            });
            headerRowIdx = 0;
          }

          // 解析数据行
          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every(c => c === "" || c === null)) continue;

            const req = { sheet: sheetName, rowNum: i + 1 };
            let hasData = false;

            for (const [colIdx, type] of Object.entries(colMap)) {
              const cell = row[parseInt(colIdx)];
              if (type === "position") {
                req.position = String(cell || "").trim();
                if (req.position) hasData = true;
              } else if (type === "rated") {
                const v = extractNumber(cell);
                if (v !== null) { req.rated = v; hasData = true; }
              } else if (type === "peak") {
                const v = extractNumber(cell);
                if (v !== null) { req.peak = v; hasData = true; }
              } else if (type === "power") {
                const v = extractNumber(cell);
                if (v !== null) req.power = v;
              } else if (type === "speed") {
                const v = extractNumber(cell);
                if (v !== null) req.speed = v;
              } else if (type === "voltage") {
                const v = extractNumber(cell);
                if (v !== null) req.voltage = v;
              } else if (type === "weight") {
                const v = extractNumber(cell);
                if (v !== null) req.weight = v;
              } else if (type === "count") {
                const v = extractNumber(cell);
                if (v !== null) req.count = v;
              } else if (type === "comm") {
                req.comm = String(cell || "").trim();
              } else if (type === "brake") {
                req.brake = String(cell || "").trim();
              }
            }

            // 必须有额定或峰值扭矩才算有效需求
            if (hasData && (req.rated !== undefined || req.peak !== undefined)) {
              if (!req.position) req.position = `第${i + 1}行`;
              allRequirements.push(req);
            }
          }
        });

        resolve(allRequirements);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// 解析Word文档(.docx)
// ===== 纯文本需求解析（支持非表格格式的Word文档）=====
function parsePlainTextRequirements(text) {
  const requirements = [];
  if (!text) return requirements;

  // OCR容错预处理
  // 1. 移除中文之间的多余空格（如"额 定 扭 矩"→"额定扭矩"）
  text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
  // 2. 修复OCR丢失比较符号的情况："J1 80"→"J1≥80"（先处理空格分隔，避免被后续步骤误匹配）
  text = text.replace(/([Jj]\d)\s+(\d+\.?\d*)/g, '$1≥$2');
  // 3. 修复OCR常见错误：把"≥"识别成"2"的情况（如"J1280"→"J1≥80"，无空格格式）
  text = text.replace(/([Jj]\d)2(\d)/g, '$1≥$2');
  // 4. 修复OCR把"J6"识别成"16"的情况（如"16210"→"J6≥10"，"16220"→"J6≥20"）
  text = text.replace(/(\s|;|，|,|^)162(\d)/g, '$1J6≥$2');
  // 5. 修复OCR把"≥"识别成">"或"="的情况，统一为≥
  text = text.replace(/([Jj]\d[\s\-~至到]*[Jj]?\d?)\s*[>＝=]+\s*(\d)/g, '$1≥$2');
  // 6. 修复分号被识别成其他符号的情况
  text = text.replace(/([Jj]\d[\s\-~至到]*[Jj]?\d?\s*[>≥<≤=:：]+\s*\d+\.?\d*)\s*[，,、；;]+\s*/g, '$1; ');
  // 7. 修复"Nm"被识别成"N m"或"NM"的情况
  text = text.replace(/N\s*m/gi, 'Nm');

  const lines = text.split(/[\r\n]+/);
  const posMap = {};

  function normalizePosition(pos) {
    pos = pos.toUpperCase().trim();
    // 范围值（包含连接符）才映射为部位名称，单个J编号保持原样
    if (pos.includes('J1') && pos.includes('J2') && /[\-~至到]/.test(pos)) return '肩部(J1-J2)';
    if (pos.includes('J3') && pos.includes('J4') && /[\-~至到]/.test(pos)) return '肘部(J3-J4)';
    if ((pos.includes('J5') || pos.includes('J6') || pos.includes('J7')) && /[\-~至到]/.test(pos)) return '腕部(J5-J7)';
    if (pos.includes('肩')) return '肩部';
    if (pos.includes('肘')) return '肘部';
    if (pos.includes('腕')) return '腕部';
    return pos;
  }

  function parseParamLine(line, paramType) {
    // 增强正则：支持更多OCR识别格式
    // 格式1：J1≥80（标准格式）
    // 格式2：J1 80（空格分隔，OCR可能丢失比较符号）
    // 格式3：J1:80（冒号分隔）
    // 格式4：J1=80（等号分隔）
    const regex = /([Jj]\d[\s\-~至到]*[Jj]?\d?|[肩肘腕腰底座]+[部关节]?)\s*[>≥<≤=:：]?\s*(\d+\.?\d*)/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const pos = normalizePosition(match[1]);
      const val = parseFloat(match[2]);
      // 过滤明显不合理的值（如转速值100、电压值48等）
      if (val > 0.1 && val < 1000) {
        // 额外校验：如果是扭矩参数，值应该在合理范围（0.5-500Nm）
        if ((paramType === 'rated' || paramType === 'peak') && (val < 0.5 || val > 500)) {
          continue;
        }
        if (!posMap[pos]) posMap[pos] = { position: pos };
        posMap[pos][paramType] = val;
      }
    }
  }

  function extractSection(text, keyword) {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return '';
    let rest = text.substring(idx + keyword.length);
    rest = rest.replace(/^[\sNMnmRPMrpmWwVv:：]+/, '');
    const otherKeywords = ['峰值扭矩', '峰值转速', '峰值转矩', '峰值力矩', '额定扭矩', '额定转矩', '额定力矩', '持续扭矩', '连续扭矩', '峰值功率', '额定功率', '功率', '转速', '电压', '重量'];
    for (const kw of otherKeywords) {
      const kwIdx = rest.toLowerCase().indexOf(kw.toLowerCase());
      if (kwIdx !== -1) {
        rest = rest.substring(0, kwIdx);
        break;
      }
    }
    return rest;
  }

  // 检测一行中是否有多个"J数字>数字"模式（扭矩参数行的特征）
  function countJPatterns(line) {
    const matches = line.match(/[Jj]\d[\s\-~至到]*[Jj]?\d?\s*[>≥<≤=:：]+\s*\d+\.?\d*/g);
    return matches ? matches.length : 0;
  }

  // 第一轮：精确关键词匹配
  lines.forEach(line => {
    const lower = line.toLowerCase();
    if (lower.includes('峰值扭矩') || lower.includes('峰值转矩') || lower.includes('峰值力矩') || lower.includes('peak torque')) {
      const section = extractSection(line, lower.includes('峰值转矩') ? '峰值转矩' : (lower.includes('峰值力矩') ? '峰值力矩' : '峰值扭矩'));
      parseParamLine(section, 'peak');
    }
    if (lower.includes('额定扭矩') || lower.includes('额定转矩') || lower.includes('额定力矩') || lower.includes('持续扭矩') || lower.includes('连续扭矩') || lower.includes('rated torque')) {
      const section = extractSection(line, lower.includes('额定转矩') ? '额定转矩' : (lower.includes('额定力矩') ? '额定力矩' : (lower.includes('持续扭矩') ? '持续扭矩' : (lower.includes('连续扭矩') ? '连续扭矩' : '额定扭矩'))));
      parseParamLine(section, 'rated');
    }
    if (lower.includes('峰值转速') || lower.includes('最大转速') || lower.includes('peak speed')) {
      const section = extractSection(line, lower.includes('峰值转速') ? '峰值转速' : (lower.includes('最大转速') ? '最大转速' : '峰值转速'));
      parseParamLine(section, 'speed');
    }
    if (lower.includes('功率') && lower.includes('w')) {
      const section = extractSection(line, '功率');
      parseParamLine(section, 'power');
    }
  });

  // 检查已匹配到的参数类型
  let hasPeak = false, hasRated = false;
  for (const pos in posMap) {
    if (posMap[pos].peak !== undefined) hasPeak = true;
    if (posMap[pos].rated !== undefined) hasRated = true;
  }

  // 第二轮：OCR容错兜底——如果峰值或额定缺失，尝试补充
  if (!hasPeak || !hasRated) {
    // 找出所有包含多个J数字模式的行（扭矩参数行），排除转速/功率行
    const torqueLines = [];
    lines.forEach(line => {
      if (countJPatterns(line) >= 2) {
        const lower = line.toLowerCase();
        // 排除转速行、功率行、电压行等非扭矩参数行
        if (lower.includes('转速') || lower.includes('rpm') || lower.includes('speed') ||
            lower.includes('功率') || lower.includes('电压') || lower.includes('重量')) {
          return;
        }
        const matchedByFirstRound = lower.includes('峰值扭矩') || lower.includes('峰值转矩') || lower.includes('峰值力矩') ||
                                    lower.includes('额定扭矩') || lower.includes('额定转矩') || lower.includes('额定力矩') ||
                                    lower.includes('持续扭矩') || lower.includes('连续扭矩');
        torqueLines.push({ line, matched: matchedByFirstRound });
      }
    });

    // 先用模糊关键词分配（只处理未被第一轮匹配的行）
    const assignedLines = new Set();
    torqueLines.forEach((item, idx) => {
      if (item.matched) return; // 跳过已被第一轮精确匹配的行
      const lower = item.line.toLowerCase();
      if (!hasPeak && lower.includes('峰')) {
        parseParamLine(item.line, 'peak');
        hasPeak = true;
        assignedLines.add(idx);
      } else if (!hasRated && lower.includes('额')) {
        parseParamLine(item.line, 'rated');
        hasRated = true;
        assignedLines.add(idx);
      }
    });

    // 第三轮：如果还有缺失，且有未分配的扭矩行，按行顺序分配缺失的参数类型
    torqueLines.forEach((item, idx) => {
      if (item.matched || assignedLines.has(idx)) return;
      if (!hasPeak) {
        parseParamLine(item.line, 'peak');
        hasPeak = true;
        assignedLines.add(idx);
      } else if (!hasRated) {
        parseParamLine(item.line, 'rated');
        hasRated = true;
        assignedLines.add(idx);
      }
    });
  }

  // 转换为数组
  for (const pos in posMap) {
    const req = posMap[pos];
    if (req.rated !== undefined || req.peak !== undefined) {
      requirements.push(req);
    }
  }

  return requirements;
}

function parseWordDocument(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
        .then(result => {
          const html = result.value;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const tables = doc.querySelectorAll("table");
          const allRequirements = [];

          tables.forEach((table, tableIdx) => {
            const rows = Array.from(table.querySelectorAll("tr"));
            if (rows.length < 2) return;

            // 找表头行（前5行中找同时包含额定和峰值扭矩关键词的行）
            let headerRowIdx = -1;
            let colMap = {};
            for (let i = 0; i < Math.min(5, rows.length); i++) {
              const cells = Array.from(rows[i].querySelectorAll("td, th"));
              const tempMap = {};
              let hasRated = false, hasPeak = false;
              cells.forEach((cell, idx) => {
                const type = identifyColumn(cell.textContent);
                if (type) {
                  // position类型只在明确匹配"轴位/部位/关节号"等词时才设置，避免短关键词误匹配
                  if (type === "position") {
                    const text = cell.textContent.toLowerCase().trim();
                    if (text.includes("轴位") || text.includes("部位") || text.includes("关节号") ||
                        text.includes("位置") || /^j[1-9]$/i.test(text) || text.includes("名称")) {
                      tempMap[idx] = type;
                    }
                  } else {
                    tempMap[idx] = type;
                  }
                  if (type === "rated") hasRated = true;
                  if (type === "peak") hasPeak = true;
                }
              });
              // 必须同时有额定和峰值扭矩列，才认为是参数需求表（排除技术偏差表等）
              if (hasRated && hasPeak) {
                headerRowIdx = i;
                colMap = tempMap;
                break;
              }
            }

            if (headerRowIdx === -1) return; // 这个表格没有完整的扭矩参数，跳过

            // 如果没识别到position列，默认第一列为部位
            let positionCol = null;
            for (const [idx, type] of Object.entries(colMap)) {
              if (type === "position") positionCol = parseInt(idx);
            }
            if (positionCol === null) positionCol = 0; // 默认第一列

            // 部位名黑名单（这些词出现在部位列时，说明不是真正的轴位/部位）
            const positionBlacklist = ["3d", "cad", "step", "格式", "图纸", "2d", "模型", "文件", "datasheet", "sdk", "esi", "通信协议", "编码器", "回差", "控制模式", "防护", "认证", "备注", "说明"];

            // 解析数据行
            for (let i = headerRowIdx + 1; i < rows.length; i++) {
              const cells = Array.from(rows[i].querySelectorAll("td, th"));
              if (cells.length === 0) continue;
              const isEmpty = cells.every(c => !c.textContent.trim());
              if (isEmpty) continue;

              // 先检查部位列是否在黑名单中，如果是则跳过整行
              const posCheck = cells[positionCol] ? cells[positionCol].textContent.trim().toLowerCase() : "";
              let skipRow = false;
              for (const kw of positionBlacklist) {
                if (posCheck.includes(kw)) { skipRow = true; break; }
              }
              if (skipRow) continue;

              const req = { sheet: `表格${tableIdx + 1}`, rowNum: i + 1 };
              let hasData = false;

              for (const [colIdx, type] of Object.entries(colMap)) {
                const cell = cells[parseInt(colIdx)];
                const text = cell ? cell.textContent.trim() : "";
                if (type === "rated") {
                  const v = extractNumber(text);
                  if (v !== null && v > 0.1) { req.rated = v; hasData = true; }
                } else if (type === "peak") {
                  const v = extractNumber(text);
                  if (v !== null && v > 0.1) { req.peak = v; hasData = true; }
                } else if (type === "power") {
                  const v = extractNumber(text);
                  if (v !== null) req.power = v;
                } else if (type === "speed") {
                  const v = extractNumber(text);
                  if (v !== null) req.speed = v;
                } else if (type === "voltage") {
                  const v = extractNumber(text);
                  if (v !== null) req.voltage = v;
                } else if (type === "weight") {
                  const v = extractNumber(text);
                  if (v !== null) req.weight = v;
                } else if (type === "count") {
                  const v = extractNumber(text);
                  if (v !== null) req.count = v;
                } else if (type === "comm") {
                  req.comm = text;
                } else if (type === "brake") {
                  req.brake = text;
                }
              }

              // 部位列单独处理，校验值是否合理
              let posText = cells[positionCol] ? cells[positionCol].textContent.trim() : "";
              // 如果部位值包含单位符号（kg/Nm/W/V/rpm），说明列识别错了，尝试第一列
              if (/kg|nm|w|v|rpm|≤|≥|~|：/i.test(posText) && cells.length > 1) {
                posText = cells[0] ? cells[0].textContent.trim() : "";
              }
              // 如果还是不对，用功能列（第二列）补充
              if ((!posText || /kg|nm|w|v|rpm/i.test(posText)) && cells.length > 1) {
                const funcText = cells[1] ? cells[1].textContent.trim() : "";
                if (funcText && !/kg|nm|w|v|rpm/i.test(funcText)) {
                  posText = posText ? posText + " " + funcText : funcText;
                }
              }
              req.position = posText || `第${i + 1}行`;

              // 必须有额定或峰值扭矩，且数值合理才算有效需求
              if (hasData && (req.rated !== undefined || req.peak !== undefined)) {
                // 过滤掉明显无效的行（扭矩值过大或过小）
                const maxTorque = Math.max(req.rated || 0, req.peak || 0);
                if (maxTorque > 0.5 && maxTorque < 1000) {
                  allRequirements.push(req);
                }
              }
            }
          });

          // 如果表格解析没有结果，尝试纯文本解析
          if (allRequirements.length === 0) {
            const plainReqs = parsePlainTextRequirements(doc.body.textContent);
            if (plainReqs.length > 0) {
              plainReqs.forEach(r => allRequirements.push(r));
            }
          }

          resolve(allRequirements);
        })
        .catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// 统一文件解析入口（自动判断格式）
function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    return parseWordDocument(file);
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return parseExcelDocument(file);
  } else {
    return Promise.reject(new Error("不支持的文件格式，请上传 .xlsx / .xls / .csv / .docx"));
  }
}

// ===== 生成选型推荐表 =====

function generateSelectionTable(requirements, tolerance, filters) {
  return requirements.map(req => {
    const rated = req.rated || 0;
    const peak = req.peak || 0;
    const candidates = selectProducts(rated, peak, tolerance, filters);
    const best = candidates[0];
    const second = candidates[1];

    return {
      position: req.position,
      count: req.count || 1,
      reqRated: req.rated || "-",
      reqPeak: req.peak || "-",
      reqPower: req.power || "-",
      reqSpeed: req.speed || "-",
      reqVoltage: req.voltage || "-",
      reqWeight: req.weight || "-",
      reqComm: req.comm || "-",
      reqBrake: req.brake || "-",
      // 首选推荐
      bestModel: best ? best.short : "-",
      bestFull: best ? best.full : "-",
      bestType: best ? best.type : "-",
      bestRated: best ? best.rated : "-",
      bestPeak: best ? best.peak : "-",
      bestPower: best ? best.power : "-",
      bestSpeed: best ? best.speed : "-",
      bestVoltage: best ? best.voltage : "-",
      bestSize: best ? ((best.length || "-") + "×" + (best.od || "-")) : "-",
      bestWeight: best ? best.weight : "-",
      bestComm: best ? best.comm : "-",
      bestRatio: best ? best.ratio : "-",
      bestBrake: best ? best.brake : "-",
      bestRatedDiff: best ? best.ratedDiff : "-",
      bestPeakDiff: best ? best.peakDiff : "-",
      bestMeetsAll: best ? best.meetsAll : false,
      bestTotalDiff: best ? best.totalDiff : "-",
      // 备选推荐
      secondModel: second ? second.short : "-",
      secondFull: second ? second.full : "-",
      secondRated: second ? second.rated : "-",
      secondPeak: second ? second.peak : "-",
      secondRatedDiff: second ? second.ratedDiff : "-",
      secondPeakDiff: second ? second.peakDiff : "-",
      secondMeetsAll: second ? second.meetsAll : false
    };
  });
}

// ===== 导出Excel =====

function exportToExcel(tableData, filename) {
  const wsData = [
    ["脉塔电机选型推荐表"],
    ["生成时间：" + new Date().toLocaleString("zh-CN")],
    [],
    ["部位/轴位", "数量", "需求额定(Nm)", "需求峰值(Nm)", "需求功率(W)", "需求转速(rpm)", "需求电压(V)",
     "推荐型号", "完整型号", "模组类型", "额定扭矩(Nm)", "峰值扭矩(Nm)", "额定偏差(Nm)", "峰值偏差(Nm)", "是否满足",
     "功率(W)", "转速(rpm)", "电压(V)", "尺寸(总长×外径)", "重量(kg)", "通信方式", "减速比", "抱闸",
     "备选型号", "备选额定", "备选峰值", "备选额定偏差", "备选峰值偏差"]
  ];

  tableData.forEach(row => {
    wsData.push([
      row.position, row.count, row.reqRated, row.reqPeak, row.reqPower, row.reqSpeed, row.reqVoltage,
      row.bestModel, row.bestFull, row.bestType, row.bestRated, row.bestPeak,
      row.bestRatedDiff, row.bestPeakDiff, row.bestMeetsAll ? "满足" : "不足",
      row.bestPower, row.bestSpeed, row.bestVoltage, row.bestSize, row.bestWeight, row.bestComm, row.bestRatio, row.bestBrake,
      row.secondModel, row.secondRated, row.secondPeak, row.secondRatedDiff, row.secondPeakDiff
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // 设置列宽
  ws["!cols"] = [
    {wch:18},{wch:6},{wch:12},{wch:12},{wch:10},{wch:12},{wch:10},
    {wch:12},{wch:28},{wch:10},{wch:12},{wch:12},{wch:10},{wch:10},
    {wch:8},{wch:10},{wch:8},{wch:16},{wch:10},{wch:18},{wch:10},{wch:8},
    {wch:12},{wch:10},{wch:10},{wch:12},{wch:12}
  ];
  // 合并标题
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:26}}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "选型推荐");
  XLSX.writeFile(wb, filename || "脉塔选型推荐表.xlsx");
}

// ===== 图片识别（OCR）=====
const imageUploadArea = document.getElementById('imageUploadArea');
const imageInput = document.getElementById('imageInput');

if (imageUploadArea && imageInput) {
  imageUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadArea.classList.add('dragover');
  });
  imageUploadArea.addEventListener('dragleave', () => imageUploadArea.classList.remove('dragover'));
  imageUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  });
  imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  });
}

async function handleImageUpload(file) {
  if (!file.type.startsWith('image/')) {
    alert('请上传图片文件（jpg/png/bmp）');
    return;
  }

  const progressDiv = document.getElementById('ocr-progress');
  const progressBar = document.getElementById('ocr-progress-bar');
  const progressText = document.getElementById('ocr-progress-text');

  progressDiv.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = '正在加载OCR引擎...';

  try {
    const result = await Tesseract.recognize(
      file,
      'chi_sim+eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const percent = Math.round(m.progress * 100);
            progressBar.style.width = percent + '%';
            progressText.textContent = '识别中... ' + percent + '%';
          } else if (m.status === 'loading tesseract core') {
            progressText.textContent = '加载OCR核心...';
          } else if (m.status === 'initializing tesseract') {
            progressText.textContent = '初始化OCR引擎...';
          } else if (m.status === 'loading language traineddata') {
            progressText.textContent = '加载中文语言包（首次使用约15MB）...';
          } else if (m.status === 'initializing api') {
            progressText.textContent = '初始化识别API...';
          }
        }
      }
    );

    const text = result.data.text;
    progressText.textContent = '识别完成，正在解析参数...';
    console.log('OCR识别结果:', text);

    // 把OCR识别的原文显示到文本框，供用户核对编辑
    const textInput = document.getElementById('textInput');
    if (textInput) {
      textInput.value = text;
    }

    const requirements = parsePlainTextRequirements(text);

    if (requirements.length === 0) {
      progressDiv.style.display = 'none';
      alert('未识别到有效的扭矩参数\n\n识别到的文字已填入下方文本框，请手动核对编辑后点击"识别文本并生成选型"');
      return;
    }

    parsedRequirements = requirements;
    document.getElementById('doc-config').style.display = 'block';
    showToast(`成功识别 ${requirements.length} 条需求（识别原文已填入文本框，可核对编辑）`, 'success');
    doDocSelect();

    progressDiv.style.display = 'none';

  } catch (err) {
    console.error('OCR识别失败:', err);
    progressDiv.style.display = 'none';
    alert('图片识别失败: ' + err.message + '\n\n建议：1. 确保网络正常（首次需下载语言包） 2. 尝试文本粘贴功能');
  }
}

// ===== 文本粘贴识别 =====
function parseTextInput() {
  const textInput = document.getElementById('textInput');
  const text = textInput.value.trim();

  if (!text) {
    alert('请先粘贴需求文字');
    return;
  }

  const requirements = parsePlainTextRequirements(text);

  if (requirements.length === 0) {
    alert('未识别到有效的扭矩参数，请检查文本格式\n\n支持格式：\n- 峰值扭矩NM：J1-J2>80; J3-J4>65\n- J1：额定≥51Nm，峰值≥102Nm');
    return;
  }

  parsedRequirements = requirements;
  document.getElementById('doc-config').style.display = 'block';
  showToast(`成功识别 ${requirements.length} 条需求`, 'success');
  doDocSelect();
}

// ===== 智能问答模块 =====
let aiChatHistory = [];

// 常见问题知识库
let FAQ_KNOWLEDGE = [
  {
    keywords: ['行星', '谐波', '区别', '差异', '对比'],
    answer: `**行星模组 vs 谐波模组区别：**

1. **减速原理**：行星模组采用行星齿轮减速，谐波模组采用谐波齿轮减速（柔轮+刚轮+波发生器）。

2. **扭矩密度**：谐波模组扭矩密度更高，相同体积下能输出更大扭矩。

3. **精度**：谐波模组回程间隙更小（通常<1弧分），定位精度更高；行星模组有一定齿隙。

4. **寿命**：行星模组寿命更长，耐冲击能力强；谐波模组柔轮有疲劳寿命限制。

5. **成本**：行星模组成本较低，谐波模组成本较高。

6. **应用场景**：
   - 行星模组：工业机械臂、AGV、自动化设备（重载、长寿命需求）
   - 谐波模组：协作机器人、人形机器人、精密设备（高精度、轻量化需求）

脉塔产品：
- 行星模组：RMD-X系列（X2-X15，共16款）
- 谐波模组：RH系列（RH-14到RH-32，共5款）+ HM轻量谐波（4款）`
  },
  {
    keywords: ['抱闸', '刹车', '制动', '断电'],
    answer: `**关于抱闸（刹车）：**

1. **谐波模组（RH / HM 系列）是带抱闸的**；行星模组（X 系列）没有抱闸。
2. 抱闸作用：断电时保持电机位置，防止负载下坠，常用于垂直轴、重力负载场景。
3. 选型含义：垂直轴、机械臂大臂、腿部等需要断电保持的关节，应优先选谐波模组。
4. 行星模组若确实需要抱闸，请联系脉塔确认是否可定制。`
  },
  {
    keywords: ['通信', '协议', 'ethercat', 'can', 'rs485', '总线'],
    answer: `**通信协议支持：**

脉塔电机支持多种通信协议：

1. **EtherCAT**：高性能工业总线，延迟低，适合多轴同步控制（推荐）
2. **CAN BUS**：经典工业总线，成本低，应用广泛
3. **RS485**：串行通信，简单易用，适合单轴控制

具体型号的协议支持请查看产品库或直接询问型号参数。

选型建议：
- 多轴机械臂/机器人：推荐EtherCAT
- 单轴/简单控制：CAN或RS485即可`
  },
  {
    keywords: ['电压', '供电', '电源', '电压范围', '24v', '48v', '72v', '过压', '欠压'],
    answer: `**脉塔电机建议使用电压范围：**

**20~55V**
- RH 双编全系列
- RMD-X2-7、RMD-X4-36、RMD-X4-10、RMD-X6-60、RMD-X8-120

**20~70V**
- RMD-X12-320

**20~80V**
- RMD-X15-450

**电压与转速的关系：**

1. **电压高于额定电压时**：使用的转速不能超过电机的额定转速。

2. **电压低于额定电压时**：可用转速需要按等比例下降；**额定扭矩不变**，但相同扭矩下额定电流会略大一些。具体可参考不同电压下的特性曲线图。

**选型建议：**
- 移动机器人 / AGV：按电池组电压选择，注意电池充满时的最高电压不要超出上表范围
- 工业设备：常规 48V 供电，上述型号基本都能覆盖
- 超出上表范围使用会触发过压或欠压保护，严重时损坏驱动板

**注意**：上表是**可用电压范围**，各型号的**额定电压**（24V / 48V / 72V）请看产品库参数，两者不是一回事。`
  },
  {
    keywords: ['人形机器人', '人形', '机器人', '关节'],
    answer: `**人形机器人关节选型建议：**

人形机器人关节通常要求：高扭矩密度、轻量化、高精度。

推荐方案（全行星模组，基于5kg负载双臂）：
- **肩部（J1-J2）**：峰值>80Nm → X8-120（43/120Nm，96×76mm）
- **肘部（J3-J4）**：峰值>65Nm → X6-60（20/60Nm，80×67.5mm）
- **腕部（J5-J7）**：峰值>25Nm → X4-36（10.5/34Nm，55×61mm）

如果追求更高精度和更轻重量，可考虑：
- RH系列谐波模组（扭矩密度更高）
- HM系列轻量谐波（更轻量化）

请使用"文档导入选型"或"手动选型"功能获取精确推荐。`
  },
  {
    keywords: ['价格', '多少钱', '报价', '成本'],
    answer: `**关于价格：**

抱歉，本选型系统不包含产品价格信息。

价格受以下因素影响：
1. 具体型号和配置
2. 采购数量（批量有优惠）
3. 是否需要断电保持（谐波模组自带抱闸）
4. 是否需要特殊通信协议定制

请联系脉塔智能销售团队获取正式报价：
- 官网：www.myactuator.cn
- 或通过您的业务对接人咨询`
  },
  {
    keywords: ['选型', '怎么选', '如何选', '推荐'],
    answer: `**如何选型：**

您可以通过以下方式获取选型推荐：

1. **手动选型**：输入额定扭矩、峰值扭矩，选择模组类型，点击"开始选型"
2. **文档导入选型**：上传Excel/Word需求文档，系统自动识别参数并推荐
3. **图片识别**：上传需求图片，OCR自动识别参数
4. **文本粘贴**：粘贴需求文字，自动识别参数

选型核心逻辑：
- 优先满足额定扭矩和峰值扭矩（最大不足量≤5Nm为基本满足）
- 基本满足的产品按总偏差从小到大排序（避免性能过剩）
- 偏差接近时优先选尺寸更小、重量更轻的
- 按模组类型分类展示结果

您也可以直接描述需求，例如："我需要峰值50Nm的行星电机"，我来为您推荐。`
  },
  {
    keywords: ['内径', '中空', '中孔', '空心', '穿线', '过孔', 'bore', 'inner'],
    answer: `**关于内径（中空孔）：**

内径（中空孔）是**H系列中空直驱模组**的特有参数，其他系列（行星、谐波、无框等）为实心轴，没有中空孔。

H系列中空直驱模组内径参数：
- H-30-08：外径30mm，内径8mm
- H-35-10：外径35mm，内径10mm
- H-40-15：外径40mm，内径15mm
- H-50-15：外径50mm，内径15mm
- H-70-15：外径70mm，内径15mm
- H-90-15：外径90mm，内径15mm

**中空孔用途**：
- 方便线缆、气管从电机中心穿过
- 适用于旋转台、云台、激光雷达等需要中心走线的场景
- 减少外部线缆缠绕，结构更紧凑

如果您需要大中空孔的高精度旋转方案，推荐H系列中空直驱模组。`
  },
  {
    keywords: ['尺寸', '外径', '长度', '体积', '多大'],
    answer: `**关于尺寸：**

产品尺寸格式为：**总长×外径 mm**

各系列典型尺寸范围：
- X2系列：40mm外径，总长48.5-63.5mm（最小）
- X4系列：55mm外径，总长61mm
- X6系列：80mm外径，总长63.5-67.5mm
- X8系列：96mm外径，总长71-76mm
- X10系列：124mm外径，总长63.5mm
- X12系列：150mm外径，总长76.2-85mm
- X15系列：180mm外径，总长95mm（最大）
- RH系列：68-120mm外径
- HM系列：70-100mm外径（轻量化）

具体型号尺寸请查看产品库或询问具体型号。`
  },
  {
    keywords: ['重量', '多重', '质量', 'kg'],
    answer: `**关于重量：**

各系列典型重量范围：
- X2系列：约0.3-0.5kg
- X4系列：约0.8-1.2kg
- X6系列：约1.5-2.0kg
- X8系列：约2.5-3.5kg
- X10系列：约4.5kg
- X12系列：约7-8kg
- X15系列：约12kg
- RH系列：约0.6-3.5kg（N版/B版重量不同）
- HM系列：约0.5-1.5kg（轻量化设计）

具体型号重量请查看产品库或询问具体型号。

注：谐波模组（RH / HM 系列）带抱闸；行星模组（X 系列）无抱闸。`
  },
  {
    keywords: ['转速', '速度', 'rpm', '多快'],
    answer: `**关于转速：**

脉塔电机转速因型号而异，典型范围：
- 小功率电机（X2/X4）：输出转速约50-100rpm
- 中功率电机（X6/X8）：输出转速约30-60rpm
- 大功率电机（X10/X12/X15）：输出转速约20-40rpm
- 谐波模组（RH/HM）：输出转速约20-50rpm

注意：以上为减速后输出转速，电机本体转速通常更高（数千rpm）。

具体型号转速请查看产品库或询问具体型号。`
  },
  {
    keywords: ['背隙', '回程间隙', '齿隙', '空程', 'arcmin', '弧分'],
    answer: `**关于背隙（回程间隙）：**

背隙是减速器输出轴在输入轴固定时可转动的角度，单位为弧分(arcmin)，1度=60弧分。

脉塔各系列背隙参数：
1. **行星模组（X系列）**：约10-15弧分
   - X2系列：12-15弧分
   - X4/X6/X8/X10/X12/X15系列：约10弧分
2. **谐波模组（RH系列）**：<1弧分（接近零背隙）
3. **轻量谐波（HM系列）**：约0.8弧分
4. **摆线模组（CEM系列）**：约2弧分
5. **中空直驱（H系列）**：0弧分（直驱无减速器）
6. **无框电机（FL/FLO系列）**：0弧分（需外接减速器）

**选型建议：**
- 高精度场景（精密装配、测量）：选谐波模组（背隙<1弧分）
- 一般工业场景：行星模组即可（10-15弧分）
- 对背隙零要求：直驱电机或高精度谐波

在"方案推荐"功能中可设置背隙要求，系统会自动筛选符合要求的产品。`
  },
  {
    keywords: ['精度', '重复定位', '定位精度', '控制精度', '误差', '准确度'],
    answer: `**关于控制精度与重复定位精度：**

**重复定位精度**：多次运动到同一位置的偏差程度，单位为度。

脉塔各系列重复定位精度：
1. **谐波模组（RH系列）**：<0.01度（最高精度）
2. **轻量谐波（HM系列）**：约0.02度
3. **摆线模组（CEM系列）**：约0.05度
4. **行星模组（X系列）**：约0.08-0.5度
   - 大扭矩型号（X10/X12/X15）：0.08-0.1度
   - 中扭矩型号（X6/X8）：0.1-0.15度
   - 小扭矩型号（X2/X4）：0.2-0.5度
5. **中空直驱（H系列）**：约0.05度

**控制精度**：脉塔电机采用双编码器（输入+输出），控制精度可达<0.01度。

**选型建议：**
- 精密装配、手术机器人：选RH谐波（<0.01度）
- 协作机器人：RH谐波或HM轻量谐波
- 工业机械臂：X系列行星模组即可
- 高精度云台：H系列直驱

在"方案推荐"功能中可设置重复定位精度要求，系统会自动筛选。`
  },
  {
    keywords: ['编码器', '编码', '分辨率', '绝对值', '增量', '17bit', '双编码器'],
    answer: `**关于编码器：**

脉塔电机编码器配置：

1. **双编码器配置**（大部分型号）：
   - 输入编码器：ABS-17BIT绝对式（电机端）
   - 输出编码器：17-18BIT绝对式（负载端）
   - 优势：可实时监测负载端实际位置，消除减速器误差

2. **单编码器配置**（部分型号）：
   - X2-3、X2-7-L、X8-32、H系列：单编码器17BIT

3. **无框电机（FL/FLO系列）**：需外接编码器

**编码器作用：**
- 位置反馈：精确控制电机转角
- 速度反馈：实现稳定的速度控制
- 电流反馈：实现力矩控制
- 双编码器可补偿减速器背隙和弹性变形

**选型建议：**
- 高精度场景：选双编码器型号
- 成本敏感场景：单编码器也可满足基本需求

具体型号编码器配置请查看产品库或询问具体型号。`
  },
  {
    keywords: ['方案', '系统方案', '组成方案', '机器人方案', '选型方案', '推荐方案'],
    answer: `**关于机器人系统方案推荐：**

本系统提供"方案推荐"功能，可根据您的需求自动生成完整的机器人关节选型方案。

**支持的机器人类型：**
1. **人形机器人**：输入身高、重量、负载、行走速度，自动生成全身30+关节方案
2. **机械臂**：输入末端负载、臂展、轴数，自动生成6/7轴关节方案
3. **四足机器狗**：输入重量、负载、速度，自动生成12自由度腿部方案
4. **夹爪/灵巧手**：输入夹持力、抓取重量，自动生成末端执行器方案

**方案包含内容：**
- 总自由度、关节数量、估算总功率
- 每个关节的负载、额定扭矩、峰值扭矩
- 每个关节推荐前3款脉塔电机
- 满足状态判断（精确满足/满足/满足但过配）
- 推荐电机BOM清单（型号、数量、参数汇总）
- 背隙和重复定位精度参数

**精度筛选：**
- 可设置背隙要求（弧分）和重复定位精度要求（度）
- 系统会优先推荐符合精度要求的产品
- 例如要求背隙<1弧分，会优先推荐谐波模组

使用方法：点击顶部"方案推荐"标签，选择机器人类型，输入参数，点击"生成方案"。`
  }
];

;

/* ═══════════════════════════════════════════════════════════════════
   ★ 常见问题：从 data/faq.json 加载 + 渲染成可折叠列表
   ───────────────────────────────────────────────────────────────────
   · data/faq.json 可在 /admin.html 在线编辑（GitHub Token 登录）
   · 加载失败自动沿用上面内置的 15 条
   · 字段：question（标题）、keywords（数组）、answer（Markdown）
   ═══════════════════════════════════════════════════════════════════ */

function faqGuessTitle(f) {
  if (f.question && String(f.question).trim()) return String(f.question).trim();
  const m = String(f.answer == null ? '' : f.answer).match(/\*\*(.+?)\*\*/);
  if (m) return m[1].replace(/[:：]\s*$/, '').trim();
  if (Array.isArray(f.keywords) && f.keywords.length) return String(f.keywords[0]);
  return '常见问题';
}

function faqEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function faqMarkdown(text) {
  let s = faqEscape(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = s.split(/\r?\n/);
  const out = [];
  let listType = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      // 空行不关闭列表：列表项之间留空行时，序号继续递增而不是从 1 重来
      continue;
    }
    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const ul = line.match(/^\s*[-*・]\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') { if (listType) out.push('</' + listType + '>'); out.push('<ol>'); listType = 'ol'; }
      out.push('<li>' + ol[2] + '</li>');
    } else if (ul) {
      if (listType !== 'ul') { if (listType) out.push('</' + listType + '>'); out.push('<ul>'); listType = 'ul'; }
      out.push('<li>' + ul[1] + '</li>');
    } else {
      if (listType) { out.push('</' + listType + '>'); listType = null; }

      // 独占一行的图片 → 自适应大图
      const imgOnly = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
      if (imgOnly) {
        out.push('<figure class="faq-figure">' +
          '<img class="faq-img" loading="lazy" src="' + imgOnly[2] + '" alt="' + imgOnly[1] + '"' +
          ' onclick="openFaqImage(this.src)" title="点击放大">' +
          (imgOnly[1] ? '<figcaption>' + imgOnly[1] + '</figcaption>' : '') +
          '</figure>');
        continue;
      }

      // 行内图片
      const inline = line.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
        '<img class="faq-img-inline" loading="lazy" src="$2" alt="$1" onclick="openFaqImage(this.src)" title="点击放大">');
      out.push('<p>' + inline + '</p>');
    }
  }
  if (listType) out.push('</' + listType + '>');
  return out.join('');
}

function renderFAQList() {
  const box = document.getElementById('faq-list');
  if (!box) return;
  const cnt = document.getElementById('faq-count');
  if (typeof FAQ_KNOWLEDGE === 'undefined' || !FAQ_KNOWLEDGE.length) {
    box.innerHTML = '<div style="text-align:center;color:#667788;padding:30px;">暂无常见问题</div>';
    if (cnt) cnt.textContent = '';
    return;
  }
  if (cnt) cnt.textContent = '共 ' + FAQ_KNOWLEDGE.length + ' 条';
  box.innerHTML = FAQ_KNOWLEDGE.map(function (f, i) {
    const title = faqEscape(faqGuessTitle(f));
    return '<div class="faq-item">' +
      '<div class="faq-question" onclick="toggleFAQItem(' + i + ')">' +
        '<span class="faq-num">' + (i + 1) + '</span>' +
        '<span class="faq-title">' + title + '</span>' +
        '<span class="faq-arrow" id="faq-arrow-' + i + '">▸</span>' +
      '</div>' +
      '<div class="faq-answer" id="faq-answer-' + i + '" style="display:none;">' +
        faqMarkdown(f.answer) + faqImageGallery(f) +
      '</div>' +
    '</div>';
  }).join('');
}

function toggleFAQItem(i) {
  const a = document.getElementById('faq-answer-' + i);
  const r = document.getElementById('faq-arrow-' + i);
  if (!a) return;
  const open = a.style.display !== 'none';
  a.style.display = open ? 'none' : 'block';
  if (r) r.textContent = open ? '▸' : '▾';
}

/* 启动：从 data/faq.json 拉取；失败则沿用内置 */
(function loadFAQFromJSON() {
  try {
    fetch('data/faq.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!Array.isArray(d) || !d.length) return;
        FAQ_KNOWLEDGE.length = 0;
        d.forEach(function (x) {
          FAQ_KNOWLEDGE.push({
            question: x.question || '',
            keywords: Array.isArray(x.keywords) ? x.keywords : [],
            answer: String(x.answer == null ? '' : x.answer),
            images: Array.isArray(x.images)
              ? x.images.filter(function (im) { return im && im.url; })
              : []
          });
        });
        console.log('[FAQ] 已从 data/faq.json 加载 ' + FAQ_KNOWLEDGE.length + ' 条');
        renderFAQList();
      })
      .catch(function (e) { console.warn('[FAQ] data/faq.json 加载失败，使用内置数据', e); });
  } catch (e) {
    console.warn('[FAQ] 初始化异常', e);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { renderFAQList(); });
  } else {
    setTimeout(renderFAQList, 0);
  }
})();// 主问答函数
function askAI() {
  const input = document.getElementById('ai-input');
  const question = input.value.trim();
  
  if (!question) {
    showToast('请输入您的问题', 'error');
    return;
  }
  
  // 添加用户问题到对话
  addChatMessage('user', question);
  input.value = '';
  
  // ★ 2026-11 已按要求移除全部在线 AI（DeepSeek / 豆包），只用本地知识库
  //   本地知识库 = 18 条 FAQ + 产品型号匹配 + 选型建议 + 类型筛选
  //   零网络请求、零 API Key、零费用
  const answer = analyzeQuestion(question);
  setTimeout(() => {
    addChatMessage('ai', answer);
  }, 200);
}

// ★ 2026-11 已停用：豆包 API 调用（保留函数名以防外部引用，但内部直接降级到本地知识库）
async function callDoubaoAPI(question, apiKey, endpoint) {
  // 强制降级：不做任何网络请求
  const localAnswer = analyzeQuestion(question);
  setTimeout(() => { addChatMessage('ai', localAnswer); }, 200);
  return;

  // ↓↓↓ 以下为原在线调用代码，已停用（保留备查，永不执行）↓↓↓
  // 显示"正在思考"状态
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'chat-message chat-ai';
  thinkingDiv.id = 'ai-thinking';
  thinkingDiv.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-content">
      <div class="chat-name">智能助手</div>
      <div class="chat-text">正在思考...</div>
    </div>
  `;
  document.getElementById('ai-chat').appendChild(thinkingDiv);
  document.getElementById('ai-chat').scrollTop = document.getElementById('ai-chat').scrollHeight;
  
  try {
    // 构建系统提示词，包含产品库信息
    const systemPrompt = buildSystemPrompt();
    
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: endpoint,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    // 移除"正在思考"
    const thinking = document.getElementById('ai-thinking');
    if (thinking) thinking.remove();
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'API调用失败: ' + response.status);
    }
    
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '抱歉，未能获取回答';
    
    addChatMessage('ai', answer);
    
  } catch (err) {
    // 移除"正在思考"
    const thinking = document.getElementById('ai-thinking');
    if (thinking) thinking.remove();
    
    console.error('豆包API调用失败:', err);
    addChatMessage('ai', `⚠️ 豆包API调用失败：${err.message}\n\n已自动切换到本地知识库回答：\n\n` + analyzeQuestion(question));
  }
}

// 构建系统提示词
function buildSystemPrompt() {
  let prompt = `你是脉塔智能电机选型系统的智能助手，专业回答客户关于电机选型的问题。

【产品库信息】
脉塔智能共有47款产品，分为6大系列：
1. RMD-X行星模组（16款）：X2-3, X2-7, X2-7-L, X4-10, X4-10-L, X4-36, X4-36-L, X6-50-L, X6-60, X8-32, X8-120, X8-150-03, X10-200, X12-320, X12-320-L, X15-450
2. RH谐波模组（5款）：RH-14, RH-17, RH-20, RH-25, RH-32
3. HM轻量谐波（4款）：HM-40, HM-50, HM-60, HM-70
4. CEM摆线模组（3款）：CEM-15, CEM-25, CEM-45
5. H中空直驱（6款）：H-30-08, H-35-10, H-40-15, H-50-15, H-70-15, H-90-15
6. FL/FLO无框电机（13款）

【回答规则】
1. 优先根据产品库信息回答，参数要准确
2. 选型建议要考虑：额定扭矩、峰值扭矩、功率、转速、电压、尺寸、重量
3. 行星模组适合重载、长寿命；谐波模组适合高精度、轻量化
4. 最大不足量≤5Nm算基本满足，优先推荐偏差小的型号，避免性能过剩
5. 回答要简洁专业，使用markdown格式，重要参数用表格展示
6. 如果问题超出产品库范围，如实告知并建议联系销售

【部分产品参数参考】
`;
  
  // 添加前10款产品的详细参数作为参考
  const sampleProducts = PRODUCTS.slice(0, 15);
  sampleProducts.forEach(p => {
    prompt += `- ${p.short}（${p.type}）：额定${p.rated}Nm/峰值${p.peak}Nm，${p.power}W，${p.speed}rpm，${p.voltage}V，${p.length || '-'}×${p.od}mm，${p.weight || '-'}kg\n`;
  });
  
  return prompt;
}

// API设置相关函数
function toggleAISettings() {
  const settings = document.getElementById('ai-settings');
  settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
  
  // 加载已保存的设置
  if (settings.style.display === 'block') {
    const apiKey = localStorage.getItem('doubao_api_key') || '';
    const endpoint = localStorage.getItem('doubao_endpoint') || '';
    document.getElementById('ai-api-key').value = apiKey;
    document.getElementById('ai-endpoint').value = endpoint;
    updateAPIStatus();
  }
}

function saveAISettings() {
  const apiKey = document.getElementById('ai-api-key').value.trim();
  const endpoint = document.getElementById('ai-endpoint').value.trim();
  
  if (apiKey) localStorage.setItem('doubao_api_key', apiKey);
  if (endpoint) localStorage.setItem('doubao_endpoint', endpoint);
  
  showToast('API设置已保存', 'success');
  updateAPIStatus();
}

function clearAISettings() {
  localStorage.removeItem('doubao_api_key');
  localStorage.removeItem('doubao_endpoint');
  document.getElementById('ai-api-key').value = '';
  document.getElementById('ai-endpoint').value = '';
  showToast('API设置已清除', 'info');
  updateAPIStatus();
}

function updateAPIStatus() {
  const apiKey = localStorage.getItem('doubao_api_key');
  const endpoint = localStorage.getItem('doubao_endpoint');
  const statusEl = document.getElementById('ai-api-status');
  
  if (apiKey && endpoint) {
    statusEl.textContent = '✓ 已配置豆包API';
    statusEl.style.color = '#4CAF50';
  } else {
    statusEl.textContent = '未配置（使用本地知识库）';
    statusEl.style.color = '#FF9800';
  }
}

// 清空对话
function clearAI() {
  aiChatHistory = [];
  if (typeof clearDeepSeekHistory === 'function') clearDeepSeekHistory();
  document.getElementById('ai-chat').innerHTML = '';
  document.getElementById('ai-result-card').style.display = 'none';
}

// markdown格式转换
function formatMarkdown(text) {
  // 1. 处理表格
  const tableRegex = /(?:^\|.+\|$\n?)+(?:^\|[-: |]+\|$\n?)(?:^\|.+\|$\n?)+/gm;
  text = text.replace(tableRegex, (table) => {
    const rows = table.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return table;
    
    const separatorIdx = rows.findIndex(r => /^\|[-: |]+\|$/.test(r.trim()));
    if (separatorIdx === -1) return table;
    
    const headerCells = rows[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const bodyRows = rows.slice(separatorIdx + 1);
    
    let html = '<table>';
    html += '<thead><tr>' + headerCells.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
    html += '<tbody>';
    bodyRows.forEach(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
      html += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    return html;
  });
  
  // 2. 处理加粗
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // 3. 处理列表项（在非表格行中）
  text = text.replace(/^- /gm, '• ');
  
  // 4. 处理换行（表格内不转换）
  text = text.replace(/\n/g, (match, offset, str) => {
    // 检查是否在表格内
    const before = str.substring(0, offset);
    const tableStart = before.lastIndexOf('<table>');
    const tableEnd = before.lastIndexOf('</table>');
    if (tableStart > tableEnd) return match; // 在表格内，保留换行
    return '<br>';
  });
  
  return text;
}

// 添加聊天消息
function addChatMessage(role, content) {
  const chatDiv = document.getElementById('ai-chat');
  const resultCard = document.getElementById('ai-result-card');
  
  resultCard.style.display = 'block';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message chat-' + role;
  
  const avatar = role === 'user' ? '👤' : '🤖';
  const name = role === 'user' ? '您' : '智能助手';
  
  // 处理markdown格式的回答
  let formattedContent = formatMarkdown(content);
  
  messageDiv.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-content">
      <div class="chat-name">${name}</div>
      <div class="chat-text">${formattedContent}</div>
    </div>
  `;
  
  chatDiv.appendChild(messageDiv);
  chatDiv.scrollTop = chatDiv.scrollHeight;
  
  aiChatHistory.push({ role, content });
}

// 分析问题
function analyzeQuestion(question) {
  const q = question.toLowerCase();
  
  // 1. 尝试匹配产品型号查询
  const productAnswer = matchProductQuery(question);
  if (productAnswer) return productAnswer;
  
  // 2. 尝试匹配选型建议（扭矩需求）
  const selectionAnswer = matchSelectionQuery(question);
  if (selectionAnswer) return selectionAnswer;
  
  // 3. 尝试匹配常见问题
  for (const faq of FAQ_KNOWLEDGE) {
    const matched = faq.keywords.some(kw => q.includes(kw.toLowerCase()));
    if (matched) return faq.answer;
  }
  
  // 4. 尝试按类型筛选产品
  const typeAnswer = matchTypeQuery(question);
  if (typeAnswer) return typeAnswer;
  
  // 5. 默认回答
  return `抱歉，本地知识库里没有匹配到这个问题。

您可以换个方式提问，例如：
- **产品参数**："X8-120的参数是什么"
- **选型建议**："我需要峰值50Nm，推荐什么型号"
- **技术对比**："行星和谐波有什么区别"
- **常见问题**："支持什么通信协议"、"谐波模组带抱闸吗"

也可以直接去这几个页面：
- **❓ 常见问题** — 18 条已整理好的问答
- **🛠 支持中心** — 11 类故障码、排障向导、37 个参数含义
- **手动选型 / 文档导入选型** — 按参数精确推荐
- **产品库** — 71 款产品的完整规格`;
}

// 匹配产品型号查询
function matchProductQuery(question) {
  const q = question.toLowerCase();
  
  // 遍历所有产品，匹配型号
  for (const product of PRODUCTS) {
    const shortLower = product.short.toLowerCase();
    const fullLower = product.full.toLowerCase();
    
    if (q.includes(shortLower) || q.includes(fullLower)) {
      return formatProductAnswer(product);
    }
  }
  
  return null;
}

// 格式化产品参数回答
function formatProductAnswer(p) {
  const size = (p.length || '-') + '×' + (p.od || '-') + ' mm';
  const weight = p.weight ? p.weight + ' kg' : '-';
  
  return `**${p.full}** 参数信息：

| 参数 | 值 |
|------|-----|
| 型号 | ${p.short} |
| 模组类型 | ${p.type} |
| 额定扭矩 | ${p.rated} Nm |
| 峰值扭矩 | ${p.peak} Nm |
| 额定功率 | ${p.power} W |
| 额定转速 | ${p.speed} rpm |
| 额定电压 | ${p.voltage} V |
| 尺寸（总长×外径） | ${size} |
| 重量 | ${weight} |
| 减速比 | ${p.ratio} |
| 通信协议 | ${p.comm} |
| 抱闸 | ${p.brake} |

**选型提示**：
- 该型号${p.type}，额定${p.rated}Nm/峰值${p.peak}Nm
- 适合需要${Math.round(p.rated * 0.8)}-${p.rated}Nm额定扭矩的应用
- 如需对比其他型号，请使用"手动选型"功能输入您的需求参数`;
}

// 匹配选型建议查询
function matchSelectionQuery(question) {
  const q = question.toLowerCase();
  
  // 提取扭矩数值
  let rated = null, peak = null;
  
  // 匹配"额定XX"、"峰值XX"
  const ratedMatch = q.match(/额定[^0-9]*(\d+\.?\d*)/);
  const peakMatch = q.match(/峰值[^0-9]*(\d+\.?\d*)/);
  
  if (ratedMatch) rated = parseFloat(ratedMatch[1]);
  if (peakMatch) peak = parseFloat(peakMatch[1]);
  
  // 如果没有明确额定/峰值，尝试提取单个扭矩值
  if (!rated && !peak) {
    const torqueMatch = q.match(/(\d+\.?\d*)\s*(nm|牛米|扭矩)/);
    if (torqueMatch) {
      // 假设是峰值扭矩
      peak = parseFloat(torqueMatch[1]);
    }
  }
  
  if (!rated && !peak) return null;
  
  // 确定模组类型筛选
  let typeFilter = null;
  if (q.includes('行星')) typeFilter = '行星模组';
  else if (q.includes('谐波')) typeFilter = '谐波模组';
  else if (q.includes('轻量谐波')) typeFilter = '轻量谐波';
  else if (q.includes('摆线')) typeFilter = '摆线模组';
  else if (q.includes('直驱')) typeFilter = '中空直驱';
  else if (q.includes('无框')) typeFilter = '无框电机';
  
  // 使用选型算法
  const filters = { types: typeFilter ? [typeFilter] : MODULE_TYPES.slice(), comm: 'all', voltage: 'all' };
  const results = selectProducts(rated || 0, peak || 0, 5, filters);
  
  if (results.length === 0) {
    return `抱歉，没有找到匹配的产品。

您的需求：额定${rated || '-'}Nm，峰值${peak || '-'}Nm${typeFilter ? '，' + typeFilter : ''}

建议：
1. 放宽扭矩要求
2. 尝试其他模组类型
3. 使用"手动选型"功能调整容差参数`;
  }
  
  // 取前3个推荐
  const top3 = results.slice(0, 3);
  
  const typeStr = typeFilter ? '，' + typeFilter : '';
  let answer = `根据您的需求（额定${rated || '不限'}Nm，峰值${peak || '不限'}Nm${typeStr}），为您推荐以下型号：\n\n`;
  
  top3.forEach((p, idx) => {
    const meetsText = p.meetsAll ? '✓ 满足' : '⚠ 基本满足（偏差≤5Nm）';
    answer += `${idx + 1}. **${p.short}**（${p.type}）\n`;
    answer += `   - 额定：${p.rated}Nm，峰值：${p.peak}Nm\n`;
    answer += `   - 功率：${p.power}W，转速：${p.speed}rpm\n`;
    answer += `   - 尺寸：${p.length || '-'}×${p.od || '-'}mm，重量：${p.weight || '-'}kg\n`;
    answer += `   - 状态：${meetsText}\n\n`;
  });
  
  answer += `**推荐理由**：\n`;
  answer += `- 首选 ${top3[0].short}，扭矩偏差最小，性价比最高\n`;
  answer += `- 如需更高性能余量，可考虑 ${top3[1]?.short || top3[0].short}\n`;
  answer += `- 如需更小尺寸，可对比备选型号\n\n`;
  answer += `建议使用"手动选型"功能查看完整对比和偏差详情。`;
  
  return answer;
}

// 匹配类型查询
function matchTypeQuery(question) {
  const q = question.toLowerCase();
  
  let targetType = null;
  if (q.includes('行星')) targetType = '行星模组';
  else if (q.includes('谐波')) targetType = '谐波模组';
  else if (q.includes('轻量谐波')) targetType = '轻量谐波';
  else if (q.includes('摆线')) targetType = '摆线模组';
  else if (q.includes('直驱')) targetType = '中空直驱';
  else if (q.includes('无框')) targetType = '无框电机';
  
  if (!targetType) return null;
  
  const products = PRODUCTS.filter(p => p.type === targetType);
  
  if (products.length === 0) return null;
  
  let answer = `**${targetType}** 系列产品（共${products.length}款）：\n\n`;
  
  products.forEach(p => {
    answer += `• **${p.short}**：额定${p.rated}Nm/峰值${p.peak}Nm，${p.power}W，${p.length || '-'}×${p.od || '-'}mm\n`;
  });
  
  answer += `\n如需详细参数，请直接询问具体型号，例如"${products[0].short}的参数是什么"。`;
  
  return answer;
}

// 回车发送
document.addEventListener('DOMContentLoaded', () => {
  const aiInput = document.getElementById('ai-input');
  if (aiInput) {
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askAI();
      }
    });
  }
  // 初始化DeepSeek状态显示
  if (typeof updateDeepSeekStatus === 'function') {
    updateDeepSeekStatus();
  }
});

// ==================== 机器人系统方案推荐 ====================

// 原创机器人示意图（3D渲染风格，避免版权问题）
function getRobotImage(type) {
  // 图片以独立文件提供（2048×2048 高清图），不再 base64 内嵌，
  // 否则 app.js 会被撑到 3.9 MB，首屏加载极慢
  const images = {
    humanoid: 'images/humanoid_real.png',
    arm: 'images/arm_real.png',
    quadruped: 'images/quadruped_real.png',
    gripper: 'images/gripper_real.png'
  };
  return images[type] || images.humanoid;
}
// 机器人类型配置模板
const ROBOT_TEMPLATES = {
  humanoid: {
    name: '人形机器人',
    icon: '🤖',
    description: '双足人形机器人，适用于服务、工业、科研等场景',
    defaultParams: { height: 160, weight: 50, payload: 5, speed: 1.0, backlash: 5, accuracy: 0.1, motorConfig: 'mixed' },
    paramLabels: {
      height: '身高 (cm)',
      weight: '整机重量 (kg)',
      payload: '单臂负载 (kg)',
      speed: '行走速度 (m/s)',
      backlash: '背隙要求 (弧分)',
      accuracy: '重复定位精度 (度)',
      motorConfig: '模组组成方案'
    },
    motorConfigOptions: [
      { value: 'mixed',         label: '上半身行星 + 下半身谐波' },
      { value: 'all_planetary', label: '全行星模组（全身）' },
      { value: 'all_harmonic',  label: '全谐波模组（全身）' }
    ],
    motorConfigHint: '选定后按该组成硬性选型，不会擅自跨类型。行星背隙 10~15 弧分，若背隙要求更严会自动放宽并标注。'
  },
  arm: {
    name: '机械臂',
    icon: '🦾',
    description: '协作/工业机械臂，适用于装配、搬运、焊接等场景',
    defaultParams: {
      payload: 3, reach: 740, dof: 6,
      upperShare: 50,
      wristToPayload: 120,
      linkMassPerM: 1,
      jointSpeed: 30,
      accelTime: 0.3,
      safetyFactor: 1.5,
      payloadOffset: 50,
      j1Axis: 'vertical',
      motorConfig: 'auto',
      backlash: 15,
      accuracy: 0.5
    },
    paramLabels: {
      payload: '末端负载 (kg)',
      reach: '臂展 (mm)',
      dof: '自由度 (轴)',
      upperShare: '上臂占臂展比 (%)',
      wristToPayload: '腕部到负载 (mm)',
      linkMassPerM: '连杆线密度 (kg/m)',
      jointSpeed: '关节转速 (RPM)',
      accelTime: '加速时间 (s)',
      safetyFactor: '安全系数',
      payloadOffset: '负载偏心 (mm)',
      j1Axis: 'J1 轴方向',
      motorConfig: '模组组成方案',
      backlash: '背隙要求 (弧分)',
      accuracy: '重复定位精度 (度)'
    },
    motorConfigOptions: [
      { value: 'auto',          label: '智能推荐（按关节载荷自动）' },
      { value: 'all_planetary', label: '全行星模组' },
      { value: 'all_harmonic',  label: '全谐波模组' }
    ],
    motorConfigHint: '智能推荐会按每个关节的载荷类型挑最合适的类型；选全行星 / 全谐波则锁定该类型，族内放宽背隙并标注。'
  },
  quadruped: {
    name: '四足机器狗',
    icon: '🐕',
    description: '四足移动机器人，适用于巡检、勘探、救援等场景',
    defaultParams: { weight: 15, payload: 5, speed: 1.5, legLength: 30, backlash: 10, accuracy: 0.2 },
    paramLabels: {
      weight: '整机重量 (kg)',
      payload: '背负负载 (kg)',
      speed: '奔跑速度 (m/s)',
      legLength: '腿长 (cm)',
      backlash: '背隙要求 (弧分)',
      accuracy: '重复定位精度 (度)'
    }
  },
  gripper: {
    name: '夹爪/灵巧手',
    icon: '✋',
    description: '末端执行器，适用于抓取、操作、精密装配等场景',
    defaultParams: { gripForce: 20, objectWeight: 1, dof: 2, type: 'parallel', backlash: 3, accuracy: 0.1 },
    paramLabels: {
      gripForce: '夹持力 (N)',
      objectWeight: '抓取重量 (kg)',
      dof: '自由度',
      type: '类型',
      backlash: '背隙要求 (弧分)',
      accuracy: '重复定位精度 (度)'
    }
  }
};

// ── 关节扭矩模型（重力项 + 加速项）────────────────────────────
//  T_static = load × g × arm                        重力保持力矩（最不利姿态）
//  J        = load × inertiaArm²                    质点近似转动惯量
//  α        = (speed°/s → rad/s) / 加速时间
//  T_peak   = T_static + J·α                        峰值（重力 + 加速）
//  T_rated  = T_static × 1.15                       连续（重力 + 摩擦余量）
//
//  · arm        重力力臂：垂直旋转轴（底座 yaw / 髋 yaw / 腕 roll）取小值
//  · inertiaArm 惯量力臂：默认等于 arm，垂直轴需单独给
const JOINT_G = 9.81;
const JOINT_ACCEL_TIME = 0.15;    // s，加速到额定关节速度所需时间
const JOINT_DUTY_CYCLE = 0.20;   // 连续运行等效占空比（热等效 RMS 折算）

function jointTorques(o) {
  const load = Math.max(0, Number(o.load) || 0);
  const arm = Math.max(0, Number(o.arm) || 0);
  const iArm = Math.max(0, Number(o.inertiaArm != null ? o.inertiaArm : arm) || 0);
  const speedDeg = Math.max(0, Number(o.speed) || 0);
  const t = Number(o.accelTime) > 0 ? Number(o.accelTime) : JOINT_ACCEL_TIME;

  const tStatic = load * JOINT_G * arm;
  const omega = speedDeg * Math.PI / 180;      // rad/s
  const alpha = t > 0 ? omega / t : 0;          // rad/s²
  const J = load * iArm * iArm;                 // kg·m²
  const tAccel = J * alpha;
  const peak = tStatic + tAccel;
  const rated = tStatic * Math.sqrt(JOINT_DUTY_CYCLE);

  const r1 = v => Math.round(v * 10) / 10;
  return {
    staticT: r1(tStatic),
    accelT: r1(tAccel),
    peak: r1(peak),
    rated: r1(rated),
    J: Math.round(J * 1000) / 1000,
    alpha: r1(alpha)
  };
}

// 统一的关节构造器
function mkJoint(id, name, part, load, arm, speed, torqueType, priority, inertiaArm) {
  const t = jointTorques({ load, arm, speed, inertiaArm });
  return {
    id: id,
    name: name,
    part: part,
    dof: 1,
    load: Math.round(Number(load) * 100) / 100,
    arm: Math.round(Number(arm) * 1000) / 1000,
    speed: speed,
    staticT: t.staticT,
    accelT: t.accelT,
    peak: t.peak,
    rated: t.rated,
    type: torqueType,
    priority: priority
  };
}

// 左右镜像：把 l_ 前缀的关节复制成 r_ 版本
function mirrorJoints(joints, partName) {
  const left = joints.filter(j => j.part === '左' + partName);
  return left.map(j => Object.assign({}, j, {
    id: j.id.replace(/^l_/, 'r_'),
    name: j.name.replace('左', '右'),
    part: '右' + partName
  }));
}

// 为人形机器人生成关节配置
function generateHumanoidJoints(params) {
  const height = Number(params.height) || 160;
  const weight = Number(params.weight) || 50;
  const payload = Number(params.payload) || 5;
  const h = height / 100;

  // 模组偏好：mixed = 上半身行星 / 下半身谐波
  // 返回该部位允许的模组类型（第一个为首选）
  // 谐波族包含「谐波模组」与「轻量谐波」——轻量谐波本质也是谐波减速
  const getPreferredFamily = (part) => {
    if (params.motorConfig === 'all_planetary') return ['行星模组'];
    if (params.motorConfig === 'all_harmonic') return ['谐波模组', '轻量谐波'];
    const upper = ['头部', '左臂', '右臂', '躯干'];
    return upper.indexOf(part) >= 0 ? ['行星模组'] : ['谐波模组', '轻量谐波'];
  };

  // 人体比例
  const armLength = h * 0.45;
  const forearmLength = h * 0.25;
  const thighLength = h * 0.28;
  const shinLength = h * 0.22;

  const upperBodyWeight = weight * 0.65;
  const armWeight = weight * 0.05;
  const legWeight = weight * 0.15;
  const headWeight = weight * 0.06;

  const joints = [];

  // ── 头部 2DOF ──
  joints.push(mkJoint('neck_pitch', '颈部俯仰', '头部', headWeight, 0.1, 60, '轻载', '低'));
  joints.push(mkJoint('neck_yaw', '颈部旋转', '头部', headWeight, 0.05, 90, '轻载', '低'));

  // ── 左臂 7DOF ──
  const shoulderLoad = payload + armWeight * 0.5;
  joints.push(mkJoint('l_shoulder_pitch', '左肩俯仰', '左臂', shoulderLoad, armLength, 90, '中载', '高'));
  joints.push(mkJoint('l_shoulder_roll', '左肩侧摆', '左臂', shoulderLoad, armLength * 0.8, 90, '中载', '高'));
  // 肩旋转是沿上臂轴的转动，重力力臂小，惯量力臂取前臂长
  joints.push(mkJoint('l_shoulder_yaw', '左肩旋转', '左臂', payload + armWeight * 0.3, 0.06, 120, '中载', '中', forearmLength));

  const elbowLoad = payload + armWeight * 0.3;
  joints.push(mkJoint('l_elbow', '左肘屈伸', '左臂', elbowLoad, forearmLength, 120, '中载', '高'));
  joints.push(mkJoint('l_wrist_pitch', '左腕俯仰', '左臂', payload, 0.1, 180, '轻载', '中'));
  joints.push(mkJoint('l_wrist_roll', '左腕旋转', '左臂', payload, 0.05, 180, '轻载', '中', 0.1));
  joints.push(mkJoint('l_wrist_yaw', '左腕偏摆', '左臂', payload, 0.05, 180, '轻载', '低'));

  // ── 右臂镜像 ──
  joints.push.apply(joints, mirrorJoints(joints, '臂'));

  // ── 腰部 2DOF ──
  joints.push(mkJoint('waist_pitch', '腰部俯仰', '躯干', upperBodyWeight, 0.15, 60, '中载', '高'));
  // 腰部 yaw 是垂直轴
  joints.push(mkJoint('waist_yaw', '腰部旋转', '躯干', upperBodyWeight, 0.08, 60, '中载', '中', 0.2));

  // ── 左腿 6DOF ──
  const hipLoad = upperBodyWeight + legWeight;
  joints.push(mkJoint('l_hip_pitch', '左髋俯仰', '左腿', hipLoad, thighLength, 90, '重载', '高'));
  joints.push(mkJoint('l_hip_roll', '左髋侧摆', '左腿', hipLoad, thighLength * 0.8, 60, '重载', '高'));
  // 髋 yaw 绕垂直轴，不受重力矩，只克服惯量
  joints.push(mkJoint('l_hip_yaw', '左髋旋转', '左腿', hipLoad, 0.06, 60, '重载', '中', thighLength));

  joints.push(mkJoint('l_knee', '左膝屈伸', '左腿', upperBodyWeight + legWeight * 0.5, shinLength, 90, '重载', '高'));
  // 单腿支撑时整机重量压在一只脚上
  joints.push(mkJoint('l_ankle_pitch', '左踝俯仰', '左腿', weight, 0.08, 60, '中载', '高'));
  joints.push(mkJoint('l_ankle_roll', '左踝侧摆', '左腿', weight, 0.06, 30, '中载', '高'));

  // ── 右腿镜像 ──
  joints.push.apply(joints, mirrorJoints(joints, '腿'));

  // 模组组成方案（混合 / 全行星 / 全谐波）都是用户的明确选择，
  // 一律按硬性类型约束处理：在各类型内部放宽背隙，不擅自跨类型
  joints.forEach(j => {
    j.familyTypes = getPreferredFamily(j.part);
    j.preferredMotorType = j.familyTypes[0];
    j.hardFamily = true;
  });
  return joints;
}

// 为机械臂生成关节配置
// 为机械臂生成关节配置（与官方 WorkBench ARM SIZING 口径一致）
//  actuatorMasses: 可选 [m1..m7] 各执行器重量(kg)，用于把外侧执行器自重计入力矩
//                  未传时用初值，供 generateRobotSolution 两遍迭代
function generateArmJoints(params, actuatorMasses) {
  const payload = Number(params.payload) || 3;
  const reachMM = Number(params.reach) || 740;
  const dof = Number(params.dof) || 6;

  const upperShare = (Number(params.upperShare) || 50) / 100;
  const wristToPayloadMM = Number(params.wristToPayload != null ? params.wristToPayload : 120);
  const linkMassPerM = Number(params.linkMassPerM != null ? params.linkMassPerM : 1);
  const accelTime = Number(params.accelTime) || 0.3;
  const sf = Number(params.safetyFactor) || 1.5;
  const payloadOffset = (Number(params.payloadOffset) || 0) / 1000;
  const j1Horizontal = (params.j1Axis === 'horizontal');

  // 参考样机所有关节统一按「关节转速 RPM」给出需求
  const jointRpm = Number(params.jointSpeed) || 30;
  const speedDeg = jointRpm * 6;              // 转成 °/s，供 recommendMotorForJoint 换算回 RPM

  const g = 9.81;
  const r1 = v => Math.round(v * 10) / 10;

  // ── 杆长（m）──
  const reach = reachMM / 1000;
  const wrist = wristToPayloadMM / 1000;
  const span = Math.max(0.01, reach - wrist);
  const upper = span * upperShare;
  const fore = span - upper;

  // ── 各关节到肩的距离 ──
  const dElbow = upper;
  const dWrist = upper + fore;
  const dFlange = upper + fore;

  // ── 连杆质量与质心距离 ──
  const mUpper = linkMassPerM * upper;
  const mFore = linkMassPerM * fore;
  const mWrist = linkMassPerM * wrist;

  // ── 执行器质量（初值或上一轮结果）──
  const am = (Array.isArray(actuatorMasses) && actuatorMasses.length >= 7)
    ? actuatorMasses.slice(0, 7)
    : [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.2];

  const omega = speedDeg * Math.PI / 180;
  const alpha = accelTime > 0 ? omega / accelTime : 0;

  // pairs: [[质量 kg, 到参考点的距离 m], ...]
  function solve(pairs, opts) {
    opts = opts || {};
    const hold = g * pairs.reduce((a, q) => a + q[0] * q[1], 0);
    const J = pairs.reduce((a, q) => a + q[0] * q[1] * q[1], 0);
    const accel = J * alpha;

    if (opts.inertiaOnly) {
      // 垂直轴（底座 yaw）：无重力，按惯量定，rated = peak/2
      const pk = accel * sf;
      return { hold: 0, accel: r1(accel), peak: r1(pk), rated: r1(pk / 2), J: +J.toFixed(4) };
    }
    return {
      hold: r1(hold), accel: r1(accel),
      peak: r1((hold + accel) * sf), rated: r1(hold * sf), J: +J.toFixed(4)
    };
  }

  const joints = [];
  function mk(id, name, part, type, priority, pairs, opts) {
    const c = solve(pairs, opts);
    joints.push({
      id: id, name: name, part: part, dof: 1,
      load: +pairs.reduce((a, q) => a + q[0], 0).toFixed(2),
      arm: +(pairs.length ? Math.max.apply(null, pairs.map(q => q[1])) : 0).toFixed(3),
      speed: speedDeg,
      staticT: c.hold, accelT: c.accel,
      peak: c.peak, rated: c.rated, J: c.J,
      type: type, priority: priority
    });
  }

  // ── J2 肩俯仰：所有外侧质量（负载 + 三段连杆 + J3..J7 执行器）──
  const shoulderPairs = [
    [payload, reach],
    [mUpper, upper / 2],
    [mFore, upper + fore / 2],
    [mWrist, upper + fore + wrist / 2],
    [am[2], 0],                 // J3 上臂 roll，位于肩
    [am[3], dElbow],            // J4 肘
    [am[4], dElbow],            // J5 前臂 roll，位于肘
    [am[5], dWrist],            // J6 腕
    [am[6], dFlange]            // J7 法兰
  ];

  // ── J4 肘俯仰：肘以后的质量 ──
  const elbowPairs = [
    [payload, fore + wrist],
    [mFore, fore / 2],
    [mWrist, fore + wrist / 2],
    [am[4], 0],                 // J5 前臂 roll，位于肘
    [am[5], fore],              // J6 腕
    [am[6], fore]               // J7 法兰
  ];

  // ── J6 腕俯仰：腕以后的质量 ──
  const wristPairs = [
    [payload, wrist],
    [mWrist, wrist / 2],
    [am[6], 0]                  // J7 法兰
  ];

  // ── J7 法兰旋转：只看负载偏心 ──
  const flangePairs = [
    [payload, payloadOffset]
  ];

  // ── J1 底座 yaw ──
  // 垂直轴：无重力，按整臂惯量定；水平轴：重力参与
  const basePairs = [
    [payload, reach],
    [mUpper, upper / 2],
    [mFore, upper + fore / 2],
    [mWrist, upper + fore + wrist / 2],
    [am[1], 0], [am[2], 0],
    [am[3], dElbow], [am[4], dElbow],
    [am[5], dWrist], [am[6], dFlange]
  ];

  // 顺序按 J1 → J7 输出
  mk('j1', 'J1 底座旋转', '底座', '重载', '高', basePairs, { inertiaOnly: !j1Horizontal });
  mk('j2', 'J2 大臂俯仰', '大臂', '重载', '高', shoulderPairs);
  // J3 上臂 roll：下一俯仰关节弯 90° 后，承受与 J4 相同的载荷
  mk('j3', 'J3 上臂旋转', '大臂', '中载', '中', elbowPairs);
  mk('j4', 'J4 肘部俯仰', '小臂', '重载', '高', elbowPairs);
  // J5 前臂 roll：同理等于 J6
  mk('j5', 'J5 前臂旋转', '小臂', '轻载', '中', wristPairs);
  mk('j6', 'J6 腕部俯仰', '腕部', '轻载', '中', wristPairs);

  if (dof >= 7) {
    mk('j7', 'J7 法兰旋转', '法兰', '轻载', '低', flangePairs);
  } else {
    // 6 轴时法兰旋转并入腕部，用最低优先级标记
    mk('j7', 'J7 法兰旋转', '法兰', '轻载', '低', flangePairs);
  }

  // 6 轴时隐藏 J7 的重度参与（仍保留以保证执行器质量数组对齐）
  if (dof < 7) {
    joints.pop();
  }

  // 模组组成方案：auto = 不锁定类型（与官方 WorkBench 一致，取最轻）
  const armFamily =
    params.motorConfig === 'all_planetary' ? ['行星模组'] :
    params.motorConfig === 'all_harmonic' ? ['谐波模组', '轻量谐波'] :
    null;

  if (armFamily) {
    joints.forEach(j => {
      j.familyTypes = armFamily.slice();
      j.preferredMotorType = armFamily[0];
      j.hardFamily = true;
    });
  }

  return joints;
}

// 为四足机器狗生成关节配置
function generateQuadrupedJoints(params) {
  const weight = Number(params.weight) || 15;
  const payload = Number(params.payload) || 5;
  const legLenM = (Number(params.legLength) || 30) / 100;

  const thighLen = legLenM * 0.5;
  const shinLen = legLenM * 0.5;

  // 运动时最多两条腿支撑，保守按 1/2 分配
  const legLoad = (weight + payload) / 2;

  const sides = ['左前', '右前', '左后', '右后'];
  const prefixes = ['fl', 'fr', 'bl', 'br'];
  const joints = [];

  sides.forEach((side, i) => {
    const pf = prefixes[i];
    joints.push(mkJoint(pf + '_hip_roll', side + '髋侧摆', side + '腿',
      legLoad, thighLen * 0.5, 90, '中载', '高'));
    joints.push(mkJoint(pf + '_hip_pitch', side + '髋俯仰', side + '腿',
      legLoad, thighLen + shinLen, 120, '重载', '高'));
    joints.push(mkJoint(pf + '_knee', side + '膝屈伸', side + '腿',
      legLoad, shinLen, 120, '重载', '高'));
  });

  return joints;
}

// 为夹爪/灵巧手生成关节配置
function generateGripperJoints(params) {
  const gripForce = Number(params.gripForce) || 20;
  const objectWeight = Number(params.objectWeight) || 1;
  const dof = Math.max(1, Math.round(Number(params.dof) || 2));
  const type = params.type || 'parallel';

  const fingerLen = 0.08;
  const joints = [];

  if (type === 'parallel' || dof <= 2) {
    // 平行夹爪：两指各 1 个驱动关节
    for (const side of ['左', '右']) {
      const id = (side === '左' ? 'grip_left' : 'grip_right');
      const j = mkJoint(id, side + '指驱动', '夹爪',
        objectWeight / 2, fingerLen, 60, '轻载', '高');
      // 夹持力直接给峰值（夹紧是静态操作，不需要加速度余量）
      j.peak = Math.round(gripForce * fingerLen * 10) / 10;
      j.staticT = j.peak;
      j.accelT = 0;
      j.rated = Math.round(gripForce * fingerLen * 0.5 * 10) / 10;
      joints.push(j);
    }
  } else {
    // 灵巧手：把 dof 精确分配到 5 根手指（总数严格等于 dof）
    const fingers = Math.min(dof, 5);
    const per = [];
    const base = Math.floor(dof / fingers);
    const extra = dof % fingers;
    for (let f = 0; f < fingers; f++) per.push(base + (f < extra ? 1 : 0));

    for (let f = 1; f <= fingers; f++) {
      const n = per[f - 1];
      for (let j = 1; j <= n; j++) {
        const segName = j === 1 ? '指根' : (j === 2 ? '指中' : '指尖');
        // 越靠指尖，夹持力折算越小
        const segFactor = j === 1 ? 1 : (j === 2 ? 0.6 : 0.35);
        const segLen = fingerLen * (1 - (j - 1) * 0.3);
        const jj = mkJoint('finger' + f + '_joint' + j, '指' + f + segName, '灵巧手',
          objectWeight / fingers, segLen, 90, '轻载', j === 1 ? '高' : '中');
        jj.peak = Math.round(gripForce * fingerLen * segFactor * 10) / 10;
        jj.staticT = jj.peak;
        jj.accelT = 0;
        jj.rated = Math.round(gripForce * fingerLen * segFactor * 0.5 * 10) / 10;
        joints.push(jj);
      }
    }
  }

  return joints;
}

// 为单个关节推荐电机
// 为单个关节推荐电机
//  · 硬性下限：额定扭矩与峰值扭矩都必须 ≥ 需求（不再允许欠配）
//  · 转速校核：关节 °/s ÷ 6 = 所需输出轴 RPM，产品额定转速必须够
//  · 计分非对称：欠配重罚（已由硬过滤排除），超配按超出比例轻罚
//  · 稳定 tie-break：同分时 更轻 → 更小 → 型号名
function recommendMotorForJoint(joint, requirements = {}) {
  const rated = Number(joint.rated) || 0;
  const peak = Number(joint.peak) || 0;
  const type = joint.type;
  const preferredMotorType = joint.preferredMotorType;
  // 允许的类型集合（第一个为首选）；优先用 familyTypes，其次单个 preferredMotorType
  const familyTypes = Array.isArray(joint.familyTypes) ? joint.familyTypes.filter(Boolean) : [];
  const hardFamily = !!joint.hardFamily && (familyTypes.length > 0 || !!preferredMotorType);
  const speedDeg = Number(joint.speed) || 0;

  const maxBacklash = requirements.maxBacklash || null;
  const maxRepeatability = requirements.maxRepeatability || null;

  // 只从「完整关节模组」里选：无框电机（FL/FLO/CEM）没有外壳与输出轴承，
  // 减速器只是传动件，二者都不能直接装到机器人关节上
  const ACTUATOR_TYPES = ['行星模组', '谐波模组', '轻量谐波', '摆线模组', '中空直驱'];
  function isActuator(p) { return ACTUATOR_TYPES.indexOf(p.type) >= 0; }

  // 所需输出轴转速（关节 °/s 换算成输出轴 RPM）
  const needRpm = speedDeg > 0 ? speedDeg / 6 : 0;

  // 类型偏好
  let preferredTypes = [];
  if (familyTypes.length) {
    preferredTypes = familyTypes.slice();
  } else if (preferredMotorType) {
    preferredTypes = [preferredMotorType];
  } else if (type === '重载') {
    preferredTypes = ['行星模组', '谐波模组', '摆线模组'];
  } else if (type === '中载') {
    preferredTypes = ['谐波模组', '行星模组', '轻量谐波', '摆线模组'];
  } else {
    preferredTypes = ['轻量谐波', '谐波模组', '行星模组', '中空直驱'];
  }

  // 硬性下限判断
  function passesTorque(p) {
    const r = Number(p.rated) || 0;
    const k = Number(p.peak) || 0;
    if (rated > 0 && r < rated) return false;
    if (peak > 0 && k < peak) return false;
    return true;
  }
  function passesSpeed(p) {
    if (needRpm <= 0) return true;
    const s = Number(p.speed);
    if (!isFinite(s) || s <= 0) return true;   // 无转速数据的不排除
    return s >= needRpm;
  }
  function passesQuality(p) {
    if (maxBacklash && p.backlash != null && p.backlash > maxBacklash) return false;
    if (maxRepeatability && p.repeatability != null && p.repeatability > maxRepeatability) return false;
    return true;
  }

  // 用户显式选了「全行星 / 全谐波」时，类型是硬约束：
  // 先在该类型内部逐级放宽，实在没有才允许跨类型
  function inFamily(p) {
    if (!hardFamily) return true;
    if (preferredTypes.indexOf(p.type) >= 0) return true;
    return false;
  }

  let candidates = PRODUCTS.filter(p =>
    inFamily(p) && isActuator(p) && passesTorque(p) && passesSpeed(p) && passesQuality(p));
  let relaxed = '';

  if (candidates.length === 0) {
    candidates = PRODUCTS.filter(p => inFamily(p) && isActuator(p) && passesTorque(p) && passesSpeed(p));
    if (candidates.length > 0) {
      relaxed = hardFamily
        ? '该类型背隙/精度不满足，已放宽'
        : '精度/背隙要求已放宽';
    }
  }
  if (candidates.length === 0) {
    candidates = PRODUCTS.filter(p => inFamily(p) && isActuator(p) && passesTorque(p));
    if (candidates.length > 0) {
      relaxed = hardFamily
        ? '该类型背隙/精度/转速不满足，已放宽'
        : '精度/背隙/转速要求已放宽';
    }
  }
  if (candidates.length === 0 && hardFamily) {
    // 该类型内连扭矩都满足不了，只能跨类型，并明确告知
    candidates = PRODUCTS.filter(p => isActuator(p) && passesTorque(p) && passesSpeed(p));
    if (candidates.length === 0) {
      candidates = PRODUCTS.filter(p => isActuator(p) && passesTorque(p));
    }
    if (candidates.length > 0) {
      relaxed = (preferredTypes[0] || preferredMotorType) + '范围内无满足型号，已跨类型推荐';
    }
  }

  // 计分：超配按比例轻罚；欠配理论上不会出现，出现则重罚
  function score(p) {
    const r = Number(p.rated) || 0;
    const k = Number(p.peak) || 0;
    const overR = rated > 0 ? Math.max(0, (r - rated) / rated) : 0;
    const overK = peak > 0 ? Math.max(0, (k - peak) / peak) : 0;
    const underR = rated > 0 ? Math.max(0, (rated - r) / rated) : 0;
    const underK = peak > 0 ? Math.max(0, (peak - k) / peak) : 0;
    return underR * 1000 + underK * 1000 + overR * 10 + overK * 10;
  }

  // 类型优先只在「软偏好」时生效（未锁定族）。
  // 一旦 hardFamily 锁定了允许的类型集合，集合内部就按重量决定，
  // 否则 familyTypes 的书写顺序会变成硬优先级（例如只选 RH 不选更轻的 HM）。
  const strictPreferred = !!preferredMotorType && !hardFamily;

  function typeRank(p) {
    const i = preferredTypes.indexOf(p.type);
    return i === -1 ? 99 : i;
  }

  candidates = candidates.slice().sort((a, b) => {
    // 1) 显式指定类型时，类型优先
    if (strictPreferred) {
      const aT = typeRank(a), bT = typeRank(b);
      if (aT !== bT) return aT - bT;
    }

    // 2) 重量最轻 —— 机器人上每个关节的重量都会压给上一级关节
    const aW = a.weight == null ? 999 : a.weight;
    const bW = b.weight == null ? 999 : b.weight;
    if (Math.abs(aW - bW) > 0.02) return aW - bW;

    // 3) 未指定类型时，类型偏好降为次级判据
    if (!strictPreferred) {
      const aT = typeRank(a), bT = typeRank(b);
      if (aT !== bT) return aT - bT;
    }

    // 4) 同重量时取更接近需求的
    const sa = score(a), sb = score(b);
    if (Math.abs(sa - sb) > 0.8) return sa - sb;

    // 5) 更小外径
    const aO = a.od == null ? 999 : a.od;
    const bO = b.od == null ? 999 : b.od;
    if (aO !== bO) return aO - bO;

    return String(a.full).localeCompare(String(b.full));  // 最终稳定
  });

  const top3 = candidates.slice(0, 3);

  // 满足状态
  let satisfaction = '无满足型号';
  if (top3.length > 0) {
    const p = top3[0];
    const r = Number(p.rated) || 0;
    const k = Number(p.peak) || 0;
    const shortR = rated > 0 ? Math.max(0, rated - r) : 0;
    const shortK = peak > 0 ? Math.max(0, peak - k) : 0;
    const speedOk = passesSpeed(p);
    const overR = rated > 0 ? r / rated : 1;

    if (shortR > 0 || shortK > 0) {
      satisfaction = '扭矩不足';
    } else if (!speedOk) {
      satisfaction = '转速不足';
    } else if (overR <= 1.1) {
      satisfaction = '精确满足';
    } else if (overR <= 1.6) {
      satisfaction = '满足';
    } else if (overR <= 3.0) {
      satisfaction = '满足但明显过配';
    } else {
      satisfaction = '满足但明显过配';
    }
  }

  return {
    candidates: top3,
    primary: top3[0] || null,
    satisfaction: satisfaction,
    relaxed: relaxed,
    hardFamily: hardFamily,
    needRpm: Math.round(needRpm * 10) / 10
  };
}

// 生成完整的机器人方案
function generateRobotSolution(robotType, params) {
  let joints = [];
  
  switch (robotType) {
    case 'humanoid':
      joints = generateHumanoidJoints(params);
      break;
    case 'arm':
      joints = generateArmJoints(params);
      break;
    case 'quadruped':
      joints = generateQuadrupedJoints(params);
      break;
    case 'gripper':
      joints = generateGripperJoints(params);
      break;
    default:
      return null;
  }
  
  // 提取精度和背隙要求
  const requirements = {
    maxBacklash: params.backlash || null,
    maxRepeatability: params.accuracy || null
  };
  
  // 为每个关节推荐电机
  //  机械臂特殊处理：外侧执行器自重会影响内侧关节力矩，
  //  所以从远端到近端迭代 2~3 遍，直到选型稳定（与官方 WorkBench 一致）
  if (robotType === 'arm' && typeof generateArmJoints === 'function') {
    let masses = [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.2];
    let prevKey = '';
    for (let iter = 0; iter < 3; iter++) {
      const trial = generateArmJoints(params, masses);
      const picked = trial.map(j => {
        const r = recommendMotorForJoint(j, requirements);
        return r.primary;
      });
      const next = picked.map(p => (p && p.weight != null) ? p.weight : 0.8);
      // 6 轴时 J7 不在列表内，用最小值补位
      while (next.length < 7) next.push(0.2);
      const key = next.join(',');
      masses = next;
      if (key === prevKey) break;
      prevKey = key;
    }
    joints = generateArmJoints(params, masses);
  }

  joints = joints.map(joint => {
    const result = recommendMotorForJoint(joint, requirements);
    return {
      ...joint,
      recommendations: result.candidates,
      primary: result.primary,
      satisfaction: result.satisfaction,
      relaxed: result.relaxed || ''
    };
  });
  
  // 统计信息
  const totalDof = joints.reduce((sum, j) => sum + j.dof, 0);
  const totalMotors = joints.length;
  const parts = [...new Set(joints.map(j => j.part))];
  
  // 计算总功率估算
  const totalPower = joints.reduce((sum, j) => {
    if (j.primary && j.primary.power) return sum + j.primary.power;
    return sum + 50;
  }, 0);
  
  // 统计满足状态
  const satisfactionStats = {};
  joints.forEach(j => {
    const s = j.satisfaction || '未知';
    if (!satisfactionStats[s]) satisfactionStats[s] = 0;
    satisfactionStats[s]++;
  });
  
  // 按部位分组
  const jointsByPart = {};
  parts.forEach(part => {
    jointsByPart[part] = joints.filter(j => j.part === part);
  });
  
  return {
    robotType: robotType,
    template: ROBOT_TEMPLATES[robotType],
    params: params,
    joints: joints,
    jointsByPart: jointsByPart,
    parts: parts,
    totalDof: totalDof,
    totalMotors: totalMotors,
    totalPower: totalPower,
    satisfactionStats: satisfactionStats,
    generatedAt: new Date().toLocaleString('zh-CN')
  };
}

// 渲染机器人方案结果
function renderRobotSolution(solution) {
  if (!solution) return '<p>方案生成失败</p>';
  
  const { robotType, template, params, joints, jointsByPart, parts, totalDof, totalMotors, totalPower, satisfactionStats } = solution;
  const robotImage = getRobotImage(robotType);
  
  // 数值格式化：保留1位小数，空值显示-
  const fmt = (v) => (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(1);
  
  // 满足状态统计HTML
  let satisfactionHtml = '';
  if (satisfactionStats) {
    satisfactionHtml = '<div class="satisfaction-stats"><strong>满足状态：</strong>';
    Object.entries(satisfactionStats).forEach(([status, count]) => {
      const cls = status === '精确满足' ? 'status-exact' : status === '满足' ? 'status-ok' : status === '满足但明显过配' ? 'status-over' : status === '扭矩不足' ? 'status-bad' : status === '转速不足' ? 'status-bad' : status === '无满足型号' ? 'status-bad' : 'status-unknown';
      satisfactionHtml += `<span class="satisfaction-tag ${cls}">${status}: ${count}个</span>`;
    });
    satisfactionHtml += '</div>';
  }
  
  let html = `
    <div class="solution-summary">
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:0 0 200px;max-width:200px;">
          <img src="${robotImage}" alt="${template.name}示意图" style="width:100%;border-radius:8px;border:1px solid #2a3038;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
        </div>
        <div style="flex:1;min-width:300px;">
          <h3 style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">${template.icon} ${template.name}系统方案
          </h3>
          <p style="color:#889;font-size:13px;margin:5px 0 15px 0;">${template.description}</p>
          <div class="solution-stats">
            <div class="stat-item">
              <span class="stat-value">${totalDof}</span>
              <span class="stat-label">总自由度</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${totalMotors}</span>
              <span class="stat-label">关节数量</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${parts.length}</span>
              <span class="stat-label">部位分组</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${fmt(totalPower)}W</span>
              <span class="stat-label">估算总功率</span>
            </div>
          </div>
          <div class="solution-params">
            <strong>输入参数：</strong>
            ${Object.entries(params).map(([key, val]) => {
              const label = template.paramLabels[key] || key;
              let displayVal = val;
              if (key === 'motorConfig') {
                const configMap = {
                  'auto': '智能推荐',
                  'mixed': '上半身行星+下半身谐波',
                  'all_planetary': '全行星模组',
                  'all_harmonic': '全谐波模组'
                };
                displayVal = configMap[val] || val;
              }
              return `<span class="param-tag">${label}: ${displayVal}</span>`;
            }).join('')}
          </div>
          ${satisfactionHtml}
        </div>
      </div>
    </div>
  `;
  
  // 按部位渲染关节表格
  parts.forEach(part => {
    const partJoints = jointsByPart[part];
    html += `
      <div class="solution-part">
        <h4>${part}（${partJoints.length}个关节）</h4>
        <div class="table-responsive">
          <table class="solution-table">
            <thead>
              <tr>
                <th>关节名称</th>
                <th>负载(kg)</th>
                <th>额定扭矩(Nm)</th>
                <th>峰值扭矩(Nm)</th>
                <th>推荐型号</th>
                <th>额定扭矩</th>
                <th>背隙(弧分)</th>
                <th>重复精度(度)</th>
                <th>满足状态</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    partJoints.forEach(joint => {
      const recHtml = joint.recommendations.map((p, idx) => {
        const cls = idx === 0 ? 'rec-primary' : 'rec-alt';
        return `<div class="${cls}">${idx === 0 ? '★ ' : ''}${p.short} (${p.rated}/${p.peak}Nm)</div>`;
      }).join('');
      
      const primary = joint.primary;
      const satisfactionCls = joint.satisfaction === '精确满足' ? 'status-exact' : joint.satisfaction === '满足' ? 'status-ok' : joint.satisfaction === '满足但明显过配' ? 'status-over' : 'status-bad';
      
      html += `
        <tr>
          <td><strong>${joint.name}</strong></td>
          <td>${fmt(joint.load)}</td>
          <td>${fmt(joint.rated)}</td>
          <td>${fmt(joint.peak)}</td>
          <td>${recHtml || '<span class="no-rec">暂无匹配</span>'}</td>
          <td>${primary ? fmt(primary.rated) + ' Nm' : '-'}</td>
          <td>${primary && primary.backlash !== null ? fmt(primary.backlash) : '-'}</td>
          <td>${primary && primary.repeatability !== null ? fmt(primary.repeatability) : '-'}</td>
          <td><span class="satisfaction-tag ${satisfactionCls}">${joint.satisfaction || '-'}</span>${
            joint.relaxed ? `<div style="font-size:10.5px;color:#f0883e;margin-top:4px;line-height:1.5;max-width:140px;">⚠ ${joint.relaxed}</div>` : ''
          }</td>
        </tr>
      `;
    });
    
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
  
  // BOM清单
  const motorCount = {};
  joints.forEach(joint => {
    if (joint.primary) {
      const key = joint.primary.short;
      if (!motorCount[key]) {
        motorCount[key] = { product: joint.primary, count: 0 };
      }
      motorCount[key].count++;
    }
  });
  
  html += `
    <div class="solution-bom">
      <h4>推荐电机BOM清单（首选方案）</h4>
      <div class="table-responsive">
        <table class="bom-table">
          <thead>
            <tr>
              <th>型号</th>
              <th>类型</th>
              <th>额定扭矩</th>
              <th>峰值扭矩</th>
              <th>功率</th>
              <th>背隙</th>
              <th>重复精度</th>
              <th>数量</th>
              <th>尺寸(总长×外径)</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  Object.values(motorCount).sort((a, b) => b.count - a.count).forEach(item => {
    const p = item.product;
    html += `
      <tr>
        <td><strong>${p.short}</strong></td>
        <td>${p.type}</td>
        <td>${fmt(p.rated)} Nm</td>
        <td>${fmt(p.peak)} Nm</td>
        <td>${fmt(p.power)} W</td>
        <td>${p.backlash !== null ? fmt(p.backlash) + ' 弧分' : '-'}</td>
        <td>${p.repeatability !== null ? fmt(p.repeatability) + ' 度' : '-'}</td>
        <td><strong>${item.count}</strong></td>
        <td>${p.length || '-'}×${p.od || '-'} mm</td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
    <div class="solution-note">
      <p><strong>说明：</strong>以上扭矩计算基于静态力学分析，实际选型需考虑动态冲击、安全系数（建议1.5-2倍）、安装空间、散热等因素。背隙和精度参数基于产品系列典型值，具体以官方手册为准。推荐电机仅供参考，最终方案请结合实际工况确认。</p>
    </div>
  `;
  
  return html;
}


function updateSolutionParams() {
  const type = document.getElementById('solution-type').value;
  const template = ROBOT_TEMPLATES[type];
  const container = document.getElementById('solution-params');
  
  let html = '';
  Object.entries(template.defaultParams).forEach(([key, val]) => {
    const label = template.paramLabels[key] || key;
    if (key === 'type') {
      html += `
        <div class="form-group">
          <label>${label}</label>
          <select id="sol-${key}">
            <option value="parallel">平行夹爪</option>
            <option value="dexterous">灵巧手</option>
          </select>
        </div>
      `;
    } else if (key === 'motorConfig') {
      const opts = template.motorConfigOptions || [
        { value: 'mixed', label: '上半身行星 + 下半身谐波' },
        { value: 'all_planetary', label: '全行星模组（全身）' },
        { value: 'all_harmonic', label: '全谐波模组（全身）' }
      ];
      const hint = template.motorConfigHint || '';
      html += `
        <div class="form-group">
          <label>${label}</label>
          <select id="sol-${key}">
            ${opts.map(o => '<option value="' + o.value + '">' + o.label + '</option>').join('')}
          </select>
          ${hint ? '<div style="font-size:11.5px;color:#667788;margin-top:6px;line-height:1.6;">' + hint + '</div>' : ''}
        </div>
      `;
    } else if (key === 'j1Axis') {
      html += `
        <div class="form-group">
          <label>${label}</label>
          <select id="sol-${key}">
            <option value="vertical">垂直（底座 yaw）</option>
            <option value="horizontal">水平（俯仰）</option>
          </select>
        </div>
      `;
    } else if (key === 'dof') {
      html += `
        <div class="form-group">
          <label>${label}</label>
          <select id="sol-${key}">
            <option value="2">2自由度</option>
            <option value="6">6自由度</option>
            <option value="7">7自由度</option>
            <option value="12">12自由度</option>
            <option value="20">20自由度</option>
          </select>
        </div>
      `;
    } else {
      // 整数类型参数（身高/重量/负载/尺寸等）
      const intParams = ['height', 'weight', 'payload', 'reach', 'gripForce', 'objectWeight', 'legLength'];
      const isInt = intParams.includes(key);
      const minVal = isInt ? '1' : '0.1';
      const stepVal = isInt ? '1' : '0.1';
      const oninputHandler = isInt
        ? "this.value=this.value.replace(/[^0-9]/g,'');if(parseFloat(this.value)<1)this.value=''"
        : "this.value=this.value.replace(/[^0-9.]/g,'');if(parseFloat(this.value)<0.1)this.value=''";
      html += `
        <div class="form-group">
          <label>${label}</label>
          <input type="number" id="sol-${key}" value="${val}" min="${minVal}" step="${stepVal}" oninput="${oninputHandler}">
        </div>
      `;
    }
  });
  
  container.innerHTML = html;
}

// 生成机器人方案
function generateSolution() {
  try {
    const type = document.getElementById('solution-type').value;
    const template = ROBOT_TEMPLATES[type];
    const params = {};
    
    Object.keys(template.defaultParams).forEach(key => {
      const el = document.getElementById('sol-' + key);
      if (el) {
        if (key === 'type' || key === 'motorConfig') {
          params[key] = el.value;
        } else {
          params[key] = parseFloat(el.value) || template.defaultParams[key];
        }
      } else {
        params[key] = template.defaultParams[key];
      }
    });
    
    const solution = generateRobotSolution(type, params);
    const resultDiv = document.getElementById('solution-result');
    
    if (solution) {
      window.currentSolution = solution;
      resultDiv.innerHTML = '<div class="card">' + renderRobotSolution(solution) + '</div>';
      // 3D 装配演示已下线
    } else {
      resultDiv.innerHTML = '<p style="color:#f66;">方案生成失败，请检查参数</p>';
    }
  } catch (e) {
    const resultDiv = document.getElementById('solution-result');
    resultDiv.innerHTML = '<p style="color:#f66;">错误: ' + e.message + '</p><pre style="color:#f88;font-size:11px;">' + e.stack + '</pre>';
  }
}

// 重置方案参数
function resetSolution() {
  updateSolutionParams();
  document.getElementById('solution-result').innerHTML = '';
}

// 页面加载时初始化方案推荐参数
function initSolutionPage() {
  try {
    if (document.getElementById('solution-params')) {
      updateSolutionParams();
    }
  } catch(e) { console.error('updateSolutionParams error:', e); }
  try {
    // 绑定生成方案按钮事件
    const btnGenerate = document.getElementById('btn-generate-solution');
    if (btnGenerate) btnGenerate.addEventListener('click', generateSolution);
  } catch(e) { console.error('btnGenerate error:', e); }
  try {
    // 绑定重置按钮事件
    const btnReset = document.getElementById('btn-reset-solution');
    if (btnReset) btnReset.addEventListener('click', resetSolution);
  } catch(e) { console.error('btnReset error:', e); }
  try {
    // 绑定智能生成按钮事件
    const btnSmartGenerate = document.getElementById('btn-smart-generate');
    if (btnSmartGenerate) btnSmartGenerate.addEventListener('click', smartGenerateSolution);
  } catch(e) { console.error('btnSmartGenerate error:', e); }
  try {
    // 绑定快捷示例按钮事件
    document.querySelectorAll('.prompt-example').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        document.getElementById('smart-prompt').value = prompt;
        smartGenerateSolution();
      });
    });
  } catch(e) { console.error('prompt-example error:', e); }
  try {
    // 回车触发智能生成
    const smartPromptInput = document.getElementById('smart-prompt');
    if (smartPromptInput) {
      smartPromptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') smartGenerateSolution();
      });
    }
  } catch(e) { console.error('smartPromptInput error:', e); }
  try {
    // 高级设置折叠/展开
    const advancedToggle = document.getElementById('advanced-toggle');
    if (advancedToggle) {
      advancedToggle.addEventListener('click', () => {
        const settings = document.getElementById('advanced-settings');
        const arrow = document.getElementById('advanced-arrow');
        if (settings.style.display === 'none') {
          settings.style.display = 'block';
          arrow.style.transform = 'rotate(90deg)';
        } else {
          settings.style.display = 'none';
          arrow.style.transform = 'rotate(0deg)';
        }
      });
    }
  } catch(e) { console.error('advancedToggle error:', e); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSolutionPage);
} else {
  initSolutionPage();
}

// ==================== 智能提示词解析 ====================

// 场景配置：不同应用场景的参数特征
const SCENE_PROFILES = {
  // 人形机器人场景
  'service_humanoid': { name: '服务人形机器人', height: 170, weight: 60, payload: 3, speed: 0.8, backlash: 5, accuracy: 0.1 },
  'industrial_humanoid': { name: '工业人形机器人', height: 180, weight: 85, payload: 10, speed: 0.5, backlash: 3, accuracy: 0.05 },
  'commercial_humanoid': { name: '商用服务机器人', height: 155, weight: 45, payload: 2, speed: 1.0, backlash: 10, accuracy: 0.2 },
  'education_humanoid': { name: '教育科研机器人', height: 160, weight: 50, payload: 5, speed: 1.0, backlash: 1, accuracy: 0.05 },
  'medical_humanoid': { name: '医疗康复机器人', height: 160, weight: 55, payload: 3, speed: 0.3, backlash: 0.5, accuracy: 0.02 },
  'entertainment_humanoid': { name: '娱乐表演机器人', height: 165, weight: 55, payload: 2, speed: 1.2, backlash: 8, accuracy: 0.15 },
  'heavy_humanoid': { name: '重载人形机器人', height: 190, weight: 120, payload: 20, speed: 0.4, backlash: 5, accuracy: 0.1 },
  'lightweight_humanoid': { name: '轻量人形机器人', height: 140, weight: 35, payload: 1, speed: 1.5, backlash: 10, accuracy: 0.2 },
  // 机械臂场景
  'industrial_arm': { name: '工业机械臂', payload: 10, reach: 1000, dof: 6, speed: 1.5, backlash: 5, accuracy: 0.08 },
  'collaborative_arm': { name: '协作机械臂', payload: 5, reach: 800, dof: 7, speed: 1.0, backlash: 1, accuracy: 0.03 },
  'heavy_arm': { name: '重载机械臂', payload: 25, reach: 1500, dof: 6, speed: 0.8, backlash: 10, accuracy: 0.1 },
  'lightweight_arm': { name: '轻量机械臂', payload: 3, reach: 600, dof: 6, speed: 2.0, backlash: 3, accuracy: 0.05 },
  'precision_arm': { name: '精密装配臂', payload: 2, reach: 500, dof: 6, speed: 0.5, backlash: 0.5, accuracy: 0.01 },
  'welding_arm': { name: '焊接机械臂', payload: 8, reach: 1200, dof: 6, speed: 1.0, backlash: 5, accuracy: 0.05 },
  'palletizing_arm': { name: '码垛机械臂', payload: 15, reach: 1800, dof: 4, speed: 2.0, backlash: 15, accuracy: 0.2 },
  // 四足机器狗场景
  'industrial_quadruped': { name: '工业巡检机器狗', weight: 25, payload: 8, speed: 1.0, legLength: 35, backlash: 5, accuracy: 0.1 },
  'consumer_quadruped': { name: '消费级机器狗', weight: 12, payload: 2, speed: 2.0, legLength: 25, backlash: 10, accuracy: 0.2 },
  'military_quadruped': { name: '军用负重机器狗', weight: 50, payload: 20, speed: 1.5, legLength: 40, backlash: 8, accuracy: 0.15 },
  'research_quadruped': { name: '科研教学机器狗', weight: 15, payload: 5, speed: 1.5, legLength: 30, backlash: 3, accuracy: 0.1 },
  // 夹爪/灵巧手场景
  'industrial_gripper': { name: '工业夹爪', gripForce: 50, objectWeight: 5, dof: 2, type: 'parallel', backlash: 5, accuracy: 0.1 },
  'dexterous_hand': { name: '灵巧手', gripForce: 20, objectWeight: 1, dof: 15, type: 'dexterous', backlash: 1, accuracy: 0.05 },
  'soft_gripper': { name: '柔性夹爪', gripForce: 10, objectWeight: 0.5, dof: 3, type: 'soft', backlash: 10, accuracy: 0.2 },
  'precision_gripper': { name: '精密夹爪', gripForce: 5, objectWeight: 0.2, dof: 2, type: 'parallel', backlash: 0.5, accuracy: 0.02 }
};

// 解析自然语言提示词，提取机器人类型和参数
function parseSmartPrompt(prompt) {
  const text = prompt.toLowerCase().trim();
  const result = {
    type: null,
    params: {},
    scene: null,
    confidence: 0
  };
  
  // 1. 识别机器人类型
  if (/人形|humanoid|双足|服务机器人|康复机器人|表演机器人|迎宾机器人|导览机器人/.test(text)) {
    result.type = 'humanoid';
    result.confidence += 30;
  } else if (/机械臂|协作臂|机械手臂|arm|robot arm| manipulator|机械手腕|码垛臂|焊接臂|装配臂/.test(text)) {
    result.type = 'arm';
    result.confidence += 30;
  } else if (/机器狗|四足|quadruped|dog|足式/.test(text)) {
    result.type = 'quadruped';
    result.confidence += 30;
  } else if (/夹爪|灵巧手|gripper|手爪|末端执行器|机械手/.test(text)) {
    result.type = 'gripper';
    result.confidence += 30;
  }
  
  // 如果没有明确类型，根据关键词推断
  if (!result.type) {
    if (/轴|自由度|dof|关节/.test(text) && !/人形|机器狗/.test(text)) {
      result.type = 'arm';
      result.confidence += 10;
    } else if (/身高|米|cm|厘米/.test(text) && /kg|公斤|千克/.test(text)) {
      result.type = 'humanoid';
      result.confidence += 10;
    } else {
      // 默认机械臂
      result.type = 'arm';
      result.confidence += 5;
    }
  }
  
  // 2. 识别应用场景，根据场景设置默认参数
  let sceneKey = null;
  
  // 人形机器人场景识别
  if (result.type === 'humanoid') {
    if (/服务|客服|接待|导览|讲解/.test(text)) {
      sceneKey = 'service_humanoid';
    } else if (/工业|工厂|车间|搬运|装配/.test(text)) {
      sceneKey = 'industrial_humanoid';
    } else if (/商用|商场|餐厅|酒店|零售/.test(text)) {
      sceneKey = 'commercial_humanoid';
    } else if (/教育|教学|科研|实验室|大学/.test(text)) {
      sceneKey = 'education_humanoid';
    } else if (/医疗|康复|护理|医院|手术/.test(text)) {
      sceneKey = 'medical_humanoid';
    } else if (/娱乐|表演|舞台|cosplay|主播/.test(text)) {
      sceneKey = 'entertainment_humanoid';
    } else if (/重载|大力士|搬运工|负重/.test(text)) {
      sceneKey = 'heavy_humanoid';
    } else if (/轻量|轻型|小型|迷你|桌面/.test(text)) {
      sceneKey = 'lightweight_humanoid';
    }
  }
  // 机械臂场景识别
  else if (result.type === 'arm') {
    if (/码垛|堆垛|palletiz/.test(text)) {
      sceneKey = 'palletizing_arm';
    } else if (/焊接|焊|weld/.test(text)) {
      sceneKey = 'welding_arm';
    } else if (/精密|装配|电子|芯片|高精度装配/.test(text)) {
      sceneKey = 'precision_arm';
    } else if (/协作|人机协作|安全|sensitive/.test(text)) {
      sceneKey = 'collaborative_arm';
    } else if (/重载|大负载|重型/.test(text)) {
      sceneKey = 'heavy_arm';
    } else if (/轻量|轻型|小型|桌面|迷你/.test(text)) {
      sceneKey = 'lightweight_arm';
    } else if (/工业|工厂|车间/.test(text)) {
      sceneKey = 'industrial_arm';
    }
  }
  // 四足机器狗场景识别
  else if (result.type === 'quadruped') {
    if (/工业|巡检|勘探|电力|石油/.test(text)) {
      sceneKey = 'industrial_quadruped';
    } else if (/消费|家用|陪伴|玩具|宠物/.test(text)) {
      sceneKey = 'consumer_quadruped';
    } else if (/军用|军事|负重|侦察|作战/.test(text)) {
      sceneKey = 'military_quadruped';
    } else if (/科研|教学|实验室|大学/.test(text)) {
      sceneKey = 'research_quadruped';
    }
  }
  // 夹爪/灵巧手场景识别
  else if (result.type === 'gripper') {
    if (/灵巧|多指|仿生|人手/.test(text)) {
      sceneKey = 'dexterous_hand';
    } else if (/柔性|软体|soft|易碎/.test(text)) {
      sceneKey = 'soft_gripper';
    } else if (/精密|微型|电子|芯片/.test(text)) {
      sceneKey = 'precision_gripper';
    } else if (/工业|搬运|重型/.test(text)) {
      sceneKey = 'industrial_gripper';
    }
  }
  
  // 如果识别到场景，使用场景参数作为默认值
  if (sceneKey && SCENE_PROFILES[sceneKey]) {
    const profile = SCENE_PROFILES[sceneKey];
    result.scene = profile.name;
    Object.entries(profile).forEach(([key, val]) => {
      if (key !== 'name' && key !== 'type') {
        result.params[key] = val;
      }
    });
    result.confidence += 20;
  }
  
  // 3. 提取数值参数（覆盖场景默认值）
  // 身高（人形机器人）：1.6米 / 160cm / 160厘米
  const heightMatch = text.match(/(\d+\.?\d*)\s*(米|cm|厘米)(?!\/s|\/秒)/);
  if (heightMatch) {
    let h = parseFloat(heightMatch[1]);
    if (heightMatch[2] === '米') {
      h = h * 100;
    }
    if (h > 50 && h < 300) {
      result.params.height = Math.round(h);
      result.confidence += 10;
    }
  }
  
  // 重量/整机重量：50kg / 50公斤 / 20千克
  const weightMatch = text.match(/(\d+\.?\d*)\s*(kg|公斤|千克)/);
  if (weightMatch) {
    const w = parseFloat(weightMatch[1]);
    if (result.type === 'humanoid' && w > 20 && w < 200) {
      result.params.weight = Math.round(w);
      result.confidence += 10;
    } else if (result.type === 'quadruped' && w > 5 && w < 100) {
      result.params.weight = Math.round(w);
      result.confidence += 10;
    }
  }
  
  // 负载：5kg负载 / 负载10kg / 末端5kg
  const payloadMatch = text.match(/(?:负载|末端|抓取|背负)\s*(\d+\.?\d*)\s*(kg|公斤|千克)?/);
  if (payloadMatch) {
    const p = parseFloat(payloadMatch[1]);
    if (p > 0.1 && p < 100) {
      if (result.type === 'arm') {
        result.params.payload = Math.round(p * 10) / 10;
      } else if (result.type === 'humanoid') {
        result.params.payload = Math.round(p * 10) / 10;
      } else if (result.type === 'quadruped') {
        result.params.payload = Math.round(p * 10) / 10;
      } else if (result.type === 'gripper') {
        result.params.objectWeight = Math.round(p * 10) / 10;
      }
      result.confidence += 10;
    }
  }
  
  // 轴数/自由度：7轴 / 6自由度 / 15dof
  const dofMatch = text.match(/(\d+)\s*(轴|自由度|dof|degree)/);
  if (dofMatch) {
    const dof = parseInt(dofMatch[1]);
    if (result.type === 'arm' && dof >= 4 && dof <= 10) {
      result.params.dof = dof;
      result.confidence += 10;
    } else if (result.type === 'gripper' && dof >= 1 && dof <= 20) {
      result.params.dof = dof;
      result.confidence += 10;
    }
  }
  
  // 臂展：800mm臂展 / 臂展1米
  const reachMatch = text.match(/臂展\s*(\d+\.?\d*)\s*(mm|cm|米|m)?/);
  if (reachMatch && result.type === 'arm') {
    let r = parseFloat(reachMatch[1]);
    const unit = reachMatch[2] || 'mm';
    if (unit === '米' || unit === 'm') r = r * 1000;
    if (unit === 'cm') r = r * 10;
    if (r > 200 && r < 3000) {
      result.params.reach = Math.round(r);
      result.confidence += 10;
    }
  }
  
  // 速度：1.5m/s / 速度1米每秒
  const speedMatch = text.match(/速度\s*(\d+\.?\d*)\s*(m\/s|米\/秒|米每秒)?/);
  if (speedMatch) {
    const s = parseFloat(speedMatch[1]);
    if (s > 0.1 && s < 10) {
      result.params.speed = Math.round(s * 10) / 10;
      result.confidence += 5;
    }
  }
  
  // 背隙要求：背隙小于1弧分 / 背隙<5 / 高精度
  const backlashMatch = text.match(/背隙\s*(?:小于|低于|<|<=)?\s*(\d+\.?\d*)\s*(弧分|arcmin)?/);
  if (backlashMatch) {
    result.params.backlash = parseFloat(backlashMatch[1]);
    result.confidence += 10;
  } else if (/高精度|精密|高精度/.test(text)) {
    result.params.backlash = 1;
    result.params.accuracy = 0.05;
    result.confidence += 10;
  }
  
  // 重复定位精度：精度0.05度 / 定位精度小于0.1度
  const accuracyMatch = text.match(/(?:精度|定位精度)\s*(?:小于|低于|<|<=)?\s*(\d+\.?\d*)\s*度/);
  if (accuracyMatch) {
    result.params.accuracy = parseFloat(accuracyMatch[1]);
    result.confidence += 10;
  }
  
  // 夹持力：20N夹持力 / 夹持力50N
  const gripForceMatch = text.match(/(?:夹持力|抓力|夹力)\s*(\d+\.?\d*)\s*n/);
  if (gripForceMatch && result.type === 'gripper') {
    result.params.gripForce = parseFloat(gripForceMatch[1]);
    result.confidence += 10;
  }
  
  // 4. 填充默认参数（未识别的参数用模板默认值）
  const template = ROBOT_TEMPLATES[result.type];
  if (template) {
    Object.entries(template.defaultParams).forEach(([key, val]) => {
      if (result.params[key] === undefined) {
        result.params[key] = val;
      }
    });
  }
  
  return result;
}

// 智能生成方案
function smartGenerateSolution() {
  // ★ 2026-11 已按要求停用「AI 自动识别参数生成」
  //   如需恢复，删掉下面 if 块即可
  if (window.ENABLE_SMART_GENERATE !== true) {
    console.warn('[已停用] AI 智能生成功能已关闭，请用下方「高级设置」手动选型');
    return;
  }
  const promptInput = document.getElementById('smart-prompt');
  const prompt = promptInput.value.trim();
  
  if (!prompt) {
    alert('请输入描述，例如：7轴机械臂、1.6米人形机器人');
    return;
  }
  
  // 解析提示词
  const parsed = parseSmartPrompt(prompt);
  
  if (!parsed.type) {
    alert('无法识别机器人类型，请描述更清楚一些，例如："7轴机械臂"或"人形机器人"');
    return;
  }
  
  // 更新机器人类型选择
  const typeSelect = document.getElementById('solution-type');
  if (typeSelect) {
    typeSelect.value = parsed.type;
    updateSolutionParams();
  }
  
  // 填充参数到输入框
  setTimeout(() => {
    Object.entries(parsed.params).forEach(([key, val]) => {
      const input = document.getElementById('param-' + key);
      if (input) {
        input.value = val;
      }
    });
    
    // 生成方案
    generateSolution();
    
    // 显示解析结果提示
    const resultDiv = document.getElementById('solution-result');
    if (resultDiv) {
      const template = ROBOT_TEMPLATES[parsed.type];
      const paramText = Object.entries(parsed.params).map(([k, v]) => {
        const label = template.paramLabels[k] || k;
        return `${label}: ${v}`;
      }).join('，');
      
      const sceneText = parsed.scene ? ` <span style="color:#ffaa44;">[${parsed.scene}]</span>` : '';
      
      const notice = document.createElement('div');
      notice.style.cssText = 'background:rgba(76,175,80,0.1);border:1px solid #4caf50;border-radius:6px;padding:10px 15px;margin-bottom:15px;color:#66bb66;font-size:13px;';
      notice.innerHTML = `✨ <strong>智能识别结果：</strong>${template.icon} ${template.name}${sceneText} | ${paramText}`;
      resultDiv.insertBefore(notice, resultDiv.firstChild);
    }
  }, 100);
}


/* ═══════════════════════════════════════════════════════════════
   FAQ 图片：画廊渲染 + 灯箱
   ─────────────────────────────────────────────────────────────── */
function faqImageGallery(f) {
  const imgs = Array.isArray(f && f.images) ? f.images.filter(x => x && x.url) : [];
  if (!imgs.length) return '';
  return '<div class="faq-gallery">' + imgs.map(function (im) {
    const cap = im.caption ? faqEscape(im.caption) : '';
    return '<figure class="faq-figure">' +
      '<img class="faq-img" loading="lazy" src="' + faqEscape(im.url) + '" alt="' + cap + '"' +
      ' onclick="openFaqImage(this.src)" title="点击放大">' +
      (cap ? '<figcaption>' + cap + '</figcaption>' : '') +
      '</figure>';
  }).join('') + '</div>';
}

function openFaqImage(src) {
  if (!src) return;
  let ov = document.getElementById('faqLightbox');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'faqLightbox';
    ov.className = 'faq-lightbox';
    ov.innerHTML = '<img alt=""><span class="faq-lightbox-close">✕</span>';
    ov.addEventListener('click', function () { ov.classList.remove('on'); });
    document.body.appendChild(ov);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { const x = document.getElementById('faqLightbox'); if (x) x.classList.remove('on'); }
    });
  }
  ov.querySelector('img').src = src;
  ov.classList.add('on');
}

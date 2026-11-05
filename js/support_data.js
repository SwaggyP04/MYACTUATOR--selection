/* ===================================================================
   support_data.js — 支持中心数据（故障码 / 排障向导 / 字段说明 / 教程）
   -------------------------------------------------------------------
   数据来源：MyActuator WorkBench 支持资料（2026-11 整理）
             + 项目原有故障库 + 补充中文说明
   结构：
     window.SUPPORT_FAULTS       故障码列表（11 条）
     window.SUPPORT_TROUBLESHOOT 排障决策树（4 症状 / 35 节点）
     window.SUPPORT_FIELD_HELP   参数含义（37 个字段，中英对照）
     window.SUPPORT_GUIDES       教程（4 条）
   =================================================================== */

window.SUPPORT_META = {
  "generatedAt": "2026-11-05",
  "faultCount": 11,
  "symptomCount": 4,
  "nodeCount": 35,
  "fieldCount": 37,
  "guideCount": 4,
  "source": "MyActuator WorkBench · Support"
};

window.SUPPORT_FAULTS = [
  {
    "id": "F01",
    "code": "",
    "category": "电源",
    "categoryEn": "Power",
    "name": "直流母线过压",
    "nameEn": "Over-voltage on DC bus",
    "causes": [
      "供电电压过高",
      "高惯量负载减速时的再生/制动能量无处释放",
      "减速时间过长，持续向母线回灌能量",
      "多节电池组充电后接近过压阈值（现场确认：13S 电池组满电约 54.6 V，离 55 V 阈值太近而触发）"
    ],
    "checks": [
      "在负载状态下于接插件处测量母线电压",
      "确认电源电压在执行器额定范围内",
      "快速减速时检查是否有制动电阻/再生能量泄放回路",
      "如使用电池供电，在充满电后立即测量电池电压，而不只是带载时测量"
    ],
    "fix": "将供电调整到额定范围内；放缓减速斜率，或增加再生/制动电阻回路，让制动能量有处释放。若电池满电电压接近阈值，可通过定制固件提高过压保护值——依赖此方案前请先与厂家确认余量。"
  },
  {
    "id": "F02",
    "code": "",
    "category": "电源",
    "categoryEn": "Power",
    "name": "直流母线欠压",
    "nameEn": "Under-voltage on DC bus",
    "causes": [
      "电源功率不足 / 在浪涌或峰值电流时限流",
      "供电线过长或过细导致压降",
      "大扭矩需求时电压跌落"
    ],
    "checks": [
      "在大负载瞬间于执行器端测量母线电压，而不是在电源端",
      "检查供电线线径和长度",
      "对比峰值电流需求与电源额定值"
    ],
    "fix": "按峰值电流（而不只是额定电流）选型电源；缩短/加粗供电线；多个执行器采用星形供电，避免菊花链串接供电。"
  },
  {
    "id": "F03",
    "code": "",
    "category": "电流",
    "categoryEn": "Current",
    "name": "过流 / 驱动器限流",
    "nameEn": "Over-current / driver current-limit",
    "causes": [
      "指令扭矩超过峰值扭矩",
      "机械卡死或碰撞",
      "电机相线短路或接错",
      "电机/编码器校准不正确"
    ],
    "checks": [
      "对比指令扭矩与峰值扭矩额定值",
      "断电状态下用手转动输出端，检查是否卡滞",
      "检查相线接线和接插件是否插好",
      "重新进行电机/编码器校准"
    ],
    "fix": "降低扭矩需求或清除阻碍；核对相线接线；重新校准。若空载时仍持续出现，可能是驱动器或校准故障。"
  },
  {
    "id": "F04",
    "code": "",
    "category": "温度",
    "categoryEn": "Thermal",
    "name": "过温",
    "nameEn": "Over-temperature",
    "causes": [
      "持续运行在额定（连续）扭矩/电流以上",
      "占空比高且散热不良",
      "环境温度过高",
      "工作在低效率点（接近堵转、低速大电流）"
    ],
    "checks": [
      "在工况校核中标出实际工作点——是否高于额定线？",
      "检查占空比以及安装/散热路径",
      "测量环境温度和外壳表面温度"
    ],
    "fix": "连续运行保持在额定线及以下；改善散热；增加冷却或占空比余量；如果负载确实是连续的，则换用更大规格。"
  },
  {
    "id": "F05",
    "code": "",
    "category": "传感器",
    "categoryEn": "Sensor",
    "name": "温度读数跳变或不合理（并非真实过热）",
    "nameEn": "Temperature reading is erratic or implausible (not a real thermal event)",
    "causes": [
      "热敏电阻引线过细，随关节运动弯折或磨损",
      "传感器走线长期摩擦或被挤压",
      "传感器焊点虚焊/开裂（间歇性开路）"
    ],
    "checks": [
      "观察温度读数是否出现与负载或环境无关的突变/掉线（例如显示 -16 °C，或在无负载变化时在正常值与 100 °C 以上之间跳动）",
      "监控读数的同时弯折接插件附近的传感器引线，看是否出现跳变",
      "在相同条件下与另一台正常的执行器对比"
    ],
    "fix": "这是线路/传感器完整性故障，不是真正过热——不要只是提高关断阈值。检查并重新走线/端接热敏电阻引线，补焊可疑焊点，若导线已损坏则更换整机。多个型号在现场反复出现；如果在多台设备上反复发生，应作为批次/设计问题上报，而不是当作个例处理。"
  },
  {
    "id": "F06",
    "code": "",
    "category": "传感器",
    "categoryEn": "Sensor",
    "name": "编码器 / 位置传感器故障",
    "nameEn": "Encoder / position-sensor error",
    "causes": [
      "编码器接插件松动或有干扰",
      "电磁干扰耦合到编码器信号线",
      "磁钢/传感器错位或损坏",
      "绝对位置基准丢失",
      "双编码器配置中，第二编码器异常值/速度阈值在设备正常时误触发",
      "总线上电机/节点 ID 重复，读回了另一台设备的位置"
    ],
    "checks": [
      "重新插拔并检查编码器线缆/接插件",
      "信号线与动力线分开走线；检查屏蔽/接地",
      "对绝对值编码器重新回零/设零",
      "若为双编码器，可尝试关闭第二编码器作为诊断——若报错消失，通常是阈值需要调整，而不是硬件故障",
      "确认同一总线/同一机械臂上没有两台设备使用相同电机 ID"
    ],
    "fix": "恢复干净的编码器连接和走线；重新回零/设零。若使用确认良好的线束仍重复报错，可能是传感器硬件问题。若是第二编码器异常值/速度误触发，通常是阈值调得过紧而非编码器损坏——但关闭第二编码器后需重新确认 PID 参数仍然适用，因为部分参数依赖它。总线 ID 重复会产生与编码器损坏相同的症状——先排除这一点，检查成本很低。"
  },
  {
    "id": "F07",
    "code": "",
    "category": "通讯",
    "categoryEn": "Comms",
    "name": "无通讯 / 总线掉线",
    "nameEn": "No communication / bus drop-outs",
    "causes": [
      "波特率或节点 ID 错误",
      "CAN 终端电阻缺失或不正确（两端各 120 Ω）",
      "共享总线上地址冲突",
      "总线线缆损坏或无屏蔽"
    ],
    "checks": [
      "确认波特率和节点 ID 与控制器一致",
      "确认总线两端各有且仅有一个 120 Ω 终端电阻",
      "逐个上线节点以找出地址冲突"
    ],
    "fix": "统一波特率/ID；仅在总线两端正确端接；解决 ID 重复；改善布线/屏蔽。（参见排障页。）"
  },
  {
    "id": "F08",
    "code": "",
    "category": "控制",
    "categoryEn": "Control",
    "name": "跟随误差 / 位置误差（伺服跟不上）",
    "nameEn": "Following / position error (servo can't keep up)",
    "causes": [
      "指令运动超出可用扭矩或速度",
      "负载惯量远高于调参时的设定",
      "增益过低 / 响应迟缓",
      "机械阻力增大"
    ],
    "checks": [
      "对照工作包络检查该运动的扭矩和速度",
      "比较负载惯量与转子惯量（惯量失配）",
      "检查轨迹限制与执行器能力是否匹配"
    ],
    "fix": "让运动保持在扭矩-速度包络内；放宽误差窗口或重新调参；减小惯量失配或放缓轨迹。"
  },
  {
    "id": "F09",
    "code": "",
    "category": "控制",
    "categoryEn": "Control",
    "name": "振动 / 抖动 / 振荡",
    "nameEn": "Vibration / jitter / oscillation",
    "causes": [
      "控制增益过高（不稳定）",
      "编码器噪声",
      "背隙或安装刚度不足",
      "与负载发生共振",
      "在位置跟随/流式指令模式下位置环 KD 过高（现场确认：KD 从 0.5 降到 0.005 后，位置跟随应用中的嗡嗡声消失；同一台设备使用自带加减速规划时没有噪声，说明问题出现在上位机直接下发原始位置目标的场景）"
    ],
    "checks": [
      "降低增益，从稳定的基础参数重新调参",
      "检查编码器信号完整性/接地",
      "检查安装刚度和背隙",
      "如果是位置跟随 / 流式设定点应用，先尝试把位置环 KD 降低 10–100 倍，再考虑其他调整"
    ],
    "fix": "从保守增益开始逐步上调重新调参；改善编码器接地；加固安装；若存在共振，适当增加阻尼/滤波。在位置跟随模式下，KD 过大是常见且容易被忽略的原因——见上方现场确认的案例。"
  },
  {
    "id": "F10",
    "code": "",
    "category": "机械",
    "categoryEn": "Mechanical",
    "name": "抱闸不抱紧 / 不释放",
    "nameEn": "Brake not holding / not releasing",
    "causes": [
      "抱闸电源切换不正确",
      "抱闸电压错误",
      "负载超出抱闸保持扭矩",
      "接线故障"
    ],
    "checks": [
      "确认抱闸供电和开关逻辑",
      "核对负载所需保持扭矩与抱闸额定值",
      "检查抱闸接线和接插件"
    ],
    "fix": "以正确的电压/逻辑驱动抱闸；确保抱闸保持扭矩覆盖最坏情况下的静态负载；修复接线。（抱闸在断电时保持位置——请确认该型号确实带抱闸。）"
  },
  {
    "id": "F11",
    "code": "",
    "category": "硬件",
    "categoryEn": "Hardware",
    "name": "驱动板损坏或时好时坏（无法使能、无响应）",
    "nameEn": "Driver board dead or intermittent (won't enable, no response)",
    "causes": [
      "驱动板损坏（现场确认：部分 RH 系列曾有已知批次问题，已通过 PCB 改版解决，近期库存应不受影响）",
      "电源接插件反接或接错（现场确认：首次上电时电源极性反接烧毁驱动器）",
      "装配时驱动器引脚虚焊（间歇性——可能能用、然后停止、然后又能用）"
    ],
    "checks": [
      "在任何新安装或现场更换时，首次上电前务必确认电源极性和接插件方向",
      "确认症状是否 100% 可重复（指向器件损坏）还是间歇性（指向焊点或接插件接触不良）",
      "如果是较早的库存，在有记录的情况下核对生产/发货日期与 PCB 改版时间"
    ],
    "fix": "极性反接造成的损坏和焊点不良无法现场维修——更换整机，并反馈故障模式/序列号以便追踪规律。新安装首次上电前务必确认接插件极性。"
  }
];

window.SUPPORT_TROUBLESHOOT = {
  "symptoms": [
    {
      "id": "no_spin",
      "label": "电机不转 / 不动作",
      "labelEn": "Motor won't spin / move",
      "start": "ns_power"
    },
    {
      "id": "overheat",
      "label": "发热 / 过温故障",
      "labelEn": "Getting hot / thermal fault",
      "start": "oh_point"
    },
    {
      "id": "comms",
      "label": "无通讯 / 掉线",
      "labelEn": "No communication / drop-outs",
      "start": "cm_proto"
    },
    {
      "id": "jitter",
      "label": "振动、抖动或控制不佳",
      "labelEn": "Vibration, jitter or poor control",
      "start": "jt_gain"
    }
  ],
  "nodes": {
    "ns_power": {
      "ask": "执行器是否已上电，并且在接插件处测得的母线电压在额定范围内？",
      "options": [
        {
          "label": "是",
          "next": "ns_enable"
        },
        {
          "label": "否 / 不确定",
          "next": "ns_r_power"
        }
      ]
    },
    "ns_r_power": {
      "result": "先解决供电。按峰值电流选型电源，在执行器端（而不是电源端）带载测量电压，并检查供电线线径/长度。恢复到规定电压后再试。"
    },
    "ns_enable": {
      "ask": "驱动器是否已使能，且没有激活的故障（无故障码/指示灯）？",
      "options": [
        {
          "label": "已使能，无故障",
          "next": "ns_jam"
        },
        {
          "label": "有故障",
          "next": "ns_fault"
        },
        {
          "label": "无法使能",
          "next": "ns_comms"
        }
      ]
    },
    "ns_fault": {
      "result": "先读取故障——在故障页查找并排除根本原因（常见为卡死导致的过流、编码器故障或欠压），再下发运动指令。"
    },
    "ns_comms": {
      "ask": "控制器能否在总线上看到该执行器（心跳/状态有响应）？",
      "options": [
        {
          "label": "能",
          "next": "ns_jam"
        },
        {
          "label": "不能",
          "next": "cm_proto"
        }
      ]
    },
    "ns_jam": {
      "ask": "断电状态下，输出轴能否用手转动（阻力在正常范围内）？",
      "options": [
        {
          "label": "转动顺畅",
          "next": "ns_cal"
        },
        {
          "label": "卡死 / 卡滞",
          "next": "ns_r_jam"
        }
      ]
    },
    "ns_r_jam": {
      "result": "机械卡滞。清除阻碍/碰撞，检查联轴器是否过紧或不对中，并检查关节内是否有异物。然后再试——卡死通常表现为过流故障。"
    },
    "ns_cal": {
      "result": "电气/校准问题。核对电机相线和编码器接线，然后重新进行电机/编码器校准。若接线正常且空载时仍不动作，按可能的驱动器/传感器故障上报（记录型号、固件版本、接线照片）。"
    },
    "oh_point": {
      "ask": "在工况校核中，实际工作点是否高于执行器的额定（连续）线？",
      "options": [
        {
          "label": "是，高于额定",
          "next": "oh_r_over"
        },
        {
          "label": "否，在额定以内",
          "next": "oh_duty"
        }
      ]
    },
    "oh_r_over": {
      "result": "执行器被持续运行在连续额定值以上——这就是发热来源。降低连续扭矩（缩短力臂、提高减速比），或换用更大规格。峰值扭矩只用于短时爆发，不能用于持续负载。"
    },
    "oh_duty": {
      "ask": "占空比是否较高（频繁运动），和/或散热不良（支架小、环境热或封闭）？",
      "options": [
        {
          "label": "是",
          "next": "oh_r_thermal"
        },
        {
          "label": "否",
          "next": "oh_r_other"
        }
      ]
    },
    "oh_r_thermal": {
      "result": "受散热路径/占空比限制。改善安装面的散热，增加冷却或风流，降低环境温度，或增加占空比余量。纸面上满足连续额定，仍然需要让热量有处散出。"
    },
    "oh_r_other": {
      "result": "如果在额定扭矩和占空比内仍然发热，检查是否增加了机械阻力（卡滞、皮带过紧）、供电电压过低导致电流偏大，或调参问题导致持续电流。记录电流与扭矩的对应关系，若持续存在则上报。"
    },
    "cm_proto": {
      "ask": "使用的是哪种总线协议？",
      "options": [
        {
          "label": "CAN / RS485",
          "next": "cm_term"
        },
        {
          "label": "EtherCAT",
          "next": "et_dc"
        }
      ]
    },
    "cm_term": {
      "ask": "总线终端电阻是否正确——两端各一个、共两个 120 Ω 电阻？",
      "options": [
        {
          "label": "是",
          "next": "cm_id"
        },
        {
          "label": "否 / 不确定",
          "next": "cm_r_term"
        }
      ]
    },
    "cm_r_term": {
      "result": "先解决终端电阻：总线两端各一个 120 Ω 终端电阻（不是每个节点都接）。终端电阻缺失或多接，正是这类间歇性掉线的原因。"
    },
    "cm_id": {
      "ask": "波特率和节点 ID 是否与控制器一致，且总线上没有重复 ID？",
      "options": [
        {
          "label": "全部正确",
          "next": "cm_wiring"
        },
        {
          "label": "不一致 / 有重复",
          "next": "cm_r_id"
        }
      ]
    },
    "cm_r_id": {
      "result": "将波特率和节点 ID 与控制器统一。逐个上线节点以找出重复地址——两个节点使用同一 ID 会导致总线瘫痪。这是现场真实且反复出现的原因（例如同一机械臂上两个关节都保留了默认 ID）——在多关节系统中，判断为硬件/通讯故障之前，总是值得先检查这一点。"
    },
    "cm_wiring": {
      "result": "在终端电阻和地址都正确的情况下，怀疑物理层：重新插拔接插件，检查 CAN-H/CAN-L 是否破损或无屏蔽，总线线缆与电机动力线分开走线，并确认有共地参考。换一根确认良好的线缆进行隔离排查。"
    },
    "et_dc": {
      "ask": "主站是否报告分布式时钟（DC）同步错误，或者从站因 DC 无法进入 OP 状态？",
      "options": [
        {
          "label": "是",
          "next": "et_r_dc"
        },
        {
          "label": "否",
          "next": "et_esi"
        }
      ]
    },
    "et_r_dc": {
      "result": "DC（分布式时钟）同步故障。确认主站确实为该从站启用了 DC（并非所有主站都会自动启用），并且周期时间是执行器支持的值。确保参考时钟是支持 DC 的从站，或该从站正确位于参考时钟下游——即使接线和 PDO 映射都正确，DC 不匹配也常会阻止 SafeOp→OP 的状态切换。"
    },
    "et_esi": {
      "ask": "主站中加载的 ESI/XML 文件是否与该执行器的型号和固件版本完全一致？",
      "options": [
        {
          "label": "一致",
          "next": "et_pdo"
        },
        {
          "label": "不一致 / 不确定",
          "next": "et_r_esi"
        }
      ]
    },
    "et_r_esi": {
      "result": "ESI/XML 不匹配。加载与该型号和固件版本完全对应的 ESI 文件并重新扫描总线——即使物理链路完全正常，过期或型号不对的 ESI 也会导致 PDO/对象不匹配和状态机故障。"
    },
    "et_pdo": {
      "ask": "从站是否卡在 PreOp/SafeOp（始终无法进入 OP），或者某些 PDO/对象显示无效？",
      "options": [
        {
          "label": "是",
          "next": "et_r_pdo"
        },
        {
          "label": "否",
          "next": "et_mode"
        }
      ]
    },
    "et_r_pdo": {
      "result": "PDO 映射 / 功能 PDO 问题。将从站的过程数据分配与主站的期望进行核对——当前模式（如 CSP、CSV、PVT）使用了错误的 PDO 组，会使状态机停在 PreOp/SafeOp，或拒绝 SDO 写入。针对实际配置的模式重新检查对象字典映射。"
    },
    "et_mode": {
      "ask": "问题是否在某个特定模式（如 CSP/PVT）下、在修改增益（Kp/Kd/TFF）或位置误差/跟随误差窗口之后出现？",
      "options": [
        {
          "label": "是",
          "next": "et_r_mode"
        },
        {
          "label": "否",
          "next": "et_r_wiring"
        }
      ]
    },
    "et_r_mode": {
      "result": "与模式相关的调参问题（如 PVT 插补下的 Kp/Kd/TFF 以及位置误差/间隙范围）。确保在当前增益下，跟随误差窗口足以容纳指令轨迹，并且 TFF（速度/扭矩前馈）与运动曲线匹配——增益过紧、前馈不足时，经常触发看起来像通讯掉线的跟随误差故障。放宽窗口或降低增益，然后重新调参。"
    },
    "et_r_wiring": {
      "result": "在 DC、ESI 和 PDO 映射都正确的情况下，检查 EtherCAT 物理层：菊花链中 IN/OUT 端口顺序是否正确、是否有意外开环、线缆长度/质量，以及是否有单个从站掉线导致其下游所有从站断开。"
    },
    "jt_gain": {
      "ask": "抖动出现或加剧之前，你刚刚调高了哪个控制环的增益？",
      "options": [
        {
          "label": "电流环（Kp/Ki）",
          "next": "jt_r_current"
        },
        {
          "label": "速度环（Kp/Ki）",
          "next": "jt_r_speed"
        },
        {
          "label": "位置环（Kp/Kd）",
          "next": "jt_r_position"
        },
        {
          "label": "不确定 / 没有刚改增益",
          "next": "jt_enc"
        }
      ]
    },
    "jt_r_current": {
      "result": "电流环增益过高通常表现为高频电气嗡嗡声/啸叫和额外发热，而不是可见的机械抖动。先降低电流环 Kp/Ki，保守地重新调参，并检查相电流波形是否有高频纹波。"
    },
    "jt_r_speed": {
      "result": "速度环增益过高的典型表现是在负载机械共振频率（或附近）出现可听见的振荡。降低速度环 Kp/Ki；如果在适中增益下仍以固定频率振荡，应按共振/机械问题处理，而不是继续加大增益。"
    },
    "jt_r_position": {
      "result": "位置环 Kp/Kd 过高表现为在目标位置处超调或极限环振荡，而不是在运动中途振荡。先降低 Kd（静止时嗡嗡声更常见的原因），再降低 Kp；从保守的基础参数重新调参。现场确认案例：在位置跟随模式下（上位机直接下发原始位置目标）出现的嗡嗡声，通过将位置环 KD 从 0.5 降到 0.005 得到解决——同一台设备改用自带加减速规划时没有噪声，因此如果应用直接下发设定点，这类症状首先指向 KD。"
    },
    "jt_enc": {
      "ask": "编码器接线是否干净且接地良好（有屏蔽、远离电机动力线）？",
      "options": [
        {
          "label": "是",
          "next": "jt_mech"
        },
        {
          "label": "否 / 不确定",
          "next": "jt_r_enc"
        }
      ]
    },
    "jt_r_enc": {
      "result": "编码器噪声会表现得像系统不稳定。为编码器线缆加屏蔽并远离动力线走线，确保接地可靠，并重新插拔接插件。对于双编码器设备，也可尝试关闭第二编码器作为诊断——若抖动/报错消失，则是阈值调参问题而非接线故障（但关闭后需重新确认 PID 参数仍然适用）。然后重新评估。"
    },
    "jt_mech": {
      "result": "在调参和传感都正常的情况下，从机械方面排查：背隙、安装松动/刚度不足，或转子与负载惯量之间的共振。加固安装、减小背隙，并检查惯量失配（负载惯量远大于转子惯量）。"
    }
  }
};

window.SUPPORT_FIELD_HELP = {
  "rated_torque_Nm": {
    "zh": "额定扭矩：可连续输出而不过热的扭矩。持续运行应不超过此值。",
    "en": "Torque the actuator delivers continuously without overheating. Keep the steady-state load at or below this."
  },
  "peak_torque_Nm": {
    "zh": "峰值扭矩：短时（加速、冲击）可输出的最大扭矩。持续在此扭矩会过热，只用于瞬时峰值。",
    "en": "Maximum torque for short bursts (acceleration, shock). Sustaining it overheats the motor — not a continuous rating."
  },
  "rated_speed_rpm": {
    "zh": "额定转速：输出额定扭矩/功率时的转速。超过后可用扭矩会下降。",
    "en": "Speed at which rated torque/power is delivered. Above it, available torque falls off."
  },
  "no_load_speed_rpm": {
    "zh": "空载转速：无负载时的最高转速。此处扭矩接近 0，转速降低时可用扭矩上升。",
    "en": "Top speed with no load. Torque is ~zero here; usable torque rises as speed drops toward stall."
  },
  "rated_power_W": {
    "zh": "额定功率：连续输出的机械功率（扭矩 × 角速度）。",
    "en": "Continuous mechanical output (≈ rated torque × rated speed). A rough size/capability indicator."
  },
  "voltage_V": {
    "zh": "额定电压：设计工作电压。低于额定会降低性能，高于额定可能触发过压。",
    "en": "Nominal DC bus voltage. Lower supply lowers top speed and available torque roughly in proportion."
  },
  "ratio": {
    "zh": "减速比：电机轴到输出轴的传动比。输出扭矩 = 电机扭矩 × 减速比 × 效率。",
    "en": "Gear reduction. Higher ratio multiplies torque and backlash-sensitivity while dividing output speed."
  },
  "torque_constant_Nm_A": {
    "zh": "扭矩常数：每安培电流产生的输出扭矩（N·m/A）。用于从电流估算扭矩。",
    "en": "Kt: torque produced per amp (at the motor). Torque ≈ Kt × current — handy for current-from-torque estimates."
  },
  "back_emf_Vdc_krpm": {
    "zh": "反电势常数：每千转产生的反电动势（V/krpm）。影响高速时的可达到转速。",
    "en": "Voltage the spinning motor generates per 1000 rpm. Sets the speed a given bus voltage can reach."
  },
  "resistance_ohm": {
    "zh": "线电阻：电机相间电阻，影响铜损和温升。",
    "en": "Winding resistance. Drives I²R heating and the voltage lost to current — affects low-speed torque & warmth."
  },
  "inductance_mH": {
    "zh": "线电感：电机相间电感，影响电流环带宽和响应。",
    "en": "Winding inductance. Influences current ripple and how fast current (torque) can change; matters for tuning."
  },
  "pole_pairs": {
    "zh": "极对数：电机转子磁极对数，影响电角度换算。",
    "en": "Magnetic pole pairs. Affects electrical-to-mechanical speed ratio and commutation; needed for correct setup."
  },
  "rotor_inertia_kgcm2": {
    "zh": "转子惯量：电机转子转动惯量。折算到输出端需乘以减速比平方。",
    "en": "Spinning mass of the rotor. High inertia resists fast acceleration; match to load inertia for good control."
  },
  "backlash": {
    "zh": "背隙：齿轮传动中的空程，单位为弧分（arcmin）。1 弧分 ≈ 0.0167°。",
    "en": "Lost motion when reversing direction. Critical for precision/positioning; harmonic ≪ planetary here."
  },
  "backdrive_torque_Nm": {
    "zh": "反驱扭矩：断电后需要多大扭矩才能反向推动输出端。小于此值不会自转。",
    "en": "Torque needed at the output to turn the actuator backwards. High = more self-holding; low = easier to back-drive."
  },
  "output_bearing_type": {
    "zh": "输出轴承类型：决定可承受的轴向/径向载荷和倾覆力矩。",
    "en": "Bearing supporting the output flange. A cross-roller carries combined axial+radial+moment loads directly."
  },
  "brake": {
    "zh": "抱闸：断电时是否保持位置。谐波模组（RH / HM 系列）标配抱闸，行星模组（X 系列）无抱闸。",
    "en": "Holding brake. If present it keeps position with power off — important for vertical/lifting joints (safety)."
  },
  "axial_load_tensile_kN": {
    "zh": "轴向载荷（受拉）：输出端可承受的向外拉力。",
    "en": "Pull-apart load the output bearing tolerates along the shaft axis."
  },
  "axial_load_compressive_kN": {
    "zh": "轴向载荷（受压）：输出端可承受的向内压力。",
    "en": "Push-together load the output bearing tolerates along the shaft axis."
  },
  "radial_load_kN": {
    "zh": "径向载荷：垂直于轴线的载荷，如皮带轮、齿轮的径向力。",
    "en": "Sideways load the output bearing tolerates, perpendicular to the shaft."
  },
  "radial_load_static_kN": {
    "zh": "径向载荷（静态）：静止或低速时可承受的径向力。",
    "en": "Radial load rating while stationary (no rotation)."
  },
  "radial_load_dynamic_kN": {
    "zh": "径向载荷（动态）：连续旋转时可承受的径向力。",
    "en": "Radial load rating while rotating (lower than static; affects bearing life)."
  },
  "efficiency_pct": {
    "zh": "效率：输出机械功率 / 输入电功率。影响发热和能耗。",
    "en": "Fraction of electrical input that becomes mechanical output; the rest is heat. Lower = runs hotter."
  },
  "rated_current_A": {
    "zh": "额定电流：输出额定扭矩时的相电流（RMS）。",
    "en": "Continuous current for rated torque. The thermal limit for steady operation."
  },
  "peak_current_A": {
    "zh": "峰值电流：短时可承受的最大相电流（RMS）。",
    "en": "Short-burst current for peak torque. Over it the driver current-limits or faults."
  },
  "no_load_current_A": {
    "zh": "空载电流：无负载运转时的电流，反映摩擦和铁损。",
    "en": "Current just to spin the unloaded motor (friction, cogging, iron losses)."
  },
  "encoder": {
    "zh": "编码器：位置反馈类型（单/双编码器、位数、绝对值/增量）。",
    "en": "Position sensor. Bit-count = resolution; ABS (absolute) keeps position through power-cycles, INC (incremental) needs homing."
  },
  "repeatability_deg": {
    "zh": "重复精度：多次回到同一目标位置的一致性。",
    "en": "How closely it returns to the same commanded position. Smaller is better for precision work."
  },
  "insulation": {
    "zh": "绝缘等级：绕组绝缘耐温等级（如 F 级 = 155°C）。",
    "en": "Winding insulation class — the temperature the windings can safely tolerate."
  },
  "protection": {
    "zh": "防护等级：防尘防水等级（IP 代码）。",
    "en": "IP rating: dust/water ingress resistance (e.g. IP54). Higher = more sealed."
  },
  "weight_kg": {
    "zh": "重量：不含线缆的执行器净重。",
    "en": "Actuator mass. In multi-joint robots this stacks up as load on every joint below it."
  },
  "outer_diameter_mm": {
    "zh": "外径：执行器最大外圆直径。",
    "en": "Body outer diameter — the main packaging constraint for fitting into a joint."
  },
  "length_mm": {
    "zh": "长度：执行器轴向总长（不含轴伸）。",
    "en": "Body length along the axis — the other key packaging dimension."
  },
  "comms": {
    "zh": "通信协议：支持的总线类型（EtherCAT / CAN / RS485）。",
    "en": "Control/communication interface (e.g. CAN, RS485, EtherCAT). Must match the customer's controller & wiring."
  },
  "wiring": {
    "zh": "接线方式：电机绕组接法（Y 星形 / Δ 三角形）。",
    "en": "Motor winding connection (e.g. Y / star). Relevant when configuring or diagnosing the drive."
  },
  "thrust_N": {
    "zh": "推力：直线执行器的输出推力。",
    "en": "For linear units: continuous push/pull force along the stroke."
  },
  "family": {
    "zh": "系列：产品族（行星/谐波/直线/中空直驱等）。",
    "en": "Gear technology. Planetary = compact, cost-effective, some backlash. Harmonic = near-zero backlash, high ratio, precision."
  }
};

window.SUPPORT_GUIDES = [
  {
    "id": "g1",
    "title": "TwinCAT 安装与配置",
    "titleEn": "TwinCAT install",
    "desc": "从零安装 TwinCAT 3，配置 EtherCAT 主站并扫描从站。",
    "video": "https://working--myactuator-finder.netlify.app/assets/videos/twincat-install.mp4"
  },
  {
    "id": "g2",
    "title": "ESI/XML 文件更新",
    "titleEn": "ESI/XML update",
    "desc": "当主站的 ESI 文件与执行器型号或固件版本不一致时，如何更新。",
    "video": "https://working--myactuator-finder.netlify.app/assets/videos/xml-update-instructional.mp4"
  },
  {
    "id": "g3",
    "title": "EtherCAT 从站无法进入 OP",
    "titleEn": "Slave never reaches OP",
    "desc": "检查 DC（分布式时钟）设置、周期时间、ESI 匹配和 PDO 映射。",
    "video": ""
  },
  {
    "id": "g4",
    "title": "固件升级流程",
    "titleEn": "Firmware update",
    "desc": "通过上位机或 CAN 升级执行器固件，注意版本兼容性。",
    "video": ""
  }
];

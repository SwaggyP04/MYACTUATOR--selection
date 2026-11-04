// 3D装配可视化 - 纯JS版本
let assemblyScene, assemblyCamera, assemblyRenderer, assemblyLabelRenderer, assemblyControls;
let assemblyArmGroup, assemblyJointGroups = [], assemblyAnimationId, assemblyClock;
let assemblySimTime = 0, assemblySimulating = false, assemblyIsAssembling = false;
let assemblyCurrentAxis = -1;
let assemblyMotorData = null;
let assemblyLabelElements = [];

const ARM_DIMENSIONS = {
  baseRadius: 80, baseHeight: 40, J1Height: 50,
  upperArmLength: 220, lowerArmLength: 180, wristLength: 80, flangeLength: 40, armWidth: 36
};

// 打开装配模态框
function openAssemblyModal(autoStart) {
  const modal = document.getElementById('assemblyModal');
  if (!modal) return;
  modal.classList.add('active');
  // 延迟初始化场景
  setTimeout(() => {
    initAssemblyScene();
    if (autoStart) {
      setTimeout(() => startAssemblyAnimation(), 1000);
    }
  }, 100);
}

// 关闭装配模态框
function closeAssemblyModal() {
  const modal = document.getElementById('assemblyModal');
  if (modal) modal.classList.remove('active');
  if (assemblyAnimationId) {
    cancelAnimationFrame(assemblyAnimationId);
    assemblyAnimationId = null;
  }
  if (assemblyRenderer) {
    assemblyRenderer.dispose();
    assemblyRenderer = null;
  }
  assemblyJointGroups = [];
  assemblyLabelElements = [];
}

// 设置电机数据
function setAssemblyMotorData(data) {
  assemblyMotorData = data;
  renderAssemblyAxisList();
  renderAssemblyAxisIndicator();
}

// 渲染轴列表
function renderAssemblyAxisList() {
  const container = document.getElementById('assemblyAxisList');
  if (!container || !assemblyMotorData) return;
  container.innerHTML = assemblyMotorData.axes.map((axis, idx) => `
    <div class="assembly-axis-card pending" id="assembly-axis-${idx}">
      <div class="assembly-axis-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="assembly-axis-badge">${axis.key}</div>
          <div class="assembly-axis-name">${axis.name}</div>
        </div>
        <div class="assembly-axis-status">待装配</div>
      </div>
      <div class="assembly-axis-params">
        <div class="assembly-param-item"><span class="assembly-param-label">电机型号</span><span class="assembly-param-value placeholder">---</span></div>
        <div class="assembly-param-item"><span class="assembly-param-label">额定扭矩</span><span class="assembly-param-value placeholder">---</span></div>
        <div class="assembly-param-item"><span class="assembly-param-label">额定转速</span><span class="assembly-param-value placeholder">---</span></div>
        <div class="assembly-param-item"><span class="assembly-param-label">减速比</span><span class="assembly-param-value placeholder">---</span></div>
        <div class="assembly-param-item"><span class="assembly-param-label">转动惯量</span><span class="assembly-param-value placeholder">---</span></div>
        <div class="assembly-param-item"><span class="assembly-param-label">负载能力</span><span class="assembly-param-value placeholder">---</span></div>
      </div>
    </div>
  `).join('');
}

// 渲染轴指示器
function renderAssemblyAxisIndicator() {
  const container = document.getElementById('assemblyAxisIndicator');
  if (!container || !assemblyMotorData) return;
  container.innerHTML = assemblyMotorData.axes.map((axis, idx) => 
    `<div class="assembly-axis-dot" id="assembly-dot-${idx}" title="${axis.name}"></div>`
  ).join('');
}

// 更新轴状态
function updateAssemblyAxis(idx, assembled) {
  const card = document.getElementById('assembly-axis-' + idx);
  const dot = document.getElementById('assembly-dot-' + idx);
  if (!card || !assemblyMotorData) return;
  const axis = assemblyMotorData.axes[idx];
  const motor = axis.motor || axis;
  
  if (assembled) {
    card.classList.remove('pending');
    card.classList.add('assembled');
    card.querySelector('.assembly-axis-status').textContent = '已装配';
    const values = card.querySelectorAll('.assembly-param-value');
    values[0].textContent = motor.model;
    values[1].textContent = motor.ratedTorque + ' N·m';
    values[2].textContent = motor.ratedSpeed + ' rpm';
    values[3].textContent = '1:' + motor.ratio;
    values[4].textContent = motor.inertia + ' kg·m²';
    values[5].textContent = motor.load + ' kg';
    values.forEach(v => v.classList.remove('placeholder'));
    if (dot) { dot.classList.remove('active'); dot.classList.add('done'); }
  } else {
    card.classList.add('pending');
    card.classList.remove('assembled');
    card.querySelector('.assembly-axis-status').textContent = '待装配';
    if (dot) dot.classList.remove('active', 'done');
  }
  
  // 更新进度
  const assembledCount = assemblyMotorData.axes.filter((_, i) => 
    document.getElementById('assembly-axis-' + i)?.classList.contains('assembled')
  ).length;
  const total = assemblyMotorData.axes.length;
  document.getElementById('assemblyProgressFill').style.width = (assembledCount / total * 100) + '%';
  document.getElementById('assemblyProgressText').textContent = `装配进度 ${assembledCount} / ${total} 轴`;
  
  // 更新汇总
  if (assembledCount === total) {
    document.getElementById('assemblyTotalLoad').textContent = motor.load + ' kg';
    document.getElementById('assemblyTotalLoad').classList.remove('placeholder');
    const totalW = assemblyMotorData.axes.reduce((s, a) => s + Number((a.motor||a).weight), 0);
    document.getElementById('assemblyTotalWeight').textContent = (totalW * 4).toFixed(1) + ' kg';
    document.getElementById('assemblyTotalWeight').classList.remove('placeholder');
    document.getElementById('assemblyMaxReach').textContent = (ARM_DIMENSIONS.upperArmLength + ARM_DIMENSIONS.lowerArmLength + ARM_DIMENSIONS.wristLength + ARM_DIMENSIONS.flangeLength) + ' mm';
    document.getElementById('assemblyMaxReach').classList.remove('placeholder');
    document.getElementById('assemblyRepeatability').textContent = '±0.03 mm';
    document.getElementById('assemblyRepeatability').classList.remove('placeholder');
  }
}

// 更新状态
function updateAssemblyStatus(status) {
  const dot = document.getElementById('assemblyStatusDot');
  const text = document.getElementById('assemblyStatusText');
  if (!dot || !text) return;
  dot.className = 'assembly-status-dot ' + status;
  text.textContent = status === 'assembling' ? '装配进行中' : status === 'running' ? '仿真运行中' : '待机状态';
}

// 金属材质
function createAssemblyMetalMaterial(color, opts) {
  opts = opts || {};
  return new THREE.MeshPhongMaterial({
    color: color,
    shininess: opts.shininess !== undefined ? opts.shininess : 80,
    specular: opts.specular !== undefined ? new THREE.Color(opts.specular) : new THREE.Color(0x445566),
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0,
    flatShading: false
  });
}

// 创建基座
function createAssemblyBase() {
  const group = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(ARM_DIMENSIONS.baseRadius, ARM_DIMENSIONS.baseRadius + 10, 15, 32);
  const baseMesh = new THREE.Mesh(baseGeo, createAssemblyMetalMaterial(0x2d3748, {shininess:60}));
  baseMesh.position.y = 7.5; baseMesh.castShadow = true; baseMesh.receiveShadow = true; group.add(baseMesh);
  const ringGeo = new THREE.TorusGeometry(ARM_DIMENSIONS.baseRadius - 5, 2, 8, 32);
  const ringMesh = new THREE.Mesh(ringGeo, createAssemblyMetalMaterial(0x64748b, {shininess:100}));
  ringMesh.rotation.x = Math.PI/2; ringMesh.position.y = 15; group.add(ringMesh);
  const pillarGeo = new THREE.CylinderGeometry(ARM_DIMENSIONS.baseRadius - 10, ARM_DIMENSIONS.baseRadius - 5, ARM_DIMENSIONS.baseHeight - 15, 32);
  const pillarMesh = new THREE.Mesh(pillarGeo, createAssemblyMetalMaterial(0x3b4252, {shininess:90, specular:0x667788}));
  pillarMesh.position.y = 15 + (ARM_DIMENSIONS.baseHeight - 15)/2; pillarMesh.castShadow = true; group.add(pillarMesh);
  const capGeo = new THREE.CylinderGeometry(ARM_DIMENSIONS.baseRadius - 3, ARM_DIMENSIONS.baseRadius - 10, 8, 32);
  const capMesh = new THREE.Mesh(capGeo, createAssemblyMetalMaterial(0x475569, {shininess:120, specular:0x8899aa}));
  capMesh.position.y = ARM_DIMENSIONS.baseHeight - 4; capMesh.castShadow = true; group.add(capMesh);
  const ledGeo = new THREE.SphereGeometry(3, 12, 12);
  const ledMesh = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({color:0x10b981}));
  ledMesh.position.set(ARM_DIMENSIONS.baseRadius - 20, 20, ARM_DIMENSIONS.baseRadius - 15); group.add(ledMesh);
  return group;
}

// 创建电机
function createAssemblyMotorMesh(motorData) {
  const group = new THREE.Group();
  const d = motorData.diameter * 0.8, l = motorData.length * 0.7;
  const bodyGeo = new THREE.CylinderGeometry(d/2, d/2, l, 24);
  const bodyMesh = new THREE.Mesh(bodyGeo, createAssemblyMetalMaterial(0x4a5568, {shininess:70, specular:0x667788}));
  bodyMesh.castShadow = true; group.add(bodyMesh);
  const frontGeo = new THREE.CylinderGeometry(d/2 + 2, d/2, 6, 24);
  const frontMesh = new THREE.Mesh(frontGeo, createAssemblyMetalMaterial(0x718096, {shininess:120, specular:0xaabbcc}));
  frontMesh.position.y = l/2 + 3; frontMesh.castShadow = true; group.add(frontMesh);
  const shaftGeo = new THREE.CylinderGeometry(d/6, d/6, 10, 16);
  const shaftMesh = new THREE.Mesh(shaftGeo, createAssemblyMetalMaterial(0xcbd5e1, {shininess:200, specular:0xffffff}));
  shaftMesh.position.y = l/2 + 8; shaftMesh.castShadow = true; group.add(shaftMesh);
  for (let i = 0; i < 3; i++) {
    const finGeo = new THREE.TorusGeometry(d/2 - 1, 1.5, 8, 24);
    const finMesh = new THREE.Mesh(finGeo, createAssemblyMetalMaterial(0x2d3748, {shininess:30}));
    finMesh.rotation.x = Math.PI/2; finMesh.position.y = -l/4 + (i * l)/3; group.add(finMesh);
  }
  return group;
}

// 创建臂身
function createAssemblyArmSegment(length, width, color) {
  color = color || 0x4a5568;
  const group = new THREE.Group();
  const r = width / 2;
  const bodyGeo = new THREE.BoxGeometry(width, length, width);
  const bodyMesh = new THREE.Mesh(bodyGeo, createAssemblyMetalMaterial(color, {shininess:60, specular:0x556677}));
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; group.add(bodyMesh);
  const sideGeo = new THREE.CylinderGeometry(r, r, length, 16, 1, false, 0, Math.PI);
  const sideMat = createAssemblyMetalMaterial(color, {shininess:70, specular:0x667788});
  const sideLeft = new THREE.Mesh(sideGeo, sideMat); sideLeft.rotation.z = Math.PI/2; sideLeft.position.z = -width/2; sideLeft.castShadow = true; group.add(sideLeft);
  const sideRight = new THREE.Mesh(sideGeo, sideMat); sideRight.rotation.z = -Math.PI/2; sideRight.position.z = width/2; sideRight.castShadow = true; group.add(sideRight);
  const lineGeo = new THREE.BoxGeometry(width/2, length - 10, 2);
  const line1 = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({color:0x64748b}));
  line1.position.z = width/2 + 1; group.add(line1);
  return group;
}

// 创建关节壳体
function createAssemblyJointHousing(diameter, color) {
  color = color || 0x3b4252;
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(diameter/2, 24, 16);
  const mesh = new THREE.Mesh(geo, createAssemblyMetalMaterial(color, {shininess:80, specular:0x667788}));
  mesh.castShadow = true; group.add(mesh);
  const ringGeo = new THREE.TorusGeometry(diameter/2, 3, 8, 24);
  const ring = new THREE.Mesh(ringGeo, createAssemblyMetalMaterial(0x718096, {shininess:120, specular:0xaabbcc}));
  ring.rotation.x = Math.PI/2; group.add(ring);
  return group;
}

// 创建末端执行器
function createAssemblyEndEffector() {
  const group = new THREE.Group();
  const flangeGeo = new THREE.CylinderGeometry(20, 18, 10, 20);
  const flange = new THREE.Mesh(flangeGeo, createAssemblyMetalMaterial(0x94a3b8, {shininess:150, specular:0xccccdd}));
  flange.castShadow = true; group.add(flange);
  const pinGeo = new THREE.CylinderGeometry(5, 3, 20, 12);
  const pin = new THREE.Mesh(pinGeo, createAssemblyMetalMaterial(0xcbd5e1, {shininess:200, specular:0xffffff}));
  pin.position.y = 15; pin.castShadow = true; group.add(pin);
  for (let i = 0; i < 6; i++) {
    const holeGeo = new THREE.CylinderGeometry(2, 2, 10, 8);
    const hole = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({color:0x1a202c}));
    const angle = (i / 6) * Math.PI * 2;
    hole.position.set(Math.cos(angle) * 12, 0, Math.sin(angle) * 12); group.add(hole);
  }
  return group;
}

// 构建机械臂层级
function buildAssemblyArm() {
  assemblyArmGroup = new THREE.Group();
  const base = createAssemblyBase(); assemblyArmGroup.add(base);
  const motorData = assemblyMotorData.axes;
  
  // J1
  const j1 = new THREE.Group(); j1.position.y = ARM_DIMENSIONS.baseHeight; j1.visible = false;
  const j1Motor = createAssemblyMotorMesh(motorData[0]?.motor || motorData[0]); j1Motor.rotation.x = Math.PI/2; j1Motor.position.y = 20; j1.add(j1Motor);
  const j1Housing = createAssemblyJointHousing(60, 0x334155); j1Housing.position.y = 45; j1Housing.scale.set(1, 0.6, 1); j1.add(j1Housing);
  // J2
  const j2 = new THREE.Group(); j2.position.y = 70; j2.visible = false;
  const j2Motor = createAssemblyMotorMesh(motorData[1]?.motor || motorData[1]); j2Motor.rotation.z = Math.PI/2; j2Motor.position.z = 25; j2.add(j2Motor);
  const upperArm = createAssemblyArmSegment(ARM_DIMENSIONS.upperArmLength, ARM_DIMENSIONS.armWidth, 0x475569); upperArm.position.y = ARM_DIMENSIONS.upperArmLength/2 + 10; j2.add(upperArm);
  const j2Housing = createAssemblyJointHousing(50, 0x334155); j2Housing.position.y = 10; j2.add(j2Housing);
  // J3
  const j3 = new THREE.Group(); j3.position.y = ARM_DIMENSIONS.upperArmLength + 10; j3.visible = false;
  const j3Motor = createAssemblyMotorMesh(motorData[2]?.motor || motorData[2]); j3Motor.rotation.z = -Math.PI/2; j3Motor.position.z = -22; j3.add(j3Motor);
  const j3Housing = createAssemblyJointHousing(44, 0x334155); j3.add(j3Housing);
  const lowerArm = createAssemblyArmSegment(ARM_DIMENSIONS.lowerArmLength, ARM_DIMENSIONS.armWidth - 6, 0x4a5568); lowerArm.position.y = ARM_DIMENSIONS.lowerArmLength/2 + 5; j3.add(lowerArm);
  // J4
  const j4 = new THREE.Group(); j4.position.y = ARM_DIMENSIONS.lowerArmLength + 5; j4.visible = false;
  const j4Motor = createAssemblyMotorMesh(motorData[3]?.motor || motorData[3]); j4Motor.rotation.x = Math.PI/2; j4Motor.position.y = 15; j4.add(j4Motor);
  const wristBaseGeo = new THREE.CylinderGeometry(22, 24, 25, 20);
  const wristBase = new THREE.Mesh(wristBaseGeo, createAssemblyMetalMaterial(0x3b4252, {shininess:80})); wristBase.position.y = 12; wristBase.castShadow = true; j4.add(wristBase);
  // J5
  const j5 = new THREE.Group(); j5.position.y = 30; j5.visible = false;
  const j5Motor = createAssemblyMotorMesh(motorData[4]?.motor || motorData[4]); j5Motor.rotation.z = Math.PI/2; j5Motor.position.z = 18; j5.add(j5Motor);
  const j5Housing = createAssemblyJointHousing(36, 0x334155); j5Housing.scale.set(1, 0.8, 1); j5.add(j5Housing);
  const foreArmGeo = new THREE.CylinderGeometry(14, 16, ARM_DIMENSIONS.wristLength, 16);
  const foreArm = new THREE.Mesh(foreArmGeo, createAssemblyMetalMaterial(0x475569, {shininess:70})); foreArm.position.y = ARM_DIMENSIONS.wristLength/2; foreArm.castShadow = true; j5.add(foreArm);
  // J6
  const j6 = new THREE.Group(); j6.position.y = ARM_DIMENSIONS.wristLength; j6.visible = false;
  const j6Motor = createAssemblyMotorMesh(motorData[5]?.motor || motorData[5]); j6Motor.rotation.x = Math.PI/2; j6Motor.position.y = 15; j6.add(j6Motor);
  const endEff = createAssemblyEndEffector(); endEff.position.y = 35; j6.add(endEff);
  
  j5.add(j6); j4.add(j5); j3.add(j4); j2.add(j3); j1.add(j2); base.add(j1);
  assemblyJointGroups = [j1, j2, j3, j4, j5, j6];
  assemblyScene.add(assemblyArmGroup);
}

// 创建标签
function createAssemblyLabel(idx) {
  const axisData = assemblyMotorData.axes[idx];
  const motor = axisData.motor || axisData;
  const div = document.createElement('div');
  div.className = 'motor-label'; div.style.display = 'none';
  div.innerHTML = `<div class="motor-label-header"><span class="motor-label-axis">${axisData.key}</span><span class="motor-label-model">${motor.model}</span></div><div class="motor-label-params"><div class="motor-label-param"><span class="lbl">扭矩</span><span class="val">${motor.ratedTorque} N·m</span></div><div class="motor-label-param"><span class="lbl">转速</span><span class="val">${motor.ratedSpeed} rpm</span></div><div class="motor-label-param"><span class="lbl">减速比</span><span class="val">1:${motor.ratio}</span></div><div class="motor-label-param"><span class="lbl">负载</span><span class="val">${motor.load} kg</span></div></div>`;
  const label = new THREE.CSS2DObject(div);
  return {label, element: div};
}

// 附加标签到关节
function attachAssemblyLabel(idx) {
  const joint = assemblyJointGroups[idx];
  const {label, element} = assemblyLabelElements[idx];
  const anchors = [
    new THREE.Vector3(60,50,0), new THREE.Vector3(50,30,50), new THREE.Vector3(45,50,-45),
    new THREE.Vector3(40,30,0), new THREE.Vector3(35,25,35), new THREE.Vector3(30,40,0)
  ];
  label.position.copy(anchors[idx] || anchors[0]);
  joint.add(label); element.style.display = 'block';
}

// 初始化场景
function initAssemblyScene() {
  const canvas = document.getElementById('assembly-canvas');
  const container = canvas.parentElement;
  const width = container.clientWidth, height = container.clientHeight;
  
  assemblyScene = new THREE.Scene();
  assemblyScene.fog = new THREE.Fog(0x0a0d12, 300, 800);
  assemblyCamera = new THREE.PerspectiveCamera(45, width/height, 0.1, 2000);
  assemblyCamera.position.set(350, 250, 350); assemblyCamera.lookAt(0, 120, 0);
  assemblyRenderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  assemblyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  assemblyRenderer.setSize(width, height);
  assemblyRenderer.shadowMap.enabled = true;
  assemblyRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  assemblyRenderer.setClearColor(0x000000, 0);
  
  assemblyLabelRenderer = new THREE.CSS2DRenderer();
  assemblyLabelRenderer.setSize(width, height);
  const labelDom = assemblyLabelRenderer.domElement;
  labelDom.style.position = 'absolute'; labelDom.style.top = '0'; labelDom.style.left = '0'; labelDom.style.pointerEvents = 'none';
  document.getElementById('assembly-label-renderer').appendChild(labelDom);
  
  assemblyControls = new THREE.OrbitControls(assemblyCamera, canvas);
  assemblyControls.enableDamping = true; assemblyControls.dampingFactor = 0.05;
  assemblyControls.target.set(0, 120, 0); assemblyControls.minDistance = 150; assemblyControls.maxDistance = 700;
  assemblyControls.maxPolarAngle = Math.PI * 0.85;
  
  assemblyScene.add(new THREE.AmbientLight(0x404050, 0.4));
  const mainLight = new THREE.DirectionalLight(0xffffff, 1); mainLight.position.set(200,300,200); mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048; mainLight.shadow.mapSize.height = 2048; assemblyScene.add(mainLight);
  const fillLight = new THREE.DirectionalLight(0x5678a8, 0.4); fillLight.position.set(-150,100,-150); assemblyScene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x3b82f6, 0.3); rimLight.position.set(0,150,-200); assemblyScene.add(rimLight);
  
  const groundGeo = new THREE.CircleGeometry(400, 64);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({color:0x111622, transparent:true, opacity:0.8}));
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.5; ground.receiveShadow = true; assemblyScene.add(ground);
  const gridHelper = new THREE.GridHelper(500, 25, 0x1e293b, 0x111827); assemblyScene.add(gridHelper);
  
  if (!assemblyMotorData) {
    assemblyMotorData = {
      robotType: '六轴工业机械臂', axes: [
        {key:'J1',name:'基座旋转轴',motor:{model:'X4-400',ratedTorque:1.27,ratedSpeed:3000,inertia:0.032,load:50,ratio:80,power:0.4,diameter:60,length:80,weight:1.2}},
        {key:'J2',name:'大臂俯仰轴',motor:{model:'X4-750',ratedTorque:2.39,ratedSpeed:3000,inertia:0.068,load:35,ratio:100,power:0.75,diameter:80,length:110,weight:2.5}},
        {key:'J3',name:'小臂摆动轴',motor:{model:'X4-400',ratedTorque:1.27,ratedSpeed:3000,inertia:0.032,load:20,ratio:60,power:0.4,diameter:60,length:80,weight:1.2}},
        {key:'J4',name:'腕部翻转轴',motor:{model:'X4-100',ratedTorque:0.32,ratedSpeed:3000,inertia:0.008,load:10,ratio:50,power:0.1,diameter:40,length:60,weight:0.4}},
        {key:'J5',name:'腕部摆动轴',motor:{model:'X4-100',ratedTorque:0.32,ratedSpeed:3000,inertia:0.008,load:8,ratio:50,power:0.1,diameter:40,length:60,weight:0.4}},
        {key:'J6',name:'末端法兰轴',motor:{model:'X4-50',ratedTorque:0.16,ratedSpeed:5000,inertia:0.004,load:6,ratio:30,power:0.05,diameter:35,length:50,weight:0.25}}
      ]
    };
  }
  
  document.getElementById('assemblyRobotName').textContent = (assemblyMotorData.robotType || '六轴机械臂') + ' · 电机选型装配仿真';
  renderAssemblyAxisList();
  renderAssemblyAxisIndicator();
  
  buildAssemblyArm();
  assemblyLabelElements = [];
  for (let i = 0; i < Math.min(6, assemblyMotorData.axes.length); i++) {
    assemblyLabelElements.push(createAssemblyLabel(i));
  }
  
  assemblyClock = new THREE.Clock();
  assemblyAnimate();
  window.addEventListener('resize', onAssemblyResize);
}

// 动画循环
function assemblyAnimate() {
  assemblyAnimationId = requestAnimationFrame(assemblyAnimate);
  const delta = assemblyClock.getDelta();
  if (window.TWEEN) TWEEN.update();
  if (assemblySimulating) {
    assemblySimTime += delta;
    runAssemblySimulation(assemblySimTime);
  }
  assemblyControls.update();
  assemblyRenderer.render(assemblyScene, assemblyCamera);
  assemblyLabelRenderer.render(assemblyScene, assemblyCamera);
}

// 循环仿真
function runAssemblySimulation(t) {
  if (assemblyJointGroups[0]) assemblyJointGroups[0].rotation.y = Math.sin(t * 0.4) * 0.8;
  if (assemblyJointGroups[1]) assemblyJointGroups[1].rotation.z = Math.sin(t * 0.5) * 0.5 + 0.2;
  if (assemblyJointGroups[2]) assemblyJointGroups[2].rotation.z = Math.sin(t * 0.6 + 1) * 0.4 - 0.3;
  if (assemblyJointGroups[3]) assemblyJointGroups[3].rotation.y = t * 0.5;
  if (assemblyJointGroups[4]) assemblyJointGroups[4].rotation.z = Math.sin(t * 0.7 + 2) * 0.5;
  if (assemblyJointGroups[5]) assemblyJointGroups[5].rotation.y = t * 1.2;
}

// 开始装配
function startAssemblyAnimation() {
  if (assemblyIsAssembling) return;
  if (assemblyJointGroups.length > 0 && assemblyJointGroups.every(g => g.visible)) {
    resetAssemblyAnimation();
    setTimeout(() => doAssemblyAnimation(), 500);
    return;
  }
  doAssemblyAnimation();
}

function doAssemblyAnimation() {
  assemblyIsAssembling = true; assemblySimulating = false;
  updateAssemblyStatus('assembling');
  assemblyJointGroups.forEach(g => { g.visible = false; g.scale.set(1,1,1); });
  assemblyMotorData.axes.forEach((_, i) => updateAssemblyAxis(i, false));
  assembleAxisAnimation(0);
}

function assembleAxisAnimation(idx) {
  if (idx >= Math.min(6, assemblyMotorData.axes.length)) {
    assemblyIsAssembling = false; assemblyCurrentAxis = -1;
    assemblySimulating = true; updateAssemblyStatus('running');
    return;
  }
  assemblyCurrentAxis = idx;
  const dot = document.getElementById('assembly-dot-' + idx);
  if (dot) dot.classList.add('active');
  
  const joint = assemblyJointGroups[idx];
  joint.visible = true; joint.scale.set(0.01, 0.01, 0.01);
  const startY = joint.position.y; joint.position.y += 100; joint.rotation.y = Math.PI * 2;
  
  new TWEEN.Tween({s:0.01, y:joint.position.y, r:Math.PI*2})
    .to({s:1, y:startY, r:0}, 900)
    .easing(TWEEN.Easing.Elastic.Out)
    .onUpdate(obj => { joint.scale.set(obj.s, obj.s, obj.s); joint.position.y = obj.y; joint.rotation.y = obj.r; })
    .onComplete(() => {
      updateAssemblyAxis(idx, true);
      attachAssemblyLabel(idx);
      setTimeout(() => assembleAxisAnimation(idx + 1), 600);
    })
    .start();
}

// 重置
function resetAssemblyAnimation() {
  if (window.TWEEN) TWEEN.removeAll();
  assemblyIsAssembling = false; assemblySimulating = false; assemblyCurrentAxis = -1; assemblySimTime = 0;
  updateAssemblyStatus('idle');
  if (assemblyMotorData) assemblyMotorData.axes.forEach((_, i) => updateAssemblyAxis(i, false));
  if (assemblyJointGroups && assemblyJointGroups.length) {
    assemblyJointGroups.forEach((g, i) => {
      g.visible = false; g.scale.set(1,1,1); g.rotation.set(0,0,0);
      const label = g.getObjectByName('label-' + (assemblyMotorData?.axes[i]?.key || ('J'+(i+1))));
      if (label) { g.remove(label); if (label.element) label.element.style.display = 'none'; }
    });
  }
}

// 窗口自适应
function onAssemblyResize() {
  const container = document.getElementById('assembly-canvas')?.parentElement;
  if (!container || !assemblyRenderer || !assemblyCamera || !assemblyLabelRenderer) return;
  const width = container.clientWidth, height = container.clientHeight;
  assemblyCamera.aspect = width / height; assemblyCamera.updateProjectionMatrix();
  assemblyRenderer.setSize(width, height); assemblyLabelRenderer.setSize(width, height);
}
